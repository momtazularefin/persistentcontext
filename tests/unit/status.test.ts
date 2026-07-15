import { cp, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { stringify } from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';

import { registerActor } from '../../src/application/register-actor.js';
import { reportStatus } from '../../src/application/report-status.js';
import type {
  ContinuityEvent,
  ReconciliationCheckpoint,
  WorkstreamState,
} from '../../src/domain/reconciliation.js';
import { eventPayloadDigest } from '../../src/domain/recording.js';
import { formatStatus } from '../../src/presentation/format-status.js';

const coreTemplate = fileURLToPath(new URL('../../templates/core/.pcp/', import.meta.url));
const temporaryRoots: string[] = [];
const eventIds = [
  '01ARZ3NDEKTSV4RRFFQ69G5FAA',
  '01ARZ3NDEKTSV4RRFFQ69G5FAB',
  '01ARZ3NDEKTSV4RRFFQ69G5FAC',
  '01ARZ3NDEKTSV4RRFFQ69G5FAD',
  '01ARZ3NDEKTSV4RRFFQ69G5FAE',
  '01ARZ3NDEKTSV4RRFFQ69G5FAF',
] as const;

async function createProject(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'pcp-status-'));
  temporaryRoots.push(root);
  await cp(coreTemplate, path.join(root, '.pcp'), { recursive: true });
  return root;
}

async function yamlFiles(root: string, directory: string): Promise<string[]> {
  return (await readdir(path.join(root, '.pcp', 'continuity', directory)))
    .filter((entry) => entry.endsWith('.yaml'))
    .sort();
}

function workstream(
  workstreamId: string,
  input: Partial<Pick<WorkstreamState, 'paths' | 'areas' | 'dependencies'>> = {},
): WorkstreamState {
  return {
    workstream_id: workstreamId,
    name: workstreamId,
    kind: 'sequential',
    status: 'active',
    paths: input.paths ?? [],
    areas: input.areas ?? [],
    dependencies: input.dependencies ?? [],
    completion: { criteria: ['Done.'], evidence: [] },
  };
}

async function writeWorkstreams(root: string, workstreams: WorkstreamState[]): Promise<void> {
  await writeFile(
    path.join(root, '.pcp', 'state', 'workstreams.yaml'),
    stringify({ schema_version: 1, workstreams }),
    'utf8',
  );
}

async function writeEvent(
  root: string,
  actorId: string,
  eventId: string,
  input: Partial<ContinuityEvent>,
): Promise<void> {
  const payload = {
    schema_version: 1,
    event_id: eventId,
    occurred_at: '2026-07-15T00:00:00Z',
    actor: { type: 'agent', id: actorId },
    recorded_by: { type: 'agent', id: actorId },
    basis: 'self',
    kind: 'configuration',
    scopes: [],
    workstreams: [],
    summary: 'Updated current project state.',
    affected_paths: [],
    ...input,
  } as Record<string, unknown>;
  delete payload.payload_digest;
  const event = {
    ...payload,
    payload_digest: eventPayloadDigest(payload),
  } as unknown as ContinuityEvent;
  await writeFile(
    path.join(root, '.pcp', 'continuity', 'events', `${eventId}.yaml`),
    stringify(event),
    'utf8',
  );
}

