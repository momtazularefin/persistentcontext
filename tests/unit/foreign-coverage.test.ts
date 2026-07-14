import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  discoverForeignCoverage,
  validateForeignCoverage,
} from '../../src/application/foreign-coverage.js';
import { inspectRepository } from '../../src/application/inspect-repository.js';
import { isPlanMaterial, planAdoption } from '../../src/application/plan-adoption.js';
import { sha256 } from '../../src/domain/adoption.js';
import type { CoverageMatrix } from '../../src/domain/coverage.js';
import { SchemaRegistry } from '../../src/infrastructure/schema-validator.js';
import { formatAdoption } from '../../src/presentation/format-adoption.js';

const fixtureRoot = fileURLToPath(
  new URL('../fixtures/inspection/state-c-coverage/', import.meta.url),
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
    expect(first.template.unresolved_count).toBe(11);

    const before = inspection.inventory.digest;
    const preview = await planAdoption(fixtureRoot);
    expect(preview).toMatchObject({
      classification: 'C',
      applicable: false,
      mutated: false,
      coverage: first.template,
      coverage_issues: [],
    });
    if (isPlanMaterial(preview)) throw new Error('State C coverage intake cannot mutate.');
    const formatted = formatAdoption(preview);
    expect(formatted).toContain('Foreign coverage records: 11');
    expect(formatted).toContain('Unresolved coverage records: 11');
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
