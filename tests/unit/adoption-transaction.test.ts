import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';

import { adoptProject } from '../../src/application/adopt-project.js';
import { discoverForeignCoverage } from '../../src/application/foreign-coverage.js';
import { inspectRepository } from '../../src/application/inspect-repository.js';
import { renderPlatformAdapters } from '../../src/application/render-platform-adapters.js';
import { validateCanonicalLayer } from '../../src/application/validate-canonical-layer.js';
import { validatePlatformAdapters } from '../../src/application/validate-platform-adapters.js';
import { AdoptionError, sha256, type AdoptionInput } from '../../src/domain/adoption.js';
import type { CoverageMatrix } from '../../src/domain/coverage.js';

const schemaFixture = fileURLToPath(
  new URL('../fixtures/schemas/adoption-input.yaml', import.meta.url),
);
const inspectionFixtureRoot = fileURLToPath(new URL('../fixtures/inspection/', import.meta.url));
const stateCFixture = path.join(inspectionFixtureRoot, 'state-c-coverage');
const equivalentStateCFixture = fileURLToPath(
  new URL('../fixtures/adoption/state-c-equivalent-layouts/', import.meta.url),
);
const temporaryRoots: string[] = [];

async function temporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function adoptionFixture(): Promise<AdoptionInput> {
  const wrapper = parse(await readFile(schemaFixture, 'utf8')) as { valid: AdoptionInput };
  return structuredClone(wrapper.valid);
}

async function writeExternalInput(input: AdoptionInput): Promise<string> {
  const inputRoot = await temporaryRoot('pcp-transaction-input-');
  const inputPath = path.join(inputRoot, 'adoption.json');
  await writeFile(inputPath, `${JSON.stringify(input, null, 2)}\n`, 'utf8');
  return inputPath;
}

async function createSeed(): Promise<{ candidate: string; inputPath: string; seed: string }> {
  const candidate = await temporaryRoot('pcp-transaction-seed-');
  const seed = '# Sample project\n\nA small software seed with an explicit purpose.\n';
  await writeFile(path.join(candidate, 'README.md'), seed, 'utf8');
  const inputPath = await writeExternalInput(await adoptionFixture());
  return { candidate, inputPath, seed };
}

function reviewedCoverage(template: CoverageMatrix): CoverageMatrix {
  const coverage = structuredClone(template);
  const dispositions = [
    'represented',
    'promoted',
    'superseded',
    'operational-noise',
    'historical-only',
    'sensitive-local',
  ] as const;
  let dispositionIndex = 0;
  for (const record of coverage.records) {
    if (record.source_path === 'project-guidance/project-owned-note.md') {
      record.disposition = 'project-owned';
      record.targets = [];
      record.evidence = ['This is an ordinary product note, not persistent agent context.'];
      continue;
    }
    const disposition = dispositions[dispositionIndex % dispositions.length]!;
    dispositionIndex += 1;
    record.disposition = disposition;
    record.targets =
      disposition === 'represented' || disposition === 'promoted' || disposition === 'superseded'
        ? ['.pcp/operations/10-working-agreement.md']
        : [];
    record.evidence = [`Reviewed ${record.source_path} and assigned ${disposition}.`];
  }
  coverage.records.push({
    source_id: 'fact:current-user-direction',
    source_path: 'user-input/current-direction',
    source_kind: 'fact',
    fingerprint: sha256('The current direction is explicit and fileless.'),
    disposition: 'promoted',
    targets: ['.pcp/operations/30-decisions.md'],
    evidence: ['The adopting user explicitly supplied this current direction.'],
  });
  coverage.unresolved_count = 0;
  return coverage;
}

function representedCoverage(template: CoverageMatrix): CoverageMatrix {
  const coverage = structuredClone(template);
  for (const record of coverage.records) {
    record.disposition = 'represented';
    record.targets = ['.pcp/operations/10-working-agreement.md'];
    record.evidence = [
      'The common semantic baseline represents this legacy rule in canonical PCP state.',
    ];
  }
  coverage.unresolved_count = 0;
  return coverage;
}

