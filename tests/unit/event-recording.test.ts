import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { monotonicFactory } from 'ulid';
import { parse, stringify } from 'yaml';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { recordEvent } from '../../src/application/record-event.js';
import { registerActor } from '../../src/application/register-actor.js';
import { validateCanonicalLayer } from '../../src/application/validate-canonical-layer.js';
import { createProgram } from '../../src/cli/main.js';
import type { ContinuityEvent } from '../../src/domain/reconciliation.js';
import { eventPayloadDigest, type RecordEventInput } from '../../src/domain/recording.js';
import { formatRecording } from '../../src/presentation/format-recording.js';

vi.setConfig({ testTimeout: 15_000 });

const coreTemplate = fileURLToPath(new URL('../../templates/core/.pcp/', import.meta.url));
const temporaryRoots: string[] = [];
const ulidPattern = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/u;

async function temporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

async function createProject(): Promise<string> {
  const root = await temporaryRoot('pcp-recording-project-');
  await cp(coreTemplate, path.join(root, '.pcp'), { recursive: true });
  return root;
}

function eventInput(actorId: string, overrides: Partial<RecordEventInput> = {}): RecordEventInput {
  return {
    schema_version: 1,
    actor: { type: 'agent', id: actorId },
    recorded_by: { type: 'agent', id: actorId },
    basis: 'self',
    kind: 'code',
    scopes: ['implementation'],
    workstreams: [],
    summary: 'Implemented a coherent project change.',
    affected_paths: ['src/index.ts'],
    ...overrides,
  };
}

async function writeInput(value: unknown): Promise<string> {
  const root = await temporaryRoot('pcp-recording-input-');
  const inputPath = path.join(root, 'event.yaml');
  await writeFile(inputPath, stringify(value), 'utf8');
  return inputPath;
}

async function eventNames(root: string, directory: 'events' | 'archive'): Promise<string[]> {
  return (await readdir(path.join(root, '.pcp', 'continuity', directory)))
    .filter((name) => name.endsWith('.yaml'))
    .sort((left, right) => left.localeCompare(right));
}

async function readEvent(root: string, eventId: string): Promise<ContinuityEvent> {
  return parse(
    await readFile(path.join(root, '.pcp', 'continuity', 'events', `${eventId}.yaml`), 'utf8'),
  ) as ContinuityEvent;
}

async function writeHistoricalEvent(
  root: string,
  eventId: string,
  actorId: string,
  directory: 'events' | 'archive' = 'events',
): Promise<void> {
  const payload = {
    schema_version: 1,
    event_id: eventId,
    occurred_at: '2024-07-03T09:46:40Z',
    actor: { type: 'agent', id: actorId },
    recorded_by: { type: 'agent', id: actorId },
    basis: 'self',
    kind: 'code',
    scopes: ['implementation'],
    workstreams: [],
    summary: `Recorded historical change ${eventId}.`,
    affected_paths: ['src/index.ts'],
  } satisfies Omit<ContinuityEvent, 'payload_digest'>;
  const event: ContinuityEvent = { ...payload, payload_digest: eventPayloadDigest(payload) };
  await writeFile(
    path.join(root, '.pcp', 'continuity', directory, `${eventId}.yaml`),
    stringify(event),
    'utf8',
  );
}

async function historySnapshot(root: string): Promise<Record<string, Record<string, string>>> {
  const result: Record<string, Record<string, string>> = {};
  for (const directory of ['events', 'archive'] as const) {
    const directoryRoot = path.join(root, '.pcp', 'continuity', directory);
    const entries = (await readdir(directoryRoot)).sort((left, right) => left.localeCompare(right));
    const contents: Record<string, string> = {};
    for (const name of entries) {
      contents[name] = await readFile(path.join(directoryRoot, name), 'utf8');
    }
    result[directory] = contents;
  }
  return result;
}

