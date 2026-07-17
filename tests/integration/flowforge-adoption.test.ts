import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { adoptProject } from '../../src/application/adopt-project.js';
import { inspectRepository } from '../../src/application/inspect-repository.js';
import { registerActor } from '../../src/application/register-actor.js';
import { reportStatus } from '../../src/application/report-status.js';
import { validateCanonicalLayer } from '../../src/application/validate-canonical-layer.js';

const exampleRoot = fileURLToPath(new URL('../../examples/flowforge/', import.meta.url));
const beforeRoot = path.join(exampleRoot, 'before');
const inputPath = path.join(exampleRoot, 'adoption-input.yaml');
const expectedPath = path.join(exampleRoot, 'expected.yaml');
const temporaryRoots: string[] = [];

vi.setConfig({ testTimeout: 30_000 });

type ExpectedResult = {
  classification: 'B';
  original_file_count: number;
  project: {
    project_id: string;
    name: string;
    lifecycle: string;
    vcs_mode: string;
  };
  capabilities: string[];
  canonical_documents: string[];
  adapters: string[];
  signals: Record<string, string>;
  clean_genesis: {
    actors: number;
    active_events: number;
    archived_events: number;
  };
  fresh_agent: {
    client: 'codex';
    machine_label: string;
    required_paths: string[];
  };
};

async function filesUnder(root: string): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        files.set(
          path.relative(root, absolute).split(path.sep).join('/'),
          await readFile(absolute),
        );
      }
    }
  }
  await visit(root);
  return files;
}

async function yamlCount(root: string, relativeDirectory: string): Promise<number> {
  const entries = await readdir(path.join(root, ...relativeDirectory.split('/')), {
    withFileTypes: true,
  });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.yaml')).length;
}

async function yamlObject(root: string, relative: string): Promise<Record<string, unknown>> {
  const value: unknown = parse(
    await readFile(path.join(root, '.pcp', ...relative.split('/')), 'utf8'),
  );
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${relative} must contain a YAML object.`);
  }
  return value as Record<string, unknown>;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('FlowForge State B reference', () => {
  it('preserves the source project and produces the approved fresh-agent baseline', async () => {
    const expected = parse(await readFile(expectedPath, 'utf8')) as ExpectedResult;
    const root = await mkdtemp(path.join(tmpdir(), 'pcp-flowforge-'));
    temporaryRoots.push(root);
    await cp(beforeRoot, root, { recursive: true });

    const original = await filesUnder(root);
    expect(original.size).toBe(expected.original_file_count);
    const originalPaths = [...original.keys()];
    expect(
      originalPaths.filter(
        (relative) =>
          !/^(?:\.gitignore|README\.md|FlowForge\.slnx|examples\/|src\/|tests\/)/u.test(relative) ||
          /(?:^|\/)(?:bin|obj|ai|\.pcp)(?:\/|$)/u.test(relative) ||
          /(?:AGENTS|CLAUDE|changelog|history)/iu.test(relative) ||
          /(?:^|[-_./])(?:actor|agent)(?:[-_./]|$)/iu.test(relative) ||
          /\.(?:dll|exe|pdb|cache)$/iu.test(relative),
      ),
    ).toEqual([]);
    for (const [relative, bytes] of original) {
      const text = bytes.toString('utf8');
      expect(text, relative).not.toMatch(/(?:[A-Za-z]:\\|\/home\/|\/Users\/)/u);
      expect(text, relative).not.toMatch(/(?:agent|actor)[_-]?id/iu);
    }

    const inspection = await inspectRepository(root);
    expect(inspection.state).toBe(expected.classification);

    const preview = await adoptProject(root, { input: inputPath });
    if (!('plan' in preview) || preview.plan === undefined) {
      throw new Error('Expected an applicable FlowForge adoption plan.');
    }
    expect(preview.classification).toBe(expected.classification);
    expect(preview.adapters?.map(({ target_path }) => target_path)).toEqual(expected.adapters);

    const applied = await adoptProject(root, {
      input: inputPath,
      apply: preview.plan.plan_digest,
    });
    expect(applied).toMatchObject({
      classification: expected.classification,
      clean_genesis: {
        actor_profiles: expected.clean_genesis.actors,
        active_events: expected.clean_genesis.active_events,
        archived_events: expected.clean_genesis.archived_events,
      },
      recovery_cleaned: true,
    });

    const adopted = await filesUnder(root);
    for (const [relative, bytes] of original) {
      expect(adopted.get(relative), relative).toEqual(bytes);
    }
    for (const relative of [...expected.canonical_documents, ...expected.adapters]) {
      expect(adopted.has(relative), relative).toBe(true);
    }
    for (const [relative, signal] of Object.entries(expected.signals)) {
      expect(await readFile(path.join(root, ...relative.split('/')), 'utf8'), relative).toContain(
        signal,
      );
    }

    const [project, manifest, vcsPolicy] = await Promise.all([
      yamlObject(root, 'state/project.yaml'),
      yamlObject(root, 'pcp.yaml'),
      yamlObject(root, 'state/vcs-policy.yaml'),
    ]);
    expect(project).toMatchObject({
      project_id: expected.project.project_id,
      name: expected.project.name,
      lifecycle: expected.project.lifecycle,
    });
    expect(manifest.capabilities).toEqual(expected.capabilities);
    expect(vcsPolicy.mode).toBe(expected.project.vcs_mode);
    expect(await validateCanonicalLayer(root, { clean_genesis: true })).toMatchObject({
      valid: true,
      diagnostics: [],
    });
    expect(await yamlCount(root, '.pcp/continuity/actors')).toBe(expected.clean_genesis.actors);
    expect(await yamlCount(root, '.pcp/continuity/events')).toBe(
      expected.clean_genesis.active_events,
    );
    expect(await yamlCount(root, '.pcp/continuity/archive')).toBe(
      expected.clean_genesis.archived_events,
    );

    const actor = await registerActor(root, expected.fresh_agent);
    const status = await reportStatus(root, { actor_id: actor.actor_id });
    expect(status).toMatchObject({
      baseline: { required: true, reason: 'first-scope-baseline' },
      acknowledgement: { required: true, accepted: false },
      event_created: false,
      mutated: false,
    });
    expect(status.required_context_paths).toEqual(expected.fresh_agent.required_paths);
    expect(await yamlCount(root, '.pcp/continuity/actors')).toBe(1);
    expect(await yamlCount(root, '.pcp/continuity/events')).toBe(0);
  });
});
