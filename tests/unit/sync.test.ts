import { cp, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { stringify } from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';

import { registerActor } from '../../src/application/register-actor.js';
import { synchronizeProject } from '../../src/application/synchronize-project.js';
import type { ContinuityEvent } from '../../src/domain/reconciliation.js';
import { eventPayloadDigest } from '../../src/domain/recording.js';
import { formatSync } from '../../src/presentation/format-sync.js';

const coreTemplate = fileURLToPath(new URL('../../templates/core/.pcp/', import.meta.url));
const temporaryRoots: string[] = [];
const eventIds = ['01ARZ3NDEKTSV4RRFFQ69G5FAA', '01ARZ3NDEKTSV4RRFFQ69G5FAB'] as const;

async function createProject(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'pcp-sync-'));
  temporaryRoots.push(root);
  await cp(coreTemplate, path.join(root, '.pcp'), { recursive: true });
  return root;
}

async function checkpointFiles(root: string): Promise<string[]> {
  return (await readdir(path.join(root, '.pcp', 'continuity', 'checkpoints')))
    .filter((entry) => entry.endsWith('.yaml'))
    .sort();
}

async function writeEvent(
  root: string,
  actorId: string,
  eventId: string,
  affectedPath: string,
): Promise<void> {
  const payload = {
    schema_version: 1 as const,
    event_id: eventId,
    occurred_at: '2026-08-13T00:00:00Z',
    actor: { type: 'agent' as const, id: actorId },
    recorded_by: { type: 'agent' as const, id: actorId },
    basis: 'self' as const,
    kind: 'code' as const,
    scopes: ['implementation'],
    workstreams: [],
    summary: `Updated ${affectedPath}.`,
    affected_paths: [affectedPath],
  };
  const event: ContinuityEvent = {
    ...payload,
    payload_digest: eventPayloadDigest(payload),
  };
  await writeFile(
    path.join(root, '.pcp', 'continuity', 'events', `${eventId}.yaml`),
    stringify(event),
    'utf8',
  );
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('pcp sync', () => {
  it('establishes one digest-bound execution baseline and has a concise no-change path', async () => {
    const root = await createProject();
    const registration = await registerActor(root, {
      client: 'codex',
      machine_label: 'sync-machine',
    });
    const input = {
      actor_id: registration.actor_id,
      execution_id: registration.execution_id,
    };

    const preview = await synchronizeProject(root, input);
    const repeated = await synchronizeProject(root, input);
    expect(preview).toMatchObject({
      command: 'sync',
      mode: 'preview',
      checkpoint: {
        state: 'missing',
        checkpoint_id: registration.execution_id,
      },
      baseline: {
        required: true,
        reason: 'first-execution-baseline',
        context_paths: ['.pcp/00-index.md'],
      },
      changes: [],
      acknowledgement: { required: true, accepted: false },
      mutated: false,
    });
    expect(repeated.sync_digest).toBe(preview.sync_digest);
    expect(await checkpointFiles(root)).toEqual([]);

    const acknowledged = await synchronizeProject(root, {
      ...input,
      acknowledge: preview.sync_digest,
    });
    expect(acknowledged).toMatchObject({
      mode: 'acknowledge',
      checkpoint: { state: 'current', previous_state: 'missing' },
      acknowledgement: { required: true, accepted: true },
      mutated: true,
    });
    expect(await checkpointFiles(root)).toEqual([`${registration.execution_id}.yaml`]);

    const current = await synchronizeProject(root, input);
    expect(current).toMatchObject({
      checkpoint: { state: 'current' },
      changes: [],
      required_context_paths: [],
      acknowledgement: { required: false, accepted: false },
      mutated: false,
    });
    expect(formatSync(current)).toContain('PCP sync: current — no project updates.');
  });

  it('returns every newer event with attribution and current paths', async () => {
    const root = await createProject();
    const registration = await registerActor(root, {
      client: 'codex',
      machine_label: 'changes-machine',
    });
    const input = {
      actor_id: registration.actor_id,
      execution_id: registration.execution_id,
    };
    const baseline = await synchronizeProject(root, input);
    await synchronizeProject(root, { ...input, acknowledge: baseline.sync_digest });

    await writeEvent(root, registration.actor_id, eventIds[0], 'src/feature.ts');
    await writeEvent(root, registration.actor_id, eventIds[1], 'docs/feature.md');
    const pending = await synchronizeProject(root, input);

    expect(pending.checkpoint.state).toBe('changes-pending');
    expect(pending.changes.map((change) => change.event_id)).toEqual(eventIds);
    expect(pending.required_context_paths).toEqual(['docs/feature.md', 'src/feature.ts']);
    expect(pending.changes[0]).toMatchObject({
      actor: { type: 'agent', id: registration.actor_id },
      recorded_by: { type: 'agent', id: registration.actor_id },
      basis: 'self',
    });
    const text = formatSync(pending);
    expect(text).toContain(`Event ${eventIds[0]}`);
    expect(text).toContain('Affected paths: src/feature.ts');
    expect(text).toContain(`acknowledge digest ${pending.sync_digest}`);
  });

  it('keeps simultaneous conversations for one actor independent', async () => {
    const root = await createProject();
    const first = await registerActor(root, { client: 'codex', machine_label: 'thread-machine' });
    const second = await registerActor(root, {
      client: 'codex',
      machine_label: 'thread-machine',
      actor_id: first.actor_id,
    });
    const firstInput = { actor_id: first.actor_id, execution_id: first.execution_id };
    const secondInput = { actor_id: second.actor_id, execution_id: second.execution_id };

    for (const input of [firstInput, secondInput]) {
      const baseline = await synchronizeProject(root, input);
      await synchronizeProject(root, { ...input, acknowledge: baseline.sync_digest });
    }
    await writeEvent(root, first.actor_id, eventIds[0], 'src/shared.ts');

    const firstPending = await synchronizeProject(root, firstInput);
    await synchronizeProject(root, { ...firstInput, acknowledge: firstPending.sync_digest });
    const secondPending = await synchronizeProject(root, secondInput);

    expect(secondPending.changes.map((change) => change.event_id)).toEqual([eventIds[0]]);
    expect(await checkpointFiles(root)).toEqual(
      [`${first.execution_id}.yaml`, `${second.execution_id}.yaml`].sort(),
    );
  });

  it('rejects a stale acknowledgement digest without advancing', async () => {
    const root = await createProject();
    const registration = await registerActor(root, {
      client: 'codex',
      machine_label: 'stale-machine',
    });
    const input = {
      actor_id: registration.actor_id,
      execution_id: registration.execution_id,
    };
    const preview = await synchronizeProject(root, input);
    await writeEvent(root, registration.actor_id, eventIds[0], 'src/new.ts');

    await expect(
      synchronizeProject(root, { ...input, acknowledge: preview.sync_digest }),
    ).rejects.toMatchObject({ code: 'PCP_SYNC_DIGEST_MISMATCH', mutated: false });
    expect(await checkpointFiles(root)).toEqual([]);
  });
});
