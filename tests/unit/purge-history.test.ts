import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';

import { purgeHistory } from '../../src/application/purge-history.js';
import { registerActor } from '../../src/application/register-actor.js';
import { synchronizeProject } from '../../src/application/synchronize-project.js';
import { validateCanonicalLayer } from '../../src/application/validate-canonical-layer.js';
import type {
  PurgeHistoryApplyResult,
  PurgeHistoryPreview,
} from '../../src/domain/purge-history.js';
import type { ContinuityEvent } from '../../src/domain/reconciliation.js';
import { eventPayloadDigest } from '../../src/domain/recording.js';

const coreTemplate = fileURLToPath(new URL('../../templates/core/.pcp/', import.meta.url));
const temporaryRoots: string[] = [];
const archivedId = '01ARZ3NDEKTSV4RRFFQ69G5FAA';
const activeId = '01ARZ3NDEKTSV4RRFFQ69G5FAB';

function applicable(
  preview: PurgeHistoryPreview | PurgeHistoryApplyResult,
): asserts preview is PurgeHistoryPreview & {
  applicable: true;
  plan: NonNullable<PurgeHistoryPreview['plan']>;
} {
  if (preview.mutated || !preview.applicable || preview.plan === undefined) {
    throw new Error('Expected an applicable purge preview.');
  }
}

async function writeEvent(
  root: string,
  actorId: string,
  eventId: string,
  directory: 'events' | 'archive',
): Promise<void> {
  const payload = {
    schema_version: 1 as const,
    event_id: eventId,
    occurred_at: '2026-08-15T00:00:00Z',
    actor: { type: 'agent' as const, id: actorId },
    recorded_by: { type: 'agent' as const, id: actorId },
    basis: 'self' as const,
    kind: 'release' as const,
    scopes: ['protocol'],
    workstreams: [],
    summary: `Historical PCP change ${eventId}.`,
    affected_paths: ['.pcp/pcp.yaml'],
  };
  const event: ContinuityEvent = { ...payload, payload_digest: eventPayloadDigest(payload) };
  await writeFile(
    path.join(root, '.pcp', 'continuity', directory, `${eventId}.yaml`),
    stringify(event),
    'utf8',
  );
}

async function populatedProject(): Promise<{
  root: string;
  actorId: string;
  preserved: Map<string, Buffer>;
}> {
  const root = await mkdtemp(path.join(tmpdir(), 'pcp-purge-history-'));
  temporaryRoots.push(root);
  await cp(coreTemplate, path.join(root, '.pcp'), { recursive: true });
  await mkdir(path.join(root, 'docs'));
  const sourcePath = path.join(root, 'src', 'index.ts');
  await mkdir(path.dirname(sourcePath));
  await writeFile(sourcePath, 'export const currentTruth = true;\n');
  const registration = await registerActor(root, {
    client: 'codex',
    machine_label: 'purge-machine',
  });
  await writeEvent(root, registration.actor_id, archivedId, 'archive');
  await writeEvent(root, registration.actor_id, activeId, 'events');
  const sync = await synchronizeProject(root, {
    actor_id: registration.actor_id,
    execution_id: registration.execution_id,
  });
  await synchronizeProject(root, {
    actor_id: registration.actor_id,
    execution_id: registration.execution_id,
    acknowledge: sync.sync_digest,
  });
  expect((await validateCanonicalLayer(root, { archive_content: 'filenames-only' })).valid).toBe(
    true,
  );
  const projectState = path.join(root, '.pcp', 'state', 'project.yaml');
  return {
    root,
    actorId: registration.actor_id,
    preserved: new Map([
      ['.pcp/state/project.yaml', await readFile(projectState)],
      ['src/index.ts', await readFile(sourcePath)],
    ]),
  };
}

async function expectPreserved(
  root: string,
  preserved: ReadonlyMap<string, Buffer>,
): Promise<void> {
  for (const [portablePath, bytes] of preserved) {
    expect(await readFile(path.join(root, ...portablePath.split('/'))), portablePath).toEqual(
      bytes,
    );
  }
}

