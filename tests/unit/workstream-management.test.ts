import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { monotonicFactory } from 'ulid';
import { parse, stringify } from 'yaml';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  mutateWorkstream,
  validateWorkstreamRegistry,
} from '../../src/application/manage-workstreams.js';
import { registerActor } from '../../src/application/register-actor.js';
import { validateCanonicalLayer } from '../../src/application/validate-canonical-layer.js';
import { createProgram } from '../../src/cli/main.js';
import type { ContinuityEvent, WorkstreamState } from '../../src/domain/reconciliation.js';
import { eventPayloadDigest } from '../../src/domain/recording.js';
import type {
  CompleteWorkstreamInput,
  CreateWorkstreamInput,
  UpdateWorkstreamInput,
  WorkstreamRegistry,
} from '../../src/domain/workstreams.js';
import { formatWorkstream } from '../../src/presentation/format-workstream.js';

const coreTemplate = fileURLToPath(new URL('../../templates/core/.pcp/', import.meta.url));
const temporaryRoots: string[] = [];

async function temporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

async function createProject(): Promise<string> {
  const root = await temporaryRoot('pcp-workstream-project-');
  await cp(coreTemplate, path.join(root, '.pcp'), { recursive: true });
  return root;
}

function workstream(
  workstreamId: string,
  overrides: Partial<WorkstreamState> = {},
): WorkstreamState {
  return {
    workstream_id: workstreamId,
    name: workstreamId,
    kind: 'sequential',
    status: 'active',
    paths: [`src/${workstreamId}`],
    areas: ['implementation'],
    dependencies: [],
    completion: { criteria: [`${workstreamId} is complete.`], evidence: [] },
    ...overrides,
  };
}

function operationBase(actorId: string, digest: string) {
  return {
    schema_version: 1 as const,
    expected_registry_digest: digest,
    actor: { type: 'agent' as const, id: actorId },
    recorded_by: { type: 'agent' as const, id: actorId },
    basis: 'self' as const,
    summary: 'Updated the canonical workstream registry.',
  };
}

function createInput(
  actorId: string,
  digest: string,
  state: WorkstreamState,
): CreateWorkstreamInput {
  return { ...operationBase(actorId, digest), operation: 'create', workstream: state };
}

function updateInput(
  actorId: string,
  digest: string,
  state: WorkstreamState,
): UpdateWorkstreamInput {
  return { ...operationBase(actorId, digest), operation: 'update', workstream: state };
}

function completeInput(
  actorId: string,
  digest: string,
  workstreamId: string,
  criteria: string[],
  announcement = `${workstreamId} is complete and ready for dependent work.`,
): CompleteWorkstreamInput {
  return {
    ...operationBase(actorId, digest),
    operation: 'complete',
    workstream_id: workstreamId,
    evidence: criteria.map((criterion) => ({ criterion, proof: `Verified: ${criterion}` })),
    announcement,
  };
}

async function writeInput(value: unknown): Promise<string> {
  const root = await temporaryRoot('pcp-workstream-input-');
  const inputPath = path.join(root, 'workstream.yaml');
  await writeFile(inputPath, stringify(value), 'utf8');
  return inputPath;
}

