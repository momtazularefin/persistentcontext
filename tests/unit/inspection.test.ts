import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { inspectRepository } from '../../src/application/inspect-repository.js';
import { formatInspection } from '../../src/presentation/format-inspection.js';

const fixtureRoot = fileURLToPath(new URL('../fixtures/inspection/', import.meta.url));
const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'pcp-inspection-'));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('golden intake classification', () => {
  const fixtures = [
    ['title-only', 'A'],
    ['prose-seed', 'A'],
    ['conventional', 'B'],
    ['monorepo', 'B'],
    ['docs-heavy', 'B'],
    ['deployed', 'B'],
    ['renamed-foreign', 'C'],
    ['overlapping-foreign', 'C'],
    ['ai-readme-only', 'A'],
    ['managed', 'managed'],
  ] as const;

  it.each(fixtures)('classifies %s as %s', async (fixture, expectedState) => {
    const result = await inspectRepository(path.join(fixtureRoot, fixture));
    expect(result.state).toBe(expectedState);
    expect(result.mutated).toBe(false);
    expect(result.candidate).toBe('.');
  });

  it('classifies an empty directory as a high-confidence State A seed', async () => {
    const result = await inspectRepository(await temporaryRoot());
    expect(result).toMatchObject({ state: 'A', confidence: 'high', signals: [] });
  });

  it('does not treat a README discussing AI agents as a foreign layer', async () => {
    const result = await inspectRepository(path.join(fixtureRoot, 'ai-readme-only'));
    expect(result.state).toBe('A');
    expect(result.foreignCandidates).toEqual([]);
  });

  it('reports overlapping foreign layer roots for semantic review', async () => {
    const result = await inspectRepository(path.join(fixtureRoot, 'overlapping-foreign'));
    expect(result.foreignCandidates.map((candidate) => candidate.root)).toEqual(['.', '.claude']);
    expect(result.ambiguities).toContainEqual(
      expect.objectContaining({ code: 'foreign-layer-overlap' }),
    );
  });

  it('routes a valid PCP manifest to managed status', async () => {
    const result = await inspectRepository(path.join(fixtureRoot, 'managed'));
    expect(result.state).toBe('managed');
    expect(result.signals).toContainEqual(
      expect.objectContaining({ code: 'managed.valid-manifest', path: '.pcp/pcp.yaml' }),
    );
  });

  it('treats an invalid PCP-like layer as State C instead of managed', async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, '.pcp'), { recursive: true });
    await writeFile(path.join(root, '.pcp', 'pcp.yaml'), 'protocol: incomplete\n', 'utf8');

    const result = await inspectRepository(root);
    expect(result.state).toBe('C');
    expect(result.ambiguities).toContainEqual(
      expect.objectContaining({ code: 'invalid-pcp-manifest' }),
    );
  });

  it('preserves State C classification when a foreign layer is renamed', async () => {
    const contents =
      'This is the source of truth for coding agents. Before every task, use the agent identity, checkpoint, append-only journal, and current workstream for parallel agents.';
    const first = await temporaryRoot();
    const second = await temporaryRoot();
    await mkdir(path.join(first, 'old-context'), { recursive: true });
    await mkdir(path.join(second, 'renamed', 'deeply'), { recursive: true });
    await writeFile(path.join(first, 'old-context', 'continuity.md'), contents, 'utf8');
    await writeFile(path.join(second, 'renamed', 'deeply', 'ledger.txt'), contents, 'utf8');

    const [before, after] = await Promise.all([
      inspectRepository(first),
      inspectRepository(second),
    ]);
    const categories = (result: typeof before) =>
      [...new Set(result.foreignCandidates.flatMap((candidate) => candidate.categories))].sort();

    expect(before.state).toBe('C');
    expect(after.state).toBe('C');
    expect(categories(after)).toEqual(categories(before));
  });

  it('produces a stable normalized digest for a golden fixture', async () => {
    const result = await inspectRepository(path.join(fixtureRoot, 'conventional'));
    expect(result.inventory.digest).toBe(
      '26d153af0f3f4649f49db109cef381d63e75ade5f2216d9b124ba5705b29a536',
    );
    expect(result.inventory.files.map((file) => file.path)).toEqual([
      'package.json',
      'src/index.ts',
    ]);
  });

  it('renders state, evidence, exclusions, digest, and no-mutation status for humans', async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, 'node_modules', 'sample'), { recursive: true });
    await writeFile(path.join(root, 'AGENTS.md'), '# Agent instructions\n', 'utf8');
    await writeFile(path.join(root, 'node_modules', 'sample', 'index.js'), 'ignored', 'utf8');

    const output = formatInspection(await inspectRepository(root));
    expect(output).toContain('State: C');
    expect(output).toContain('Foreign context candidates:');
    expect(output).toContain('Exclusions:');
    expect(output).toContain('[generated-or-vendor] node_modules');
    expect(output).toContain('Digest: ');
    expect(output).toContain('Mutation: none');
  });
});