async function createStateC(): Promise<{ candidate: string; inputPath: string }> {
  const candidate = await temporaryRoot('pcp-transaction-state-c-');
  await cp(stateCFixture, candidate, { recursive: true });
  const inspection = await inspectRepository(candidate);
  const catalog = await discoverForeignCoverage(candidate, inspection);
  const input = await adoptionFixture();
  input.scaffold_files = [];
  input.coverage = reviewedCoverage(catalog.template);
  return { candidate, inputPath: await writeExternalInput(input) };
}

async function createEquivalentStateC(
  layout: 'layout-a' | 'layout-b',
): Promise<{ candidate: string; inputPath: string }> {
  const candidate = await temporaryRoot(`pcp-equivalent-${layout}-`);
  await cp(path.join(equivalentStateCFixture, layout), candidate, { recursive: true });
  const inspection = await inspectRepository(candidate);
  if (inspection.state !== 'C') throw new Error(`${layout} must classify as State C.`);
  const catalog = await discoverForeignCoverage(candidate, inspection);
  if (catalog.issues.length > 0) throw new Error(`${layout} contains blocked foreign coverage.`);
  const input = await adoptionFixture();
  input.scaffold_files = [];
  input.coverage = representedCoverage(catalog.template);
  return { candidate, inputPath: await writeExternalInput(input) };
}

async function previewDigest(
  candidate: string,
  inputPath: string,
): Promise<{ digest: string; steps: number }> {
  const preview = await adoptProject(candidate, { input: inputPath });
  if (!('plan' in preview) || preview.plan === undefined) {
    throw new Error('Expected an applicable adoption preview.');
  }
  return { digest: preview.plan.plan_digest, steps: preview.plan.operations.length };
}