async function yamlNames(root: string, directory: string): Promise<string[]> {
  return (await readdir(path.join(root, '.pcp', ...directory.split('/'))))
    .filter((name) => name.endsWith('.yaml'))
    .sort();
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('transactional PCP history purge', () => {
  it('previews exact targets, purges all identities and continuity history, and permits fresh registration', async () => {
    const fixture = await populatedProject();
    const first = await purgeHistory(fixture.root);
    const repeated = await purgeHistory(fixture.root);
    expect(repeated).toEqual(first);
    applicable(first);
    expect(first.counts).toEqual({
      actor_profiles: 1,
      active_events: 1,
      archived_events: 1,
      checkpoints: 1,
      identity_caches: 1,
    });
    expect(first.warning).toContain('does not rewrite Git history');

    const result = await purgeHistory(fixture.root, { apply: first.plan.plan_digest });
    expect(result).toMatchObject({
      command: 'purge-history',
      status: 'purged',
      identity_reset: true,
      event_created: false,
      validation: { valid: true },
      recovery_cleaned: true,
      mutated: true,
    });
    expect(await yamlNames(fixture.root, 'continuity/actors')).toEqual([]);
    expect(await yamlNames(fixture.root, 'continuity/events')).toEqual([]);
    expect(await yamlNames(fixture.root, 'continuity/archive')).toEqual([]);
    expect(await yamlNames(fixture.root, 'continuity/checkpoints')).toEqual([]);
    expect(await readdir(path.join(fixture.root, '.pcp', 'runtime', 'actors'))).toEqual([]);
    await expectPreserved(fixture.root, fixture.preserved);
    expect(
      (
        await validateCanonicalLayer(fixture.root, {
          archive_content: 'filenames-only',
          clean_genesis: true,
        })
      ).valid,
    ).toBe(true);

    const fresh = await registerActor(fixture.root, {
      client: 'codex',
      machine_label: 'purge-machine',
    });
    expect(fresh.status).toBe('created');
    expect(fresh.actor_id).not.toBe(fixture.actorId);
  });

  it('rejects stale approval and unrecognized files without mutation', async () => {
    const stale = await populatedProject();
    const preview = await purgeHistory(stale.root);
    applicable(preview);
    const cachePath = path.join(stale.root, '.pcp', 'runtime', 'actors');
    const cacheName = (await readdir(cachePath))[0];
    if (cacheName === undefined) throw new Error('Expected an actor cache.');
    await writeFile(path.join(cachePath, cacheName), '{"changed":true}\n');
    await expect(
      purgeHistory(stale.root, { apply: preview.plan.plan_digest }),
    ).rejects.toMatchObject({ code: 'PCP_PLAN_DIGEST_MISMATCH', mutated: false });

    const unexpected = await populatedProject();
    await writeFile(
      path.join(unexpected.root, '.pcp', 'continuity', 'events', 'notes.txt'),
      'preserve me\n',
    );
    await expect(purgeHistory(unexpected.root)).rejects.toMatchObject({
      code: 'PCP_PURGE_HISTORY_SOURCE_INVALID',
      mutated: false,
    });
    await expect(
      readFile(path.join(unexpected.root, '.pcp', 'continuity', 'events', 'notes.txt'), 'utf8'),
    ).resolves.toBe('preserve me\n');
  });

  it('restores the exact purge preview after failure at every transaction boundary', async () => {
    const seed = await populatedProject();
    const seedPreview = await purgeHistory(seed.root);
    applicable(seedPreview);
    const boundaries = seedPreview.plan.operations.length + 1;

    for (let boundary = 1; boundary <= boundaries; boundary += 1) {
      const fixture = await populatedProject();
      const preview = await purgeHistory(fixture.root);
      applicable(preview);
      await expect(
        purgeHistory(fixture.root, {
          apply: preview.plan.plan_digest,
          fail_after_operation: boundary,
        }),
      ).rejects.toMatchObject({ code: 'PCP_FAULT_INJECTED', mutated: false });
      expect(await purgeHistory(fixture.root), `boundary ${boundary}`).toEqual(preview);
      await expectPreserved(fixture.root, fixture.preserved);
    }
  });
});