async function recoveryDirectories(root: string): Promise<string[]> {
  const resolved = path.resolve(root);
  const portable = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  const digest = createHash('sha256').update(portable).digest('hex').slice(0, 12);
  return (await readdir(tmpdir()))
    .filter((name) => name.startsWith(`pcp-event-transaction-${digest}-`))
    .sort();
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('continuity event recording', () => {
  it('records one normalized immutable self event', async () => {
    const root = await createProject();
    const actor = await registerActor(root, {
      client: 'codex',
      machine_label: 'recording-machine',
    });
    const inputPath = await writeInput(
      eventInput(actor.actor_id, {
        occurred_at: '2026-07-15T10:00:00Z',
        scopes: ['protocol', 'implementation'],
        summary: '  Added event recording.  ',
        affected_paths: ['src/index.ts', '.pcp/protocol/20-actor-continuity.md'],
      }),
    );

    const result = await recordEvent(root, inputPath);
    const event = await readEvent(root, result.event_id);

    expect(result).toMatchObject({
      command: 'record',
      status: 'recorded',
      occurred_at: '2026-07-15T10:00:00Z',
      summary: 'Added event recording.',
      active_events: 1,
      archived_events_moved: 0,
      event_created: true,
      mutated: true,
    });
    expect(result.event_id).toMatch(ulidPattern);
    expect(result.payload_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.payload_digest).toBe(event.payload_digest);
    expect(event).toMatchObject({
      event_id: result.event_id,
      actor: { type: 'agent', id: actor.actor_id },
      recorded_by: { type: 'agent', id: actor.actor_id },
      basis: 'self',
      summary: 'Added event recording.',
      scopes: ['implementation', 'protocol'],
      affected_paths: ['.pcp/protocol/20-actor-continuity.md', 'src/index.ts'],
    });
    expect(formatRecording(result)).toContain(`Recorded event ${result.event_id}.`);
    expect(formatRecording(result)).toContain(`Payload digest: ${result.payload_digest}`);
    expect(await readFile(inputPath, 'utf8')).toContain('Added event recording.');
    expect((await validateCanonicalLayer(root)).valid).toBe(true);
  });

  it('preserves human performance and agent attribution for a reported action', async () => {
    const root = await createProject();
    const agent = await registerActor(root, { client: 'codex', machine_label: 'agent-machine' });
    const human = await registerActor(root, {
      actor_type: 'human',
      machine_label: 'human-machine',
    });
    const inputPath = await writeInput(
      eventInput(agent.actor_id, {
        actor: { type: 'human', id: human.actor_id },
        recorded_by: { type: 'agent', id: agent.actor_id },
        basis: 'reported',
        change_key: 'git:04ed219fc18831f39f866b5209b48736e4e40095',
        kind: 'vcs',
        scopes: ['version-control'],
        summary: 'Human reported signing the reviewed commit.',
        affected_paths: ['.git'],
      }),
    );

    const result = await recordEvent(root, inputPath);
    const event = await readEvent(root, result.event_id);

    expect(event.actor).toEqual({ type: 'human', id: human.actor_id });
    expect(event.recorded_by).toEqual({ type: 'agent', id: agent.actor_id });
    expect(event.basis).toBe('reported');
    expect(event.summary.toLowerCase()).not.toContain('verified');
  });

  it('records a concurrently reported human change only once by stable change key', async () => {
    const root = await createProject();
    const agent = await registerActor(root, { client: 'codex', machine_label: 'dedupe-agent' });
    const human = await registerActor(root, {
      actor_type: 'human',
      machine_label: 'dedupe-human',
    });
    const inputPath = await writeInput(
      eventInput(agent.actor_id, {
        actor: { type: 'human', id: human.actor_id },
        recorded_by: { type: 'agent', id: agent.actor_id },
        basis: 'reported',
        change_key: 'git:55bde5ddc9091424c593449c06d433c6e27e8a75',
        kind: 'vcs',
        scopes: ['version-control'],
        summary: 'Human reported one signed commit.',
        affected_paths: ['.git'],
      }),
    );

    const results = await Promise.allSettled([
      recordEvent(root, inputPath),
      recordEvent(root, inputPath),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find((result) => result.status === 'rejected');
    expect((failure as PromiseRejectedResult).reason).toMatchObject({
      code: 'PCP_RECORD_DUPLICATE_CHANGE',
      mutated: false,
    });
    expect(await eventNames(root, 'events')).toHaveLength(1);
  });

  it('rejects invalid or unknown attribution without creating an event', async () => {
    const root = await createProject();
    const agent = await registerActor(root, { client: 'codex', machine_label: 'agent-machine' });
    const human = await registerActor(root, {
      actor_type: 'human',
      machine_label: 'human-machine',
    });
    const mismatchedSelf = await writeInput(
      eventInput(agent.actor_id, {
        actor: { type: 'human', id: human.actor_id },
        basis: 'self',
      }),
    );
    const unknownActor = await writeInput(
      eventInput(agent.actor_id, {
        actor: { type: 'agent', id: 'codex-missing-0123456789' },
        basis: 'reported',
        change_key: 'external:unknown-actor-change',
      }),
    );

    await expect(recordEvent(root, mismatchedSelf)).rejects.toMatchObject({
      code: 'PCP_RECORD_ATTRIBUTION_INVALID',
      mutated: false,
    });
    await expect(recordEvent(root, unknownActor)).rejects.toMatchObject({
      code: 'PCP_RECORD_ATTRIBUTION_INVALID',
      mutated: false,
    });
    expect(await eventNames(root, 'events')).toEqual([]);
  });

  it('serializes simultaneous records into distinct globally ordered event identities', async () => {
    const root = await createProject();
    const actor = await registerActor(root, { client: 'cursor', machine_label: 'shared-machine' });
    const inputs = await Promise.all(
      ['first', 'second', 'third'].map((label) =>
        writeInput(
          eventInput(actor.actor_id, {
            summary: `Recorded the ${label} concurrent change.`,
            affected_paths: [`src/${label}.ts`],
          }),
        ),
      ),
    );

    const results = await Promise.all(inputs.map((input) => recordEvent(root, input)));
    const ids = results.map((result) => result.event_id);
    const sortedIds = [...ids].sort((left, right) => left.localeCompare(right));

    expect(new Set(ids)).toHaveLength(3);
    expect(await eventNames(root, 'events')).toEqual(sortedIds.map((id) => `${id}.yaml`));
    expect((await validateCanonicalLayer(root)).valid).toBe(true);
  });

  it('moves the oldest 32 events before writing event 65', async () => {
    const root = await createProject();
    const actor = await registerActor(root, { client: 'codex', machine_label: 'rotation-machine' });
    const nextId = monotonicFactory();
    const ids: string[] = [];
    for (let index = 0; index < 64; index += 1) {
      const eventId = nextId(1_720_000_000_000);
      ids.push(eventId);
      await writeHistoricalEvent(root, eventId, actor.actor_id);
    }
    const inputPath = await writeInput(eventInput(actor.actor_id));

    const result = await recordEvent(root, inputPath);

    expect(result.archived_events_moved).toBe(32);
    expect(result.active_events).toBe(33);
    expect(result.event_id.localeCompare(ids.at(-1) as string)).toBeGreaterThan(0);
    expect(await eventNames(root, 'archive')).toEqual(ids.slice(0, 32).map((id) => `${id}.yaml`));
    expect(await eventNames(root, 'events')).toEqual(
      [...ids.slice(32), result.event_id].map((id) => `${id}.yaml`),
    );
    expect((await validateCanonicalLayer(root)).valid).toBe(true);
  });

  it('restores exact history after every injected rotation or recording failure', async () => {
    const root = await createProject();
    const actor = await registerActor(root, {
      client: 'codex',
      machine_label: 'rollback-machine',
    });
    const nextId = monotonicFactory();
    for (let index = 0; index < 64; index += 1) {
      await writeHistoricalEvent(root, nextId(1_720_000_000_000), actor.actor_id);
    }
    const inputPath = await writeInput(eventInput(actor.actor_id));
    const before = await historySnapshot(root);

    for (let operation = 1; operation <= 34; operation += 1) {
      await expect(
        recordEvent(root, inputPath, { fail_after_operation: operation }),
      ).rejects.toMatchObject({
        code: 'PCP_FAULT_INJECTED',
        mutated: false,
        recovery_retained: false,
        recovery_paths: [],
      });
      expect(await historySnapshot(root)).toEqual(before);
      expect(await recoveryDirectories(root)).toEqual([]);
    }
    expect((await validateCanonicalLayer(root)).valid).toBe(true);
  }, 60_000);

  it('does not read archived event contents during ordinary recording', async () => {
    const root = await createProject();
    const actor = await registerActor(root, { client: 'codex', machine_label: 'archive-machine' });
    const archivedId = monotonicFactory()(Date.now() + 86_400_000);
    await writeFile(
      path.join(root, '.pcp', 'continuity', 'archive', `${archivedId}.yaml`),
      'not: [valid yaml',
      'utf8',
    );
    const inputPath = await writeInput(eventInput(actor.actor_id));

    const result = await recordEvent(root, inputPath);

    expect(result.event_id.localeCompare(archivedId)).toBeGreaterThan(0);
    expect((await validateCanonicalLayer(root, { archive_content: 'filenames-only' })).valid).toBe(
      true,
    );
    expect((await validateCanonicalLayer(root)).valid).toBe(false);
  });

  it('rejects project-local, oversized, and schema-invalid input', async () => {
    const root = await createProject();
    const actor = await registerActor(root, { client: 'codex', machine_label: 'input-machine' });
    const localInput = path.join(root, 'event.yaml');
    await writeFile(localInput, stringify(eventInput(actor.actor_id)), 'utf8');
    const oversizedRoot = await temporaryRoot('pcp-recording-oversized-');
    const oversizedInput = path.join(oversizedRoot, 'event.yaml');
    await writeFile(oversizedInput, Buffer.alloc(64 * 1024 + 1, 97));
    const invalidInput = await writeInput(eventInput(actor.actor_id, { summary: '   ' }));

    await expect(recordEvent(root, localInput)).rejects.toMatchObject({
      code: 'PCP_RECORD_INPUT_INSIDE_PROJECT',
      mutated: false,
    });
    await expect(recordEvent(root, oversizedInput)).rejects.toMatchObject({
      code: 'PCP_RECORD_INPUT_UNSAFE',
      mutated: false,
    });
    await expect(recordEvent(root, invalidInput)).rejects.toMatchObject({
      code: 'PCP_RECORD_INPUT_INVALID',
      mutated: false,
    });
    expect(await eventNames(root, 'events')).toEqual([]);
  });

  it.runIf(process.platform !== 'win32')('rejects symbolic-link input', async () => {
    const root = await createProject();
    const actor = await registerActor(root, { client: 'codex', machine_label: 'link-machine' });
    const validInput = await writeInput(eventInput(actor.actor_id));
    const linkRoot = await temporaryRoot('pcp-recording-link-');
    const linkedInput = path.join(linkRoot, 'event.yaml');
    await symlink(validInput, linkedInput, 'file');

    await expect(recordEvent(root, linkedInput)).rejects.toMatchObject({
      code: 'PCP_RECORD_INPUT_UNSAFE',
      mutated: false,
    });
    expect(await eventNames(root, 'events')).toEqual([]);
  });

  it('rejects project-local input reached through a linked parent', async () => {
    const root = await createProject();
    const actor = await registerActor(root, { client: 'codex', machine_label: 'linked-machine' });
    const localInput = path.join(root, 'event.yaml');
    await writeFile(localInput, stringify(eventInput(actor.actor_id)), 'utf8');
    const linkRoot = await temporaryRoot('pcp-recording-parent-link-');
    const linkedProject = path.join(linkRoot, 'project-link');
    await symlink(root, linkedProject, process.platform === 'win32' ? 'junction' : 'dir');

    await expect(recordEvent(root, path.join(linkedProject, 'event.yaml'))).rejects.toMatchObject({
      code: 'PCP_RECORD_INPUT_INSIDE_PROJECT',
      mutated: false,
    });
    expect(await eventNames(root, 'events')).toEqual([]);
  });

  it('exposes stable structured JSON through the CLI', async () => {
    const root = await createProject();
    const actor = await registerActor(root, { client: 'codex', machine_label: 'cli-machine' });
    const inputPath = await writeInput(eventInput(actor.actor_id));
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;

    try {
      await createProgram().parseAsync([
        'node',
        'pcp',
        'record',
        root,
        '--input',
        inputPath,
        '--json',
      ]);
      expect(JSON.parse(String(output.mock.calls.at(-1)?.[0]))).toMatchObject({
        command: 'record',
        status: 'recorded',
        event_created: true,
        mutated: true,
      });
      expect(process.exitCode).toBeUndefined();
    } finally {
      process.exitCode = previousExitCode;
      output.mockRestore();
    }
  });
});