describe('transactional State A adoption', () => {
  it('applies only the approved recomputed plan and produces a valid clean genesis', async () => {
    const { candidate, inputPath, seed } = await createSeed();
    const before = await inspectRepository(candidate);
    const { digest, steps } = await previewDigest(candidate, inputPath);
    const result = await adoptProject(candidate, { input: inputPath, apply: digest });

    expect(result).toMatchObject({
      classification: 'A',
      plan_digest: digest,
      applied_operations: steps,
      validation: { valid: true },
      clean_genesis: { actor_profiles: 0, active_events: 0, archived_events: 0 },
      recovery_cleaned: true,
      mutated: true,
    });
    expect(await readFile(path.join(candidate, 'README.md'), 'utf8')).toBe(seed);
    expect(await readFile(path.join(candidate, 'src', 'index.ts'), 'utf8')).toBe('export {};\n');
    expect((await inspectRepository(candidate)).state).toBe('managed');
    expect(await validateCanonicalLayer(candidate, { clean_genesis: true })).toMatchObject({
      valid: true,
    });
    const adapters = renderPlatformAdapters();
    expect(
      await validatePlatformAdapters(
        candidate,
        adapters.map((adapter) => adapter.manifest),
      ),
    ).toEqual({ valid: true, checked_adapters: 5, diagnostics: [] });
    await writeFile(path.join(candidate, 'AGENTS.md'), '# Stale adapter\n');
    const driftedLayer = await validateCanonicalLayer(candidate, { clean_genesis: true });
    expect(driftedLayer.valid).toBe(false);
    expect(
      driftedLayer.diagnostics.some((diagnostic) => diagnostic.code === 'adapter.digest'),
    ).toBe(true);
    expect(await readdir(path.join(candidate, '.pcp', 'continuity', 'actors'))).toEqual([
      '00-index.md',
    ]);
    expect(await readdir(path.join(candidate, '.pcp', 'continuity', 'events'))).toEqual([
      '00-index.md',
    ]);
    expect(await readdir(path.join(candidate, '.pcp', 'continuity', 'archive'))).toEqual([
      '00-index.md',
    ]);
    expect(before.inventory.files.map((file) => file.path)).toEqual(['README.md']);
  }, 15_000);

  it('rejects an unapproved digest without changing the candidate', async () => {
    const { candidate, inputPath } = await createSeed();
    const before = await inspectRepository(candidate);

    await expect(
      adoptProject(candidate, { input: inputPath, apply: '0'.repeat(64) }),
    ).rejects.toMatchObject({ code: 'PCP_PLAN_DIGEST_MISMATCH', mutated: false });
    expect((await inspectRepository(candidate)).inventory.digest).toBe(before.inventory.digest);
  });

  it('adopts an empty non-software State A project from an explicit scaffold', async () => {
    const candidate = await temporaryRoot('pcp-empty-research-');
    const input = await adoptionFixture();
    input.project.project_type = 'research';
    input.project.lifecycle = 'seed';
    input.documents = input.documents.map((document) => ({
      ...document,
      basis: 'user',
      evidence_paths: [],
    }));
    input.scaffold_files = [
      { path: 'README.md', content: '# Research project\n\nInitial research question.\n' },
      { path: 'notes/00-index.md', content: '# Notes\n' },
    ];
    const inputPath = await writeExternalInput(input);
    const { digest } = await previewDigest(candidate, inputPath);

    const result = await adoptProject(candidate, { input: inputPath, apply: digest });
    expect(result).toMatchObject({ classification: 'A', mutated: true });
    expect(await readFile(path.join(candidate, 'notes', '00-index.md'), 'utf8')).toBe('# Notes\n');
    expect(await validateCanonicalLayer(candidate, { clean_genesis: true })).toMatchObject({
      valid: true,
    });
  }, 15_000);

  it('adopts grounded software, documentation, research/data, monorepo, and nested-repository State B fixtures without changing owned assets', async () => {
    const cases = [
      { name: 'software', fixture: 'conventional', evidence: 'package.json', type: 'software' },
      {
        name: 'documentation',
        fixture: 'docs-heavy',
        evidence: 'docs/architecture.md',
        type: 'writing',
      },
      { name: 'monorepo', fixture: 'monorepo', evidence: 'package.json', type: 'software' },
      {
        name: 'nested-repository',
        fixture: 'monorepo',
        evidence: 'package.json',
        type: 'software',
        nested: true,
      },
    ] as const;

    for (const fixtureCase of cases) {
      const candidate = await temporaryRoot(`pcp-state-b-${fixtureCase.name}-`);
      await cp(path.join(inspectionFixtureRoot, fixtureCase.fixture), candidate, {
        recursive: true,
      });
      if ('nested' in fixtureCase) {
        await mkdir(path.join(candidate, 'external-tool', '.git'), { recursive: true });
        await writeFile(
          path.join(candidate, 'external-tool', '.git', 'HEAD'),
          'ref: refs/heads/main\n',
        );
        await writeFile(path.join(candidate, 'external-tool', 'README.md'), '# Nested tool\n');
      }

      const input = await adoptionFixture();
      input.project.project_type = fixtureCase.type;
      input.project.lifecycle = 'active';
      input.documents = input.documents.map((document) => ({
        ...document,
        basis: 'repository',
        evidence_paths: [fixtureCase.evidence],
      }));
      const subprojectRoot =
        fixtureCase.name === 'monorepo'
          ? 'packages/api'
          : fixtureCase.name === 'nested-repository'
            ? 'external-tool'
            : undefined;
      input.projects.projects =
        subprojectRoot === undefined
          ? []
          : [
              {
                schema_version: 1,
                project_id: `${fixtureCase.name}-component`,
                name: `${fixtureCase.name} component`,
                purpose: `Track the grounded ${fixtureCase.name} component separately.`,
                project_type: 'software',
                lifecycle: 'active',
                artifact_roots: [subprojectRoot],
                context_roots: ['.pcp'],
                repositories: [],
                tags: [fixtureCase.name],
              },
            ];
      input.workstreams.workstreams = [
        {
          workstream_id: `${fixtureCase.name}-baseline`,
          name: `${fixtureCase.name} baseline`,
          kind: 'sequential',
          status: 'active',
          paths: [fixtureCase.evidence],
          areas: [fixtureCase.name],
          dependencies: [],
          completion: {
            criteria: [`Preserve and describe the ${fixtureCase.name} project baseline.`],
            evidence: [
              {
                criterion: `Preserve and describe the ${fixtureCase.name} project baseline.`,
                proof: fixtureCase.evidence,
              },
            ],
          },
        },
      ];
      input.scaffold_files = [];
      const inputPath = await writeExternalInput(input);
      const before = await inspectRepository(candidate);
      expect(before.state, fixtureCase.name).toBe('B');
      if ('nested' in fixtureCase) {
        expect(before.inventory.nestedRepositories).toEqual(['external-tool']);
      }
      const originalFiles = new Map(before.inventory.files.map((file) => [file.path, file.sha256]));
      const { digest } = await previewDigest(candidate, inputPath);

      const result = await adoptProject(candidate, { input: inputPath, apply: digest });
      expect(result, fixtureCase.name).toMatchObject({ classification: 'B', mutated: true });
      const after = await inspectRepository(candidate);
      expect(after.state, fixtureCase.name).toBe('managed');
      for (const [filePath, digestBefore] of originalFiles) {
        expect(
          after.inventory.files.find((file) => file.path === filePath)?.sha256,
          `${fixtureCase.name}:${filePath}`,
        ).toBe(digestBefore);
      }
      if ('nested' in fixtureCase) {
        expect(await readFile(path.join(candidate, 'external-tool', 'README.md'), 'utf8')).toBe(
          '# Nested tool\n',
        );
      }
      expect(
        (
          parse(await readFile(path.join(candidate, '.pcp', 'state', 'projects.yaml'), 'utf8')) as {
            projects: unknown[];
          }
        ).projects,
      ).toEqual(input.projects.projects);
      expect(
        (
          parse(
            await readFile(path.join(candidate, '.pcp', 'state', 'workstreams.yaml'), 'utf8'),
          ) as { workstreams: unknown[] }
        ).workstreams,
      ).toEqual(input.workstreams.workstreams);
      expect(await validateCanonicalLayer(candidate, { clean_genesis: true })).toMatchObject({
        valid: true,
      });
      expect(
        await validatePlatformAdapters(
          candidate,
          renderPlatformAdapters().map((adapter) => adapter.manifest),
        ),
      ).toMatchObject({ valid: true, checked_adapters: 5 });
    }

    const researchCandidate = await temporaryRoot('pcp-state-b-research-data-');
    await mkdir(path.join(researchCandidate, 'research'));
    await mkdir(path.join(researchCandidate, 'data'));
    await writeFile(
      path.join(researchCandidate, 'research', 'protocol.md'),
      '# Protocol\n\nCollect and analyze observations.\n',
    );
    await writeFile(path.join(researchCandidate, 'data', 'observations.csv'), 'id,value\n1,2\n');
    await writeFile(path.join(researchCandidate, 'analysis.py'), 'print("analysis")\n');
    const researchInput = await adoptionFixture();
    researchInput.project.project_type = 'data';
    researchInput.project.lifecycle = 'active';
    researchInput.documents = researchInput.documents.map((document) => ({
      ...document,
      basis: 'repository',
      evidence_paths: ['research/protocol.md'],
    }));
    researchInput.scaffold_files = [];
    const researchInputPath = await writeExternalInput(researchInput);
    const researchBefore = await inspectRepository(researchCandidate);
    expect(researchBefore.state).toBe('B');
    const { digest } = await previewDigest(researchCandidate, researchInputPath);
    await adoptProject(researchCandidate, { input: researchInputPath, apply: digest });
    expect(await readFile(path.join(researchCandidate, 'data', 'observations.csv'), 'utf8')).toBe(
      'id,value\n1,2\n',
    );
    expect(await validateCanonicalLayer(researchCandidate, { clean_genesis: true })).toMatchObject({
      valid: true,
    });
  }, 60_000);

  it('invalidates approval after source drift before acquiring mutation authority', async () => {
    const { candidate, inputPath } = await createSeed();
    const { digest } = await previewDigest(candidate, inputPath);
    await writeFile(path.join(candidate, 'new-source.txt'), 'concurrent change\n', 'utf8');
    const drifted = await inspectRepository(candidate);

    await expect(
      adoptProject(candidate, { input: inputPath, apply: digest }),
    ).rejects.toMatchObject({
      code: 'PCP_PLAN_DIGEST_MISMATCH',
      mutated: false,
    });
    expect((await inspectRepository(candidate)).inventory.digest).toBe(drifted.inventory.digest);
    await expect(readdir(path.join(candidate, '.pcp'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('restores the exact source inventory after injected failure at every operation and validation boundary', async () => {
    const { candidate, inputPath, seed } = await createSeed();
    const before = await inspectRepository(candidate);
    const { digest, steps } = await previewDigest(candidate, inputPath);

    for (let failurePoint = 1; failurePoint <= steps + 1; failurePoint += 1) {
      let caught: unknown;
      try {
        await adoptProject(candidate, {
          input: inputPath,
          apply: digest,
          fail_after_operation: failurePoint,
        });
      } catch (error) {
        caught = error;
      }
      expect(caught, `failure point ${failurePoint}`).toBeInstanceOf(AdoptionError);
      expect(caught, `failure point ${failurePoint}`).toMatchObject({
        code: 'PCP_FAULT_INJECTED',
        mutated: false,
      });
      const recoveryRoot = (caught as AdoptionError).recoveryRoot;
      expect(recoveryRoot, `failure point ${failurePoint}`).toBeTypeOf('string');
      if (recoveryRoot !== undefined) {
        await rm(recoveryRoot, { recursive: true, force: true });
      }

      const restored = await inspectRepository(candidate);
      expect(restored.inventory.digest, `failure point ${failurePoint}`).toBe(
        before.inventory.digest,
      );
      expect(await readFile(path.join(candidate, 'README.md'), 'utf8')).toBe(seed);
    }
  }, 120_000);
});

describe('transactional State C translation', () => {
  it('converges different foreign layouts on the same canonical result', async () => {
    const first = await createEquivalentStateC('layout-a');
    const second = await createEquivalentStateC('layout-b');
    const firstPreview = await previewDigest(first.candidate, first.inputPath);
    const secondPreview = await previewDigest(second.candidate, second.inputPath);
    expect(firstPreview.digest).not.toBe(secondPreview.digest);

    await adoptProject(first.candidate, {
      input: first.inputPath,
      apply: firstPreview.digest,
    });
    await adoptProject(second.candidate, {
      input: second.inputPath,
      apply: secondPreview.digest,
    });

    expect((await inspectRepository(first.candidate)).state).toBe('managed');
    expect((await inspectRepository(second.candidate)).state).toBe('managed');
    const firstCanonical = await inspectRepository(path.join(first.candidate, '.pcp'));
    const secondCanonical = await inspectRepository(path.join(second.candidate, '.pcp'));
    expect(firstCanonical.inventory.digest).toBe(secondCanonical.inventory.digest);
    expect(firstCanonical.inventory.files).toEqual(secondCanonical.inventory.files);

    for (const adapter of renderPlatformAdapters()) {
      const segments = adapter.manifest.target_path.split('/');
      expect(await readFile(path.join(first.candidate, ...segments))).toEqual(
        await readFile(path.join(second.candidate, ...segments)),
      );
    }
    expect(await readFile(path.join(first.candidate, 'README.md'))).toEqual(
      await readFile(path.join(second.candidate, 'README.md')),
    );
    expect(await readFile(path.join(first.candidate, 'src', 'index.ts'))).toEqual(
      await readFile(path.join(second.candidate, 'src', 'index.ts')),
    );
    await expect(
      readFile(path.join(first.candidate, 'legacy-context', 'policy.md')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(
      readFile(path.join(second.candidate, 'team-memory', 'handoff.md')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  }, 60_000);

  it('translates reviewed foreign context into a valid clean PCP layer while preserving project assets', async () => {
    const { candidate, inputPath } = await createStateC();
    const before = await inspectRepository(candidate);
    expect(before.state).toBe('C');
    const preservedPaths = [
      'README.md',
      '.cursor/settings.json',
      '.github/workflows/ci.yml',
      'project-guidance/project-owned-note.md',
      'src/index.ts',
    ];
    const preserved = new Map(
      await Promise.all(
        preservedPaths.map(
          async (candidatePath) =>
            [
              candidatePath,
              await readFile(path.join(candidate, ...candidatePath.split('/'))),
            ] as const,
        ),
      ),
    );
    const { digest, steps } = await previewDigest(candidate, inputPath);

    const result = await adoptProject(candidate, { input: inputPath, apply: digest });

    expect(result).toMatchObject({
      classification: 'C',
      plan_digest: digest,
      applied_operations: steps,
      validation: { valid: true },
      clean_genesis: { actor_profiles: 0, active_events: 0, archived_events: 0 },
      recovery_cleaned: true,
      mutated: true,
    });
    const after = await inspectRepository(candidate);
    expect(after.state).toBe('managed');
    expect(await validateCanonicalLayer(candidate, { clean_genesis: true })).toMatchObject({
      valid: true,
    });
    expect(after.inventory.files.some((file) => file.path.startsWith('.pcp/coverage'))).toBe(false);

    for (const [candidatePath, contents] of preserved) {
      expect(await readFile(path.join(candidate, ...candidatePath.split('/')))).toEqual(contents);
    }
    for (const removedPath of [
      '.cursor/rules/legacy.mdc',
      'project-guidance/agent-registry.md',
      'project-guidance/changelog.yaml',
      'project-guidance/continuity.md',
      'project-guidance/policy.md',
    ]) {
      await expect(readFile(path.join(candidate, ...removedPath.split('/')))).rejects.toMatchObject(
        {
          code: 'ENOENT',
        },
      );
    }

    const generatedAdapters = renderPlatformAdapters();
    for (const adapter of generatedAdapters) {
      expect(
        await readFile(path.join(candidate, ...adapter.manifest.target_path.split('/'))),
      ).toEqual(adapter.content);
    }
    expect(
      await validatePlatformAdapters(
        candidate,
        generatedAdapters.map((adapter) => adapter.manifest),
      ),
    ).toEqual({ valid: true, checked_adapters: 5, diagnostics: [] });
  }, 60_000);

  it('rejects source drift after preview without starting translation', async () => {
    const { candidate, inputPath } = await createStateC();
    const { digest } = await previewDigest(candidate, inputPath);
    await writeFile(path.join(candidate, 'concurrent-note.txt'), 'A concurrent project change.\n');
    const drifted = await inspectRepository(candidate);

    await expect(
      adoptProject(candidate, { input: inputPath, apply: digest }),
    ).rejects.toMatchObject({
      code: 'PCP_STATE_C_COVERAGE_INVALID',
      mutated: false,
    });
    expect((await inspectRepository(candidate)).inventory.digest).toBe(drifted.inventory.digest);
    await expect(readFile(path.join(candidate, 'AGENTS.md'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(readdir(path.join(candidate, '.pcp'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('restores the exact foreign layer after failure at every operation and validation boundary', async () => {
    const { candidate, inputPath } = await createStateC();
    const before = await inspectRepository(candidate);
    const originalCopilot = await readFile(
      path.join(candidate, '.github', 'copilot-instructions.md'),
    );
    const originalChangelog = await readFile(
      path.join(candidate, 'project-guidance', 'changelog.yaml'),
    );
    const { digest, steps } = await previewDigest(candidate, inputPath);

    for (let failurePoint = 1; failurePoint <= steps + 1; failurePoint += 1) {
      let caught: unknown;
      try {
        await adoptProject(candidate, {
          input: inputPath,
          apply: digest,
          fail_after_operation: failurePoint,
        });
      } catch (error) {
        caught = error;
      }
      expect(caught, `failure point ${failurePoint}`).toBeInstanceOf(AdoptionError);
      expect(caught, `failure point ${failurePoint}`).toMatchObject({
        code: 'PCP_FAULT_INJECTED',
        mutated: false,
      });
      const recoveryRoot = (caught as AdoptionError).recoveryRoot;
      expect(recoveryRoot, `failure point ${failurePoint}`).toBeTypeOf('string');
      if (recoveryRoot !== undefined) {
        await rm(recoveryRoot, { recursive: true, force: true });
      }

      expect(
        (await inspectRepository(candidate)).inventory.digest,
        `failure point ${failurePoint}`,
      ).toBe(before.inventory.digest);
      expect(await readFile(path.join(candidate, '.github', 'copilot-instructions.md'))).toEqual(
        originalCopilot,
      );
      expect(await readFile(path.join(candidate, 'project-guidance', 'changelog.yaml'))).toEqual(
        originalChangelog,
      );
    }
  }, 240_000);
});
