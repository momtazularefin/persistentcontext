import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { stringify } from 'yaml';

import { synchronizeProject } from '../src/application/synchronize-project.ts';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const engine = path.join(projectRoot, 'dist', 'pcp.mjs');
const template = path.join(projectRoot, 'templates', 'core', '.pcp');
const actorId = 'codex-benchmark-01ARZ3NDEK';
const executionId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const candidate = await mkdtemp(path.join(tmpdir(), 'pcp-sync-benchmark-'));

function summary(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    samples: sorted.length,
    minimum_ms: Number(sorted[0].toFixed(3)),
    median_ms: Number(sorted[Math.floor(sorted.length / 2)].toFixed(3)),
    mean_ms: Number((total / sorted.length).toFixed(3)),
    maximum_ms: Number(sorted.at(-1).toFixed(3)),
  };
}

try {
  await cp(template, path.join(candidate, '.pcp'), { recursive: true });
  await mkdir(path.join(candidate, '.pcp', 'continuity', 'actors'), { recursive: true });
  await writeFile(
    path.join(candidate, '.pcp', 'continuity', 'actors', `${actorId}.yaml`),
    stringify({
      schema_version: 1,
      actor_id: actorId,
      actor_type: 'agent',
      client: 'codex',
      machine_label: 'benchmark',
      first_seen: '2026-08-14T00:00:00Z',
      checkpoint_paths: [],
    }),
    'utf8',
  );

  const input = { actor_id: actorId, execution_id: executionId };
  const baseline = await synchronizeProject(candidate, input);
  await synchronizeProject(candidate, { ...input, acknowledge: baseline.sync_digest });

  const warmSamples = [];
  for (let index = 0; index < 100; index += 1) {
    const started = performance.now();
    const result = await synchronizeProject(candidate, input);
    warmSamples.push(performance.now() - started);
    if (result.checkpoint.state !== 'current' || result.changes.length !== 0) {
      throw new Error('Warm benchmark did not exercise the no-change path.');
    }
  }

  const coldSamples = [];
  for (let index = 0; index < 20; index += 1) {
    const started = performance.now();
    const result = spawnSync(
      process.execPath,
      [engine, 'sync', candidate, '--actor-id', actorId, '--execution-id', executionId, '--json'],
      { encoding: 'utf8', windowsHide: true },
    );
    coldSamples.push(performance.now() - started);
    if (result.status !== 0 || JSON.parse(result.stdout).checkpoint?.state !== 'current') {
      throw new Error(`Cold benchmark failed: ${result.stderr || result.stdout}`);
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        benchmark: 'pcp-sync-no-change',
        note: 'Warm measures the synchronization function in one Node process; cold includes a fresh Node CLI process for every sample.',
        warm: summary(warmSamples),
        cold: summary(coldSamples),
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await rm(candidate, { recursive: true, force: true });
}