async function readRegistry(root: string): Promise<WorkstreamRegistry> {
  return parse(
    await readFile(path.join(root, '.pcp', 'state', 'workstreams.yaml'), 'utf8'),
  ) as WorkstreamRegistry;
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

async function projectSnapshot(root: string): Promise<Record<string, unknown>> {
  const history: Record<string, Record<string, string>> = {};
  for (const directory of ['events', 'archive'] as const) {
    const contents: Record<string, string> = {};
    for (const name of await eventNames(root, directory)) {
      contents[name] = await readFile(
        path.join(root, '.pcp', 'continuity', directory, name),
        'utf8',
      );
    }
    history[directory] = contents;
  }
  return {
    registry: await readFile(path.join(root, '.pcp', 'state', 'workstreams.yaml'), 'utf8'),
    status_view: await readFile(path.join(root, '.pcp', 'views', '10-status.generated.md'), 'utf8'),
    history,
  };
}

async function recoveryDirectories(root: string): Promise<string[]> {
  const resolved = path.resolve(root);
  const portable = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  const digest = createHash('sha256').update(portable).digest('hex').slice(0, 12);
  return (await readdir(tmpdir()))
    .filter(
      (name) =>
        name.startsWith(`pcp-workstream-transaction-${digest}-`) ||
        name.startsWith(`pcp-event-transaction-${digest}-`),
    )
    .sort();
}

async function writeHistoricalEvent(root: string, event: ContinuityEvent): Promise<void> {
  await writeFile(
    path.join(root, '.pcp', 'continuity', 'events', `${event.event_id}.yaml`),
    stringify(event),
    'utf8',
  );
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('workstream management', () => {
  it('validates without mutation and returns the exact registry digest', async () => {
    const root = await createProject();
    const before = await projectSnapshot(root);
    const bytes = await readFile(path.join(root, '.pcp', 'state', 'workstreams.yaml'));

    const result = await validateWorkstreamRegistry(root);

    expect(result).toEqual({
      schema_version: 1,
      command: 'workstream',
      operation: 'validate',
      status: 'valid',
      registry_path: '.pcp/state/workstreams.yaml',
      registry_digest: createHash('sha256').update(bytes).digest('hex'),
      workstream_count: 0,
      workstream: null,
      diagnostics: [],
      event_created: false,
      mutated: false,
    });
    expect(formatWorkstream(result)).toContain(`Registry digest: ${result.registry_digest}`);
    expect(await projectSnapshot(root)).toEqual(before);
  });

  it('creates normalized canonical state and one attributed event atomically', async () => {
    const root = await createProject();
    const actor = await registerActor(root, { client: 'codex', machine_label: 'create-machine' });
    const preview = await validateWorkstreamRegistry(root);
    const state = workstream('implementation', {
      name: '  Implementation  ',
      kind: 'concurrent',
      status: 'planned',
      paths: ['tests', 'src'],
      areas: ['validation', 'implementation'],
      completion: {
        criteria: ['  Tests pass.  ', 'Implementation is reviewed.'],
        evidence: [],
      },
    });
    const inputPath = await writeInput(createInput(actor.actor_id, preview.registry_digest, state));

    const result = await mutateWorkstream(root, 'create', inputPath);
    const registry = await readRegistry(root);
    const event = await readEvent(root, result.event_id);

    expect(result).toMatchObject({
      command: 'workstream',
      operation: 'create',
      status: 'created',
      workstream_id: 'implementation',
      event_created: true,
      mutated: true,
      recovery_retained: false,
    });
    expect(result.event_payload_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(registry.workstreams).toEqual([
      workstream('implementation', {
        name: 'Implementation',
        kind: 'concurrent',
        status: 'planned',
        paths: ['src', 'tests'],
        areas: ['implementation', 'validation'],
        completion: {
          criteria: ['Implementation is reviewed.', 'Tests pass.'],
          evidence: [],
        },
      }),
    ]);
    expect(event).toMatchObject({
      actor: { type: 'agent', id: actor.actor_id },
      recorded_by: { type: 'agent', id: actor.actor_id },
      basis: 'self',
      kind: 'workstream',
      scopes: ['workstream-registry'],
      workstreams: ['implementation'],
      affected_paths: ['.pcp/state/workstreams.yaml', '.pcp/views/10-status.generated.md'],
    });
    expect(result.registry_digest_after).toBe(
      (await validateWorkstreamRegistry(root, 'implementation')).registry_digest,
    );
    expect(formatWorkstream(result)).toContain('Created workstream implementation.');
    expect((await validateCanonicalLayer(root)).valid).toBe(true);
  });

  it('enforces update transitions, immutable kind, and the completion boundary', async () => {
    const root = await createProject();
    const actor = await registerActor(root, { client: 'cursor', machine_label: 'update-machine' });
    let digest = (await validateWorkstreamRegistry(root)).registry_digest;
    await mutateWorkstream(
      root,
      'create',
      await writeInput(
        createInput(actor.actor_id, digest, workstream('delivery', { status: 'planned' })),
      ),
    );
    digest = (await validateWorkstreamRegistry(root)).registry_digest;

    const updated = workstream('delivery', { status: 'active', areas: ['release'] });
    const updateResult = await mutateWorkstream(
      root,
      'update',
      await writeInput(updateInput(actor.actor_id, digest, updated)),
    );
    expect(updateResult.status).toBe('updated');

    digest = updateResult.registry_digest_after;
    const beforeRejected = await projectSnapshot(root);
    await expect(
      mutateWorkstream(
        root,
        'update',
        await writeInput(
          updateInput(actor.actor_id, digest, { ...updated, kind: 'ceb', status: 'blocked' }),
        ),
      ),
    ).rejects.toMatchObject({ code: 'PCP_WORKSTREAM_KIND_IMMUTABLE', mutated: false });
    await expect(
      mutateWorkstream(
        root,
        'update',
        await writeInput(updateInput(actor.actor_id, digest, { ...updated, status: 'complete' })),
      ),
    ).rejects.toMatchObject({ code: 'PCP_WORKSTREAM_COMPLETE_REQUIRED', mutated: false });
    expect(await projectSnapshot(root)).toEqual(beforeRejected);
  });

  it('serializes competing digest-bound plans so only one stale-free mutation wins', async () => {
    const root = await createProject();
    const actor = await registerActor(root, {
      client: 'github-copilot-vscode',
      machine_label: 'concurrency-machine',
    });
    const digest = (await validateWorkstreamRegistry(root)).registry_digest;
    const inputs = await Promise.all(
      ['alpha', 'beta'].map((id) =>
        writeInput(createInput(actor.actor_id, digest, workstream(id, { status: 'planned' }))),
      ),
    );

    const results = await Promise.allSettled(
      inputs.map((input) => mutateWorkstream(root, 'create', input)),
    );
    const successes = results.filter((result) => result.status === 'fulfilled');
    const failures = results.filter((result) => result.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect((failures[0] as PromiseRejectedResult).reason).toMatchObject({
      code: 'PCP_WORKSTREAM_REGISTRY_CHANGED',
      mutated: false,
    });
    expect((await readRegistry(root)).workstreams).toHaveLength(1);
    expect(await eventNames(root, 'events')).toHaveLength(1);
  });

  it('completes generic and CEB work only with dependency-safe criterion evidence', async () => {
    const root = await createProject();
    const actor = await registerActor(root, {
      client: 'claude-code-desktop',
      machine_label: 'completion-machine',
    });
    const foundation = workstream('foundation');
    const delivery = workstream('delivery-ceb', {
      kind: 'ceb',
      dependencies: ['foundation'],
      completion: {
        criteria: ['Checks pass.', 'Handoff is ready.'],
        evidence: [],
      },
    });
    let digest = (await validateWorkstreamRegistry(root)).registry_digest;
    const foundationCreate = await mutateWorkstream(
      root,
      'create',
      await writeInput(createInput(actor.actor_id, digest, foundation)),
    );
    digest = foundationCreate.registry_digest_after;
    const deliveryCreate = await mutateWorkstream(
      root,
      'create',
      await writeInput(createInput(actor.actor_id, digest, delivery)),
    );
    digest = deliveryCreate.registry_digest_after;
    const beforeRejected = await projectSnapshot(root);

    await expect(
      mutateWorkstream(
        root,
        'complete',
        await writeInput(
          completeInput(
            actor.actor_id,
            digest,
            delivery.workstream_id,
            delivery.completion.criteria,
          ),
        ),
      ),
    ).rejects.toMatchObject({
      code: 'PCP_WORKSTREAM_DEPENDENCY_INCOMPLETE',
      mutated: false,
    });
    await expect(
      mutateWorkstream(
        root,
        'complete',
        await writeInput({
          ...completeInput(
            actor.actor_id,
            digest,
            delivery.workstream_id,
            delivery.completion.criteria,
          ),
          evidence: [
            { criterion: 'Checks pass.', proof: 'Checks passed.' },
            { criterion: 'Checks pass.', proof: 'Checks passed again.' },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: 'PCP_WORKSTREAM_EVIDENCE_DUPLICATE', mutated: false });
    expect(await projectSnapshot(root)).toEqual(beforeRejected);

    const foundationComplete = await mutateWorkstream(
      root,
      'complete',
      await writeInput(
        completeInput(
          actor.actor_id,
          digest,
          foundation.workstream_id,
          foundation.completion.criteria,
        ),
      ),
    );
    digest = foundationComplete.registry_digest_after;
    const deliveryComplete = await mutateWorkstream(
      root,
      'complete',
      await writeInput(
        completeInput(
          actor.actor_id,
          digest,
          delivery.workstream_id,
          delivery.completion.criteria,
          'Delivery CEB is complete; dependent work may begin.',
        ),
      ),
    );
    const selected = await validateWorkstreamRegistry(root, delivery.workstream_id);

    expect(deliveryComplete).toMatchObject({
      operation: 'complete',
      status: 'completed',
      announcement: 'Delivery CEB is complete; dependent work may begin.',
      event_created: true,
      mutated: true,
    });
    expect(selected.workstream).toMatchObject({
      kind: 'ceb',
      status: 'complete',
      completion: { announcement: 'Delivery CEB is complete; dependent work may begin.' },
    });
    expect(selected.workstream?.completion.evidence).toHaveLength(2);
    expect(formatWorkstream(deliveryComplete)).toContain(
      'Announcement: Delivery CEB is complete; dependent work may begin.',
    );
    expect((await validateCanonicalLayer(root)).valid).toBe(true);
  });

  it('rejects stale input and unsafe project-local input without mutation', async () => {
    const root = await createProject();
    const actor = await registerActor(root, { client: 'codex', machine_label: 'input-machine' });
    const digest = (await validateWorkstreamRegistry(root)).registry_digest;
    const localInput = path.join(root, 'workstream.yaml');
    await writeFile(
      localInput,
      stringify(createInput(actor.actor_id, digest, workstream('local'))),
      'utf8',
    );
    const before = await projectSnapshot(root);

    await expect(mutateWorkstream(root, 'create', localInput)).rejects.toMatchObject({
      code: 'PCP_WORKSTREAM_INPUT_INSIDE_PROJECT',
      mutated: false,
    });
    await expect(
      mutateWorkstream(
        root,
        'create',
        await writeInput(createInput(actor.actor_id, 'a'.repeat(64), workstream('stale'))),
      ),
    ).rejects.toMatchObject({ code: 'PCP_WORKSTREAM_REGISTRY_CHANGED', mutated: false });
    expect(await projectSnapshot(root)).toEqual(before);
  });

  it.runIf(process.platform !== 'win32')('rejects symbolic-link input', async () => {
    const root = await createProject();
    const actor = await registerActor(root, { client: 'codex', machine_label: 'link-machine' });
    const digest = (await validateWorkstreamRegistry(root)).registry_digest;
    const input = await writeInput(createInput(actor.actor_id, digest, workstream('linked')));
    const linkRoot = await temporaryRoot('pcp-workstream-link-');
    const linkedInput = path.join(linkRoot, 'workstream.yaml');
    await symlink(input, linkedInput, 'file');

    await expect(mutateWorkstream(root, 'create', linkedInput)).rejects.toMatchObject({
      code: 'PCP_WORKSTREAM_INPUT_UNSAFE',
      mutated: false,
    });
    expect(await eventNames(root, 'events')).toEqual([]);
  });

  it('rejects project-local input reached through a linked parent', async () => {
    const root = await createProject();
    const actor = await registerActor(root, {
      client: 'codex',
      machine_label: 'parent-link-machine',
    });
    const digest = (await validateWorkstreamRegistry(root)).registry_digest;
    const localInput = path.join(root, 'workstream.yaml');
    await writeFile(
      localInput,
      stringify(createInput(actor.actor_id, digest, workstream('linked-parent'))),
      'utf8',
    );
    const linkRoot = await temporaryRoot('pcp-workstream-parent-link-');
    const linkedProject = path.join(linkRoot, 'project-link');
    await symlink(root, linkedProject, process.platform === 'win32' ? 'junction' : 'dir');

    await expect(
      mutateWorkstream(root, 'create', path.join(linkedProject, 'workstream.yaml')),
    ).rejects.toMatchObject({ code: 'PCP_WORKSTREAM_INPUT_INSIDE_PROJECT', mutated: false });
    expect(await eventNames(root, 'events')).toEqual([]);
  });

  it('restores exact registry and history after every non-rotation fault boundary', async () => {
    const root = await createProject();
    const actor = await registerActor(root, {
      client: 'codex',
      machine_label: 'rollback-machine',
    });
    const digest = (await validateWorkstreamRegistry(root)).registry_digest;
    const input = await writeInput(createInput(actor.actor_id, digest, workstream('rollback')));
    const before = await projectSnapshot(root);

    for (let operation = 1; operation <= 4; operation += 1) {
      await expect(
        mutateWorkstream(root, 'create', input, { fail_after_operation: operation }),
      ).rejects.toMatchObject({ code: 'PCP_FAULT_INJECTED', mutated: false });
      expect(await projectSnapshot(root)).toEqual(before);
      expect(await recoveryDirectories(root)).toEqual([]);
    }
    expect((await validateCanonicalLayer(root)).valid).toBe(true);
  });

  it('restores exact registry and rotating history after every transaction fault boundary', async () => {
    const root = await createProject();
    const actor = await registerActor(root, {
      client: 'codex',
      machine_label: 'rotation-rollback-machine',
    });
    const nextId = monotonicFactory();
    for (let index = 0; index < 64; index += 1) {
      const eventId = nextId(1_720_000_000_000);
      const payload = {
        schema_version: 1,
        event_id: eventId,
        occurred_at: '2024-07-03T09:46:40Z',
        actor: { type: 'agent', id: actor.actor_id },
        recorded_by: { type: 'agent', id: actor.actor_id },
        basis: 'self',
        kind: 'code',
        scopes: ['implementation'],
        workstreams: [],
        summary: `Recorded historical change ${eventId}.`,
        affected_paths: ['src/index.ts'],
      } satisfies Omit<ContinuityEvent, 'payload_digest'>;
      await writeHistoricalEvent(root, {
        ...payload,
        payload_digest: eventPayloadDigest(payload),
      });
    }
    const digest = (await validateWorkstreamRegistry(root)).registry_digest;
    const input = await writeInput(
      createInput(actor.actor_id, digest, workstream('rotation-rollback')),
    );
    const before = await projectSnapshot(root);

    for (let operation = 1; operation <= 36; operation += 1) {
      await expect(
        mutateWorkstream(root, 'create', input, { fail_after_operation: operation }),
      ).rejects.toMatchObject({ code: 'PCP_FAULT_INJECTED', mutated: false });
      expect(await projectSnapshot(root)).toEqual(before);
      expect(await recoveryDirectories(root)).toEqual([]);
    }
    expect((await validateCanonicalLayer(root)).valid).toBe(true);
  }, 45_000);

  it('uses archive filenames without reading archived contents during ordinary operation', async () => {
    const root = await createProject();
    const actor = await registerActor(root, { client: 'codex', machine_label: 'archive-machine' });
    const archivedId = monotonicFactory()(Date.now() + 86_400_000);
    await writeFile(
      path.join(root, '.pcp', 'continuity', 'archive', `${archivedId}.yaml`),
      'not: [valid yaml',
      'utf8',
    );
    const preview = await validateWorkstreamRegistry(root);
    const result = await mutateWorkstream(
      root,
      'create',
      await writeInput(
        createInput(actor.actor_id, preview.registry_digest, workstream('archive-safe')),
      ),
    );

    expect(result.status).toBe('created');
    expect(result.event_id.localeCompare(archivedId)).toBeGreaterThan(0);
    expect((await validateCanonicalLayer(root, { archive_content: 'filenames-only' })).valid).toBe(
      true,
    );
    expect((await validateCanonicalLayer(root)).valid).toBe(false);
  });

  it('exposes stable structured workstream JSON through the CLI', async () => {
    const root = await createProject();
    const actor = await registerActor(root, { client: 'codex', machine_label: 'cli-machine' });
    const digest = (await validateWorkstreamRegistry(root)).registry_digest;
    const input = await writeInput(
      createInput(actor.actor_id, digest, workstream('cli-workstream', { status: 'planned' })),
    );
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;

    try {
      await createProgram().parseAsync([
        'node',
        'pcp',
        'workstream',
        'create',
        root,
        '--input',
        input,
        '--json',
      ]);
      expect(JSON.parse(String(output.mock.calls.at(-1)?.[0]))).toMatchObject({
        command: 'workstream',
        operation: 'create',
        status: 'created',
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