async function writeCheckpoint(root: string, checkpoint: ReconciliationCheckpoint): Promise<void> {
  await writeFile(
    path.join(root, '.pcp', 'continuity', 'checkpoints', `${checkpoint.checkpoint_id}.yaml`),
    stringify(checkpoint),
    'utf8',
  );
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('pcp status', () => {
  it('previews without mutation and advances a digest-bound checkpoint without an event', async () => {
    const root = await createProject();
    const actor = await registerActor(root, { client: 'codex', machine_label: 'status-machine' });
    const input = { actor_id: actor.actor_id, scopes: ['implementation'] };

    const preview = await reportStatus(root, input);
    const repeated = await reportStatus(root, input);

    expect(preview).toMatchObject({
      command: 'status',
      mode: 'preview',
      checkpoint: { state: 'missing' },
      baseline: { required: true, reason: 'first-scope-baseline' },
      acknowledgement: { required: true, accepted: false },
      event_created: false,
      mutated: false,
    });
    expect(repeated.status_digest).toBe(preview.status_digest);
    expect(formatStatus(preview)).toContain('Checkpoint: missing');
    expect(formatStatus(preview)).toContain(`acknowledge digest ${preview.status_digest}`);
    expect(await yamlFiles(root, 'checkpoints')).toEqual([]);
    expect(await yamlFiles(root, 'events')).toEqual([]);

    const acknowledged = await reportStatus(root, {
      ...input,
      acknowledge: preview.status_digest,
    });
    expect(acknowledged).toMatchObject({
      mode: 'acknowledge',
      checkpoint: { state: 'current', previous_state: 'missing', last_event_id: null },
      acknowledgement: { required: true, accepted: true },
      event_created: false,
      mutated: true,
    });
    expect(formatStatus(acknowledged)).toContain('checkpoint advanced');
    expect(await yamlFiles(root, 'checkpoints')).toHaveLength(1);
    expect(await yamlFiles(root, 'events')).toEqual([]);

    const current = await reportStatus(root, input);
    expect(current).toMatchObject({
      checkpoint: { state: 'current' },
      acknowledgement: { required: false, accepted: false },
      mutated: false,
    });
    expect(formatStatus(current)).toContain('No acknowledgement is needed.');
    const noOpAcknowledgement = await reportStatus(root, {
      ...input,
      acknowledge: current.status_digest,
    });
    expect(noOpAcknowledgement).toMatchObject({
      mode: 'acknowledge',
      acknowledgement: { required: false, accepted: true },
      mutated: false,
    });
    expect(formatStatus(noOpAcknowledgement)).toContain('checkpoint was already current');

    await writeEvent(root, actor.actor_id, eventIds[0], {
      scopes: ['implementation'],
      affected_paths: ['src/status.ts'],
    });
    const pending = await reportStatus(root, input);
    expect(pending).toMatchObject({
      checkpoint: { state: 'changes-pending' },
      acknowledgement: { required: true },
      mutated: false,
    });
    expect(formatStatus(pending)).toContain('Relevant: 1 change');
    expect(formatStatus(pending)).toContain('Read current state: src/status.ts');
    const advanced = await reportStatus(root, {
      ...input,
      acknowledge: pending.status_digest,
    });
    expect(advanced).toMatchObject({
      checkpoint: {
        state: 'current',
        previous_state: 'changes-pending',
        checkpoint_id: acknowledged.checkpoint.checkpoint_id,
        last_event_id: eventIds[0],
      },
      mutated: true,
      event_created: false,
    });
    expect(await yamlFiles(root, 'checkpoints')).toHaveLength(1);
    expect(await yamlFiles(root, 'events')).toEqual([`${eventIds[0]}.yaml`]);
  });

  it('rejects a stale or incorrect acknowledgement without creating a checkpoint', async () => {
    const root = await createProject();
    const actor = await registerActor(root, { client: 'cursor', machine_label: 'status-machine' });
    const preview = await reportStatus(root, { actor_id: actor.actor_id });
    await writeEvent(root, actor.actor_id, eventIds[0], {
      scopes: ['implementation'],
      affected_paths: ['src/new-change.ts'],
    });

    await expect(
      reportStatus(root, { actor_id: actor.actor_id, acknowledge: preview.status_digest }),
    ).rejects.toMatchObject({ code: 'PCP_STATUS_DIGEST_MISMATCH', mutated: false });
    expect(await yamlFiles(root, 'checkpoints')).toEqual([]);
  });

  it('classifies dependencies, shared state, path overlap, and unrelated work', async () => {
    const root = await createProject();
    const actor = await registerActor(root, { client: 'codex', machine_label: 'scope-machine' });
    await writeWorkstreams(root, [
      workstream('foundation', { paths: ['src/shared'], areas: ['architecture'] }),
      workstream('feature', {
        paths: ['src/feature'],
        areas: ['implementation'],
        dependencies: ['foundation'],
      }),
      workstream('unrelated', { paths: ['docs/other'], areas: ['writing'] }),
    ]);

    await writeEvent(root, actor.actor_id, eventIds[0], {
      workstreams: ['foundation'],
      affected_paths: ['src/foundation.ts'],
      summary: 'Changed a dependency workstream.',
    });
    await writeEvent(root, actor.actor_id, eventIds[1], {
      workstreams: ['unrelated'],
      affected_paths: ['.pcp/state/vcs-policy.yaml'],
      summary: 'Updated the shared VCS policy.',
    });
    await writeEvent(root, actor.actor_id, eventIds[2], {
      workstreams: ['unrelated'],
      affected_paths: ['.pcp/state/projects.yaml'],
      summary: 'Updated the project registry.',
    });
    await writeEvent(root, actor.actor_id, eventIds[3], {
      workstreams: ['unrelated'],
      affected_paths: ['src/shared/parser.ts'],
      summary: 'Changed an overlapping path.',
    });
    await writeEvent(root, actor.actor_id, eventIds[4], {
      workstreams: ['unrelated'],
      scopes: ['writing'],
      affected_paths: ['docs/other/guide.md'],
      summary: 'Changed unrelated documentation.',
    });

    const result = await reportStatus(root, {
      actor_id: actor.actor_id,
      workstream_id: 'feature',
    });

    expect(result.relevant_changes.map((item) => item.event_id)).toEqual(eventIds.slice(0, 4));
    expect(result.relevant_changes.map((item) => item.relevance_reasons)).toEqual([
      ['dependency-workstream'],
      ['shared-policy'],
      ['project-registry'],
      ['path-overlap'],
    ]);
    expect(result.out_of_scope_changes.map((item) => item.event_id)).toEqual([eventIds[4]]);
    expect(result.out_of_scope_changes[0]?.relevance_reasons).toEqual([]);
  });

  it('advances past visible out-of-scope events without requiring their project paths', async () => {
    const root = await createProject();
    const actor = await registerActor(root, { client: 'codex', machine_label: 'parallel-machine' });
    await writeWorkstreams(root, [
      workstream('feature', { paths: ['src/feature'], areas: ['implementation'] }),
      workstream('unrelated', { paths: ['docs/other'], areas: ['writing'] }),
    ]);
    const input = { actor_id: actor.actor_id, workstream_id: 'feature' };
    const baseline = await reportStatus(root, input);
    await reportStatus(root, { ...input, acknowledge: baseline.status_digest });
    await writeEvent(root, actor.actor_id, eventIds[0], {
      workstreams: ['unrelated'],
      scopes: ['writing'],
      affected_paths: ['docs/other/guide.md'],
    });

    const pending = await reportStatus(root, input);
    expect(pending).toMatchObject({
      checkpoint: { state: 'changes-pending' },
      relevant_changes: [],
      required_context_paths: [],
      acknowledgement: { required: true },
    });
    expect(pending.out_of_scope_changes.map((item) => item.event_id)).toEqual([eventIds[0]]);

    const acknowledged = await reportStatus(root, {
      ...input,
      acknowledge: pending.status_digest,
    });
    expect(acknowledged.checkpoint.last_event_id).toBe(eventIds[0]);
    expect(acknowledged.event_created).toBe(false);
  });

  it('rebuilds a scoped baseline below the active floor without reading archive contents', async () => {
    const root = await createProject();
    const actor = await registerActor(root, { client: 'codex', machine_label: 'archive-machine' });
    const archiveRoot = path.join(root, '.pcp', 'continuity', 'archive');
    await writeFile(path.join(archiveRoot, `${eventIds[0]}.yaml`), 'not: [valid yaml', 'utf8');
    await writeFile(path.join(archiveRoot, `${eventIds[1]}.yaml`), 'also not yaml: [', 'utf8');
    await writeEvent(root, actor.actor_id, eventIds[2], {
      scopes: ['implementation'],
      affected_paths: ['src/current.ts'],
    });
    await writeCheckpoint(root, {
      schema_version: 1,
      checkpoint_id: eventIds[5],
      actor_id: actor.actor_id,
      workstream_id: null,
      last_event_id: eventIds[0],
      reconciled_at: '2026-07-15T00:00:00Z',
      scopes: ['implementation'],
      paths: [],
      dependencies: [],
    });

    const result = await reportStatus(root, {
      actor_id: actor.actor_id,
      scopes: ['implementation'],
    });

    expect(result).toMatchObject({
      checkpoint: {
        state: 'behind-active-floor',
        last_event_id: eventIds[0],
        active_floor_event_id: eventIds[2],
      },
      baseline: { required: true, reason: 'checkpoint-before-active-floor' },
      acknowledgement: { required: true },
      mutated: false,
    });
    expect(result.relevant_changes.map((item) => item.event_id)).toEqual([eventIds[2]]);
  });

  it('fails closed when two files claim the same checkpoint identity', async () => {
    const root = await createProject();
    const actor = await registerActor(root, {
      client: 'codex',
      machine_label: 'ambiguous-machine',
    });
    for (const checkpointId of eventIds.slice(0, 2)) {
      await writeCheckpoint(root, {
        schema_version: 1,
        checkpoint_id: checkpointId,
        actor_id: actor.actor_id,
        workstream_id: null,
        last_event_id: null,
        reconciled_at: '2026-07-15T00:00:00Z',
        scopes: ['implementation'],
        paths: [],
        dependencies: [],
      });
    }

    await expect(
      reportStatus(root, { actor_id: actor.actor_id, scopes: ['implementation'] }),
    ).rejects.toMatchObject({ code: 'PCP_STATUS_CHECKPOINT_AMBIGUOUS', mutated: false });
  });

  it('rejects human checkpoints and unknown actors', async () => {
    const root = await createProject();
    const human = await registerActor(root, {
      actor_type: 'human',
      machine_label: 'human-machine',
    });

    await expect(reportStatus(root, { actor_id: human.actor_id })).rejects.toMatchObject({
      code: 'PCP_STATUS_AGENT_REQUIRED',
      mutated: false,
    });
    await expect(
      reportStatus(root, { actor_id: 'codex-missing-0123456789' }),
    ).rejects.toMatchObject({ code: 'PCP_STATUS_ACTOR_NOT_FOUND', mutated: false });
  });
});
