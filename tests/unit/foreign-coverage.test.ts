import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import {
  discoverForeignCoverage,
  validateForeignCoverage,
} from '../../src/application/foreign-coverage.js';
import { adoptProject } from '../../src/application/adopt-project.js';
import { inspectRepository } from '../../src/application/inspect-repository.js';
import { isPlanMaterial, planAdoption } from '../../src/application/plan-adoption.js';
import { sha256, type AdoptionInput } from '../../src/domain/adoption.js';
import type { CoverageMatrix } from '../../src/domain/coverage.js';
import { SchemaRegistry } from '../../src/infrastructure/schema-validator.js';
import { formatAdoption } from '../../src/presentation/format-adoption.js';

const fixtureRoot = fileURLToPath(
  new URL('../fixtures/inspection/state-c-coverage/', import.meta.url),
);
const adoptionInputFixture = fileURLToPath(
  new URL('../fixtures/schemas/adoption-input.yaml', import.meta.url),
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

function resolvedCoverage(template: CoverageMatrix): CoverageMatrix {
  const coverage = structuredClone(template);
  for (const record of coverage.records) {
    record.disposition = 'historical-only';
    record.evidence = ['Reviewed as legacy material with no independent current-state authority.'];
  }
  coverage.unresolved_count = 0;
  return coverage;
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

async function stateCInput(coverage?: CoverageMatrix): Promise<AdoptionInput> {
  const fixture = parse(await readFile(adoptionInputFixture, 'utf8')) as {
    valid: AdoptionInput;
  };
  const input = structuredClone(fixture.valid);
  input.scaffold_files = [];
  if (coverage !== undefined) input.coverage = coverage;
  return input;
}

async function writeInput(value: AdoptionInput): Promise<string> {
  const root = await temporaryRoot('pcp-state-c-input-');
  const target = path.join(root, 'adoption.json');
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return target;
}

describe('State C foreign coverage', () => {
  it('expands semantic roots and emits stable file, adapter, history, and registry records', async () => {
    const inspection = await inspectRepository(fixtureRoot);
    expect(inspection.state).toBe('C');
    expect(inspection.foreignCandidates.map((candidate) => candidate.root)).toEqual([
      '.cursor/rules',
      '.github/copilot-instructions.md',
      'project-guidance',
    ]);

    const first = await discoverForeignCoverage(fixtureRoot, inspection);
    const second = await discoverForeignCoverage(fixtureRoot, inspection);
    expect(second).toEqual(first);
    expect(first.issues).toEqual([]);
    expect(new SchemaRegistry().validate('coverage', first.template)).toEqual({
      valid: true,
      diagnostics: [],
    });

    const fileLevel = first.sources.filter(
      (source) => source.source_kind === 'file' || source.source_kind === 'adapter',
    );
    expect(fileLevel.map((source) => source.source_path)).toEqual([
      '.cursor/rules/legacy.mdc',
      '.github/copilot-instructions.md',
      'project-guidance/agent-registry.md',
      'project-guidance/changelog.yaml',
      'project-guidance/continuity.md',
      'project-guidance/policy.md',
      'project-guidance/project-owned-note.md',
    ]);
    expect(fileLevel.map((source) => source.source_path)).not.toContain('README.md');
    expect(fileLevel.map((source) => source.source_path)).not.toContain('.cursor/settings.json');
    expect(fileLevel.map((source) => source.source_path)).not.toContain('.github/workflows/ci.yml');
    expect(fileLevel.map((source) => source.source_path)).not.toContain('src/index.ts');

    const history = first.sources.filter((source) => source.source_kind === 'history-entry');
    const registry = first.sources.filter((source) => source.source_kind === 'registry-entry');
    expect(history).toHaveLength(3);
    expect(registry).toHaveLength(2);
    expect(new Set([...history, ...registry].map((source) => source.source_id)).size).toBe(5);
    expect([...history, ...registry].every((source) => !source.source_id.includes('2026-'))).toBe(
      true,
    );
    expect(first.template.unresolved_count).toBe(12);

    const before = inspection.inventory.digest;
    const preview = await planAdoption(fixtureRoot);
    expect(preview).toMatchObject({
      classification: 'C',
      applicable: false,
      mutated: false,
      coverage: first.template,
      coverage_issues: [],
      coverage_status: 'requires-disposition',
    });
    if (isPlanMaterial(preview)) throw new Error('State C coverage intake cannot mutate.');
    const formatted = formatAdoption(preview);
    expect(formatted).toContain('Foreign coverage records: 12');
    expect(formatted).toContain('Unresolved coverage records: 12');
    expect(formatted).toContain('Coverage review: requires-disposition');
    expect((await inspectRepository(fixtureRoot)).inventory.digest).toBe(before);
  });

  it('accepts complete dispositions and explicit fileless facts', async () => {
    const inspection = await inspectRepository(fixtureRoot);
    const catalog = await discoverForeignCoverage(fixtureRoot, inspection);
    const coverage = resolvedCoverage(catalog.template);
    coverage.records.push({
      source_id: 'fact:current-user-direction',
      source_path: 'user-input/current-direction',
      source_kind: 'fact',
      fingerprint: sha256('The current direction is explicit and fileless.'),
      disposition: 'promoted',
      targets: ['.pcp/operations/30-decisions.md'],
      evidence: ['The adopting user explicitly supplied this current direction.'],
    });

    expect(validateForeignCoverage(catalog, coverage)).toEqual({
      valid: true,
      diagnostics: [],
    });
  });

  it('builds a stable preview-only translation plan without mutating State C', async () => {
    const inspection = await inspectRepository(fixtureRoot);
    const catalog = await discoverForeignCoverage(fixtureRoot, inspection);
    const coverage = reviewedCoverage(catalog.template);
    const input = await writeInput(await stateCInput(coverage));
    const before = inspection.inventory.digest;

    const [result, repeated] = await Promise.all([
      planAdoption(fixtureRoot, input),
      planAdoption(fixtureRoot, input),
    ]);
    if (isPlanMaterial(result) || isPlanMaterial(repeated)) {
      throw new Error('State C preview cannot expose applicable plan material.');
    }
    expect(result).toMatchObject({
      classification: 'C',
      applicable: false,
      questions: [],
      coverage,
      coverage_issues: [],
      coverage_status: 'complete',
      adapters: [
        expect.objectContaining({ adapter_id: 'codex', target_path: 'AGENTS.md' }),
        expect.objectContaining({
          adapter_id: 'antigravity',
          target_path: '.agents/rules/pcp.md',
        }),
        expect.objectContaining({
          adapter_id: 'claude-code-desktop',
          target_path: 'CLAUDE.md',
        }),
        expect.objectContaining({
          adapter_id: 'github-copilot-vscode',
          target_path: '.github/copilot-instructions.md',
        }),
        expect.objectContaining({ adapter_id: 'cursor', target_path: '.cursor/rules/pcp.mdc' }),
      ],
      mutated: false,
    });
    expect(result.plan).toEqual(repeated.plan);
    expect(result.plan).toBeDefined();
    if (result.plan === undefined) throw new Error('Expected a State C translation preview.');
    expect(new SchemaRegistry().validate('mutation-plan', result.plan)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(result.plan.classification).toBe('C');
    expect(result.plan.coverage_digest).toMatch(/^[a-f0-9]{64}$/u);
    const removals = result.plan.operations.filter((operation) => operation.action === 'remove');
    expect(removals.map((operation) => operation.path)).toEqual(
      expect.arrayContaining([
        '.cursor/rules/legacy.mdc',
        'project-guidance/agent-registry.md',
        'project-guidance/changelog.yaml',
        'project-guidance/continuity.md',
        'project-guidance/policy.md',
      ]),
    );
    expect(
      result.plan.operations.some((operation) => operation.path.includes('project-owned-note')),
    ).toBe(false);
    const inventoryByPath = new Map(inspection.inventory.files.map((file) => [file.path, file]));
    expect(
      removals.every(
        (operation) => operation.preimage_digest === inventoryByPath.get(operation.path)?.sha256,
      ),
    ).toBe(true);
    expect(result.plan.operations).toContainEqual(
      expect.objectContaining({
        action: 'replace',
        path: '.github/copilot-instructions.md',
        preimage_digest: inventoryByPath.get('.github/copilot-instructions.md')?.sha256,
      }),
    );
    const cursorWriteIndex = result.plan.operations.findIndex(
      (operation) => operation.action === 'write' && operation.path === '.cursor/rules/pcp.mdc',
    );
    const legacyCursorRemovalIndex = result.plan.operations.findIndex(
      (operation) => operation.action === 'remove' && operation.path === '.cursor/rules/legacy.mdc',
    );
    expect(cursorWriteIndex).toBeGreaterThanOrEqual(0);
    expect(legacyCursorRemovalIndex).toBeGreaterThan(cursorWriteIndex);
    expect(
      result.plan.operations.some(
        (operation) =>
          (operation.action === 'write' || operation.action === 'replace') &&
          operation.path.startsWith('.pcp/coverage'),
      ),
    ).toBe(false);
    expect(new Set(coverage.records.map((record) => record.disposition))).toEqual(
      new Set([
        'represented',
        'promoted',
        'superseded',
        'operational-noise',
        'historical-only',
        'sensitive-local',
        'project-owned',
      ]),
    );
    expect(formatAdoption(result)).toContain('Coverage digest:');
    expect(formatAdoption(result)).toContain('Generated platform adapters:');
    expect((await inspectRepository(fixtureRoot)).inventory.digest).toBe(before);
    await expect(
      adoptProject(fixtureRoot, { input, apply: result.plan.plan_digest }),
    ).rejects.toMatchObject({ code: 'PCP_ADOPTION_NOT_APPLICABLE', mutated: false });
    expect((await inspectRepository(fixtureRoot)).inventory.digest).toBe(before);
  });

  it('previews explicit replacements for all five canonical adapter collisions', async () => {
    const candidate = await temporaryRoot('pcp-state-c-platform-collisions-');
    await mkdir(path.join(candidate, '.agents', 'rules'), { recursive: true });
    await mkdir(path.join(candidate, '.github'), { recursive: true });
    await mkdir(path.join(candidate, '.cursor', 'rules'), { recursive: true });
    await writeFile(
      path.join(candidate, 'README.md'),
      '# Existing project\n\nA maintained project with several agent entry points.\n',
      'utf8',
    );
    const existingAdapters = new Map([
      ['AGENTS.md', '# Existing Codex instructions\n'],
      ['.agents/rules/pcp.md', '# Existing Antigravity instructions\n'],
      ['CLAUDE.md', '# Existing Claude instructions\n'],
      ['.github/copilot-instructions.md', '# Existing Copilot instructions\n'],
      [
        '.cursor/rules/pcp.mdc',
        '---\ndescription: Existing Cursor instructions\nalwaysApply: true\n---\n',
      ],
    ]);
    for (const [target, contents] of existingAdapters) {
      await writeFile(path.join(candidate, ...target.split('/')), contents, 'utf8');
    }

    const inspection = await inspectRepository(candidate);
    expect(inspection.state).toBe('C');
    const catalog = await discoverForeignCoverage(candidate, inspection);
    const coverage = reviewedCoverage(catalog.template);
    const result = await planAdoption(candidate, await writeInput(await stateCInput(coverage)));
    if (isPlanMaterial(result) || result.plan === undefined) {
      throw new Error('Expected a preview-only adapter collision plan.');
    }

    const replacements = result.plan.operations.filter(
      (operation) => operation.action === 'replace' && existingAdapters.has(operation.path),
    );
    expect(replacements.map((operation) => operation.path)).toEqual(
      [...existingAdapters.keys()].sort(),
    );
    for (const replacement of replacements) {
      expect(replacement.preimage_digest).toBe(sha256(existingAdapters.get(replacement.path)!));
    }
    for (const [target, contents] of existingAdapters) {
      expect(await readFile(path.join(candidate, ...target.split('/')), 'utf8')).toBe(contents);
    }
  });

  it('refuses to remove an adapter whose platform replacement is not implemented', async () => {
    const candidate = await temporaryRoot('pcp-state-c-unsupported-adapter-');
    await mkdir(path.join(candidate, '.windsurf', 'rules'), { recursive: true });
    await writeFile(
      path.join(candidate, 'README.md'),
      '# Existing project\n\nA maintained project with foreign agent rules.\n',
      'utf8',
    );
    const unsupportedPath = path.join(candidate, '.windsurf', 'rules', 'project.md');
    const unsupportedContents =
      '# Agent instructions\n\nBefore every task, read the project memory and current workstream.\n';
    await writeFile(unsupportedPath, unsupportedContents, 'utf8');

    const inspection = await inspectRepository(candidate);
    expect(inspection.state).toBe('C');
    const catalog = await discoverForeignCoverage(candidate, inspection);
    const coverage = reviewedCoverage(catalog.template);
    await expect(
      planAdoption(candidate, await writeInput(await stateCInput(coverage))),
    ).rejects.toMatchObject({ code: 'PCP_STATE_C_ADAPTER_UNSUPPORTED', mutated: false });
    expect(await readFile(unsupportedPath, 'utf8')).toBe(unsupportedContents);
  });

  it('normalizes equivalent coverage order while binding material review changes', async () => {
    const inspection = await inspectRepository(fixtureRoot);
    const catalog = await discoverForeignCoverage(fixtureRoot, inspection);
    const originalCoverage = reviewedCoverage(catalog.template);
    const reorderedCoverage = structuredClone(originalCoverage);
    reorderedCoverage.records.reverse();
    for (const record of reorderedCoverage.records) {
      record.targets.reverse();
      record.evidence.reverse();
    }

    const original = await planAdoption(
      fixtureRoot,
      await writeInput(await stateCInput(originalCoverage)),
    );
    const reordered = await planAdoption(
      fixtureRoot,
      await writeInput(await stateCInput(reorderedCoverage)),
    );
    if (isPlanMaterial(original) || isPlanMaterial(reordered)) {
      throw new Error('State C preview cannot expose applicable plan material.');
    }
    expect(reordered.plan).toEqual(original.plan);

    const changedCoverage = structuredClone(originalCoverage);
    changedCoverage.records[0]!.evidence = ['A materially different semantic review.'];
    const changed = await planAdoption(
      fixtureRoot,
      await writeInput(await stateCInput(changedCoverage)),
    );
    if (isPlanMaterial(changed)) throw new Error('State C plan must remain preview-only.');
    expect(changed.plan?.operations).toEqual(original.plan?.operations);
    expect(changed.plan?.coverage_digest).not.toBe(original.plan?.coverage_digest);
    expect(changed.plan?.plan_id).not.toBe(original.plan?.plan_id);
    expect(changed.plan?.plan_digest).not.toBe(original.plan?.plan_digest);
  });

  it('plans reviewed file replacements and file-to-directory collisions explicitly', async () => {
    const candidate = await temporaryRoot('pcp-state-c-collisions-');
    const pcpRoot = path.join(candidate, '.pcp');
    await mkdir(pcpRoot);
    await writeFile(
      path.join(candidate, 'README.md'),
      '# Existing project\n\nA grounded project with a nonstandard PCP-like layer.\n',
      'utf8',
    );
    const legacyManifest = 'schema_version: 0\nlegacy_context: true\n';
    await writeFile(path.join(pcpRoot, 'pcp.yaml'), legacyManifest, 'utf8');
    await writeFile(
      path.join(pcpRoot, 'knowledge'),
      '# Legacy knowledge\n\nThis file occupies a directory PCP needs.\n',
      'utf8',
    );

    const inspection = await inspectRepository(candidate);
    expect(inspection.state).toBe('C');
    const catalog = await discoverForeignCoverage(candidate, inspection);
    const coverage = reviewedCoverage(catalog.template);
    const result = await planAdoption(candidate, await writeInput(await stateCInput(coverage)));
    if (isPlanMaterial(result) || result.plan === undefined) {
      throw new Error('Expected a preview-only State C collision plan.');
    }
    const removeIndex = result.plan.operations.findIndex(
      (operation) => operation.action === 'remove' && operation.path === '.pcp/knowledge',
    );
    const mkdirIndex = result.plan.operations.findIndex(
      (operation) => operation.action === 'mkdir' && operation.path === '.pcp/knowledge',
    );
    expect(removeIndex).toBeGreaterThanOrEqual(0);
    expect(mkdirIndex).toBeGreaterThan(removeIndex);
    expect(result.plan.operations).toContainEqual(
      expect.objectContaining({
        action: 'replace',
        path: '.pcp/pcp.yaml',
        preimage_digest: sha256(legacyManifest),
      }),
    );
    expect(await readFile(path.join(pcpRoot, 'knowledge'), 'utf8')).toContain('Legacy knowledge');
    expect(await readFile(path.join(pcpRoot, 'pcp.yaml'), 'utf8')).toBe(legacyManifest);

    const blockedCoverage = structuredClone(coverage);
    const occupiedDirectory = blockedCoverage.records.find(
      (record) => record.source_path === '.pcp/knowledge',
    );
    if (occupiedDirectory === undefined) throw new Error('Expected the collision source record.');
    occupiedDirectory.disposition = 'project-owned';
    occupiedDirectory.targets = [];
    occupiedDirectory.evidence = ['This file must remain ordinary project material.'];
    await expect(
      planAdoption(candidate, await writeInput(await stateCInput(blockedCoverage))),
    ).rejects.toMatchObject({ code: 'PCP_ADOPTION_PATH_COLLISION' });
  });

  it('rejects case-only collisions with the canonical PCP directory', async () => {
    const candidate = await temporaryRoot('pcp-state-c-case-collision-');
    const foreignRoot = path.join(candidate, '.PCP');
    await mkdir(foreignRoot);
    await writeFile(
      path.join(candidate, 'README.md'),
      '# Existing project\n\nA grounded project with a foreign context layer.\n',
      'utf8',
    );
    await writeFile(
      path.join(foreignRoot, 'continuity.md'),
      '# Continuity\n\nThis directory is the source of truth for coding agents and handoffs.\n',
      'utf8',
    );
    const inspection = await inspectRepository(candidate);
    expect(inspection.state).toBe('C');
    const catalog = await discoverForeignCoverage(candidate, inspection);
    await expect(
      planAdoption(
        candidate,
        await writeInput(await stateCInput(reviewedCoverage(catalog.template))),
      ),
    ).rejects.toMatchObject({ code: 'PCP_ADOPTION_PATH_COLLISION' });
  });

  it('requires current complete coverage and real staged canonical targets', async () => {
    await expect(
      planAdoption(fixtureRoot, await writeInput(await stateCInput())),
    ).rejects.toMatchObject({ code: 'PCP_STATE_C_COVERAGE_REQUIRED' });

    const inspection = await inspectRepository(fixtureRoot);
    const catalog = await discoverForeignCoverage(fixtureRoot, inspection);
    const unresolved = reviewedCoverage(catalog.template);
    unresolved.records[0]!.disposition = 'unresolved';
    unresolved.records[0]!.targets = [];
    unresolved.records[0]!.evidence = ['Pending semantic disposition.'];
    unresolved.unresolved_count = 1;
    await expect(
      planAdoption(fixtureRoot, await writeInput(await stateCInput(unresolved))),
    ).rejects.toMatchObject({ code: 'PCP_STATE_C_COVERAGE_INVALID' });

    const missingTarget = reviewedCoverage(catalog.template);
    const represented = missingTarget.records.find(
      (record) => record.disposition === 'represented',
    );
    if (represented === undefined) throw new Error('Expected a represented fixture record.');
    represented.targets = ['.pcp/knowledge/99-missing.md'];
    const missingTargetReview = planAdoption(
      fixtureRoot,
      await writeInput(await stateCInput(missingTarget)),
    );
    await expect(missingTargetReview).rejects.toMatchObject({
      code: 'PCP_STATE_C_COVERAGE_INVALID',
    });
    await expect(missingTargetReview).rejects.toThrow(/coverage-target-missing/u);
  });

  it('rejects State C scaffolding and knowledge without repository evidence', async () => {
    const inspection = await inspectRepository(fixtureRoot);
    const catalog = await discoverForeignCoverage(fixtureRoot, inspection);

    const scaffold = await stateCInput(reviewedCoverage(catalog.template));
    scaffold.scaffold_files = [{ path: 'extra.txt', content: 'not allowed' }];
    await expect(planAdoption(fixtureRoot, await writeInput(scaffold))).rejects.toMatchObject({
      code: 'PCP_STATE_C_SCAFFOLD_FORBIDDEN',
    });

    const ungrounded = await stateCInput(reviewedCoverage(catalog.template));
    ungrounded.documents[0] = {
      ...ungrounded.documents[0]!,
      basis: 'user',
      evidence_paths: [],
    };
    await expect(planAdoption(fixtureRoot, await writeInput(ungrounded))).rejects.toMatchObject({
      code: 'PCP_ADOPTION_INPUT_INVALID',
    });
  });

  it('limits project-owned coverage to unchanged files', async () => {
    const inspection = await inspectRepository(fixtureRoot);
    const catalog = await discoverForeignCoverage(fixtureRoot, inspection);
    const valid = reviewedCoverage(catalog.template);
    expect(new SchemaRegistry().validate('coverage', valid).valid).toBe(true);

    const wrongKind = structuredClone(valid);
    const ownedAsAdapter = wrongKind.records.find(
      (record) => record.disposition === 'project-owned',
    );
    if (ownedAsAdapter === undefined) throw new Error('Expected a project-owned fixture record.');
    ownedAsAdapter.source_kind = 'adapter';
    expect(new SchemaRegistry().validate('coverage', wrongKind).valid).toBe(false);

    const mapped = structuredClone(valid);
    const mappedOwned = mapped.records.find((record) => record.disposition === 'project-owned');
    if (mappedOwned === undefined) throw new Error('Expected a project-owned fixture record.');
    mappedOwned.targets = ['.pcp/knowledge/10-overview.md'];
    expect(new SchemaRegistry().validate('coverage', mapped).valid).toBe(false);
  });

  it('rejects missing, stale, duplicate, unexpected, and unresolved coverage', async () => {
    const inspection = await inspectRepository(fixtureRoot);
    const catalog = await discoverForeignCoverage(fixtureRoot, inspection);
    const coverage = resolvedCoverage(catalog.template);
    const removed = coverage.records.shift();
    if (removed === undefined || coverage.records[0] === undefined) {
      throw new Error('Expected a populated coverage fixture.');
    }
    coverage.records[0].fingerprint = 'f'.repeat(64);
    coverage.records.push({
      ...structuredClone(coverage.records[0]),
      evidence: ['A conflicting duplicate source record.'],
    });
    coverage.records.push({
      source_id: 'history-entry:invented',
      source_path: 'invented/history.yaml',
      source_kind: 'history-entry',
      fingerprint: 'e'.repeat(64),
      disposition: 'historical-only',
      targets: [],
      evidence: ['This record was not discovered by the engine.'],
    });
    coverage.records[1]!.disposition = 'unresolved';
    coverage.records[1]!.evidence = ['Pending semantic disposition.'];
    coverage.records[2]!.evidence = ['Pending semantic disposition.'];
    coverage.source_inventory_digest = 'd'.repeat(64);
    coverage.coverage_id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    coverage.unresolved_count = 0;

    const result = validateForeignCoverage(catalog, coverage);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        'coverage-source-missing',
        'coverage-source-mismatch',
        'coverage-source-id-duplicate',
        'coverage-source-unexpected',
        'coverage-source-unresolved',
        'coverage-evidence-pending',
        'coverage-inventory-mismatch',
        'coverage-id-mismatch',
        'coverage-unresolved-count-mismatch',
      ]),
    );
  });

  it('fails closed on excluded, encrypted, and malformed foreign sources', async () => {
    const root = await temporaryRoot('pcp-unsafe-foreign-');
    const legacy = path.join(root, 'legacy-context');
    await mkdir(legacy, { recursive: true });
    await writeFile(
      path.join(legacy, 'continuity.md'),
      '# Continuity\n\nThis is the source of truth for coding agents and their checkpoint handoffs.\n',
      'utf8',
    );
    await writeFile(path.join(legacy, '.gitignore'), 'hidden.md\n', 'utf8');
    await writeFile(path.join(legacy, 'hidden.md'), '# Hidden context\n', 'utf8');
    await writeFile(
      path.join(legacy, 'changelog.yaml'),
      'entries:\n  - summary: first\n    summary: duplicate-key\n',
      'utf8',
    );
    await writeFile(
      path.join(legacy, 'secret.age'),
      'age-encryption.org/v1\nnot-a-real-secret\n',
      'utf8',
    );

    const inspection = await inspectRepository(root);
    expect(inspection.state).toBe('C');
    const catalog = await discoverForeignCoverage(root, inspection);
    expect(catalog.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'foreign-source-encrypted',
        'foreign-source-excluded',
        'foreign-structured-source-malformed',
      ]),
    );
    const preview = await planAdoption(root);
    if (isPlanMaterial(preview)) throw new Error('Blocked State C intake cannot mutate.');
    expect(preview.coverage_status).toBe('blocked');
    const result = validateForeignCoverage(catalog, resolvedCoverage(catalog.template));
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        'foreign-source-encrypted',
        'foreign-source-excluded',
        'foreign-structured-source-malformed',
      ]),
    );
  });
});
