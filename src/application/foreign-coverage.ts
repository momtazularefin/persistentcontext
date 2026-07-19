import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parseDocument } from 'yaml';

import {
  AdoptionError,
  canonicalJson,
  deterministicUlid,
  normalizeText,
  sha256,
} from '../domain/adoption.js';
import { isForeignAdapterSourcePath } from '../domain/adapters.js';
import {
  COVERAGE_SCHEMA_VERSION,
  PENDING_COVERAGE_EVIDENCE,
  type CoverageDiagnostic,
  type CoverageMatrix,
  type CoverageRecord,
  type CoverageValidationResult,
  type ForeignCoverageCatalog,
  type ForeignCoverageIssue,
  type ForeignCoverageSource,
  type ForeignRootReview,
} from '../domain/coverage.js';
import {
  comparePortablePaths,
  type FileFingerprint,
  type InspectionResult,
} from '../domain/inspection.js';
import { SchemaRegistry } from '../infrastructure/schema-validator.js';

const MAXIMUM_STRUCTURED_SOURCE_BYTES = 4 * 1_048_576;
const ENCRYPTED_EXTENSION = /\.(?:age|asc|enc|gpg|p12|pfx|pgp)$/iu;
const ENCRYPTED_CONTENT =
  /-----BEGIN (?:PGP MESSAGE|ENCRYPTED PRIVATE KEY)-----|age-encryption\.org\/v1/iu;
const HISTORY_BASENAME =
  /^(?:change[-_ ]?log|events?|history|journal)(?:\.[a-z0-9_-]+)?\.(?:json|md|ya?ml)$/iu;
const REGISTRY_BASENAME =
  /^(?:agent|actor)[-_ ]?(?:profiles?|registry|repository)\.(?:json|md|ya?ml)$/iu;

type StructuredSourceKind = 'history-entry' | 'registry-entry';

function isInsideForeignRoot(candidatePath: string, root: string): boolean {
  return candidatePath === root || candidatePath.startsWith(`${root}/`);
}

function structuredSourceKind(candidatePath: string): StructuredSourceKind | undefined {
  const basename = candidatePath.split('/').at(-1) ?? candidatePath;
  if (HISTORY_BASENAME.test(basename)) return 'history-entry';
  if (REGISTRY_BASENAME.test(basename)) return 'registry-entry';
  return undefined;
}

function collectionKeys(kind: StructuredSourceKind): string[] {
  return kind === 'history-entry'
    ? ['entries', 'changes', 'events', 'history', 'journal']
    : ['actors', 'agents', 'profiles', 'registry', 'entries'];
}

function structuredCollection(value: unknown, kind: StructuredSourceKind): unknown[] | undefined {
  if (Array.isArray(value)) return [...(value as unknown[])];
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  for (const key of collectionKeys(kind)) {
    const collection = record[key];
    if (Array.isArray(collection)) return [...(collection as unknown[])];
  }
  return undefined;
}

function markdownTableEntries(contents: string): string[] {
  const lines = normalizeText(contents).split('\n');
  for (let index = 1; index < lines.length; index += 1) {
    const header = lines[index - 1];
    const separator = lines[index];
    if (header === undefined || separator === undefined || !header.includes('|')) continue;
    const separatorCells = separator
      .trim()
      .replace(/^\||\|$/gu, '')
      .split('|')
      .map((cell) => cell.trim());
    if (separatorCells.length === 0 || !separatorCells.every((cell) => /^:?-{3,}:?$/u.test(cell))) {
      continue;
    }

    const entries: string[] = [];
    for (let rowIndex = index + 1; rowIndex < lines.length; rowIndex += 1) {
      const row = lines[rowIndex]?.trim();
      if (row === undefined || row === '' || !row.includes('|')) break;
      entries.push(
        row
          .replace(/^\||\|$/gu, '')
          .split('|')
          .map((cell) => cell.trim())
          .join(' | '),
      );
    }
    return entries;
  }
  return [];
}

function markdownHeadingEntries(contents: string): string[] {
  const normalized = normalizeText(contents);
  const headings = [...normalized.matchAll(/^##\s+.+$/gmu)];
  return headings.map((heading, index) => {
    const start = heading.index ?? 0;
    const end = headings[index + 1]?.index ?? normalized.length;
    return normalized.slice(start, end).trim();
  });
}

function parseStructuredEntries(
  candidatePath: string,
  contents: string,
  kind: StructuredSourceKind,
): { entries: unknown[]; issue?: ForeignCoverageIssue } {
  if (path.posix.extname(candidatePath).toLowerCase() === '.md') {
    const entries =
      kind === 'registry-entry' ? markdownTableEntries(contents) : markdownHeadingEntries(contents);
    if (entries.length > 0) return { entries };
    return {
      entries: [],
      issue: {
        code: 'foreign-structured-source-unrecognized',
        path: candidatePath,
        message:
          'The structured foreign Markdown source has no recognized table or entry headings.',
        blocking: true,
      },
    };
  }

  const document = parseDocument(contents, {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    return {
      entries: [],
      issue: {
        code: 'foreign-structured-source-malformed',
        path: candidatePath,
        message: `The structured foreign source cannot be parsed uniquely: ${document.errors
          .map((error) => error.message)
          .join('; ')}`,
        blocking: true,
      },
    };
  }

  const entries = structuredCollection(document.toJS({ mapAsMap: false }), kind);
  if (entries !== undefined) return { entries };
  return {
    entries: [],
    issue: {
      code: 'foreign-structured-source-unrecognized',
      path: candidatePath,
      message: 'The structured foreign source has no recognized entry collection.',
      blocking: true,
    },
  };
}

function entrySources(
  sourcePath: string,
  kind: StructuredSourceKind,
  entries: readonly unknown[],
): ForeignCoverageSource[] {
  const occurrences = new Map<string, number>();
  return entries.map((entry) => {
    const fingerprint = sha256(canonicalJson(entry));
    const occurrence = (occurrences.get(fingerprint) ?? 0) + 1;
    occurrences.set(fingerprint, occurrence);
    return {
      source_id: `${kind}:${sourcePath}#${fingerprint.slice(0, 20)}:${occurrence}`,
      source_path: sourcePath,
      source_kind: kind,
      fingerprint,
    };
  });
}

export function foreignRootReviewTemplate(inspection: InspectionResult): ForeignRootReview[] {
  return inspection.foreignCandidates.map((candidate) => ({
    root: candidate.root,
    disposition: 'unresolved',
    evidence: [PENDING_COVERAGE_EVIDENCE],
  }));
}

function defaultForeignRootReviews(inspection: InspectionResult): ForeignRootReview[] {
  return inspection.foreignCandidates.map((candidate) => ({
    root: candidate.root,
    disposition: 'translate',
    evidence: ['Included by direct foreign-coverage discovery.'],
  }));
}

function normalizedForeignRoots(reviews: readonly ForeignRootReview[]): ForeignRootReview[] {
  return reviews
    .map((review) => ({ ...review, evidence: [...review.evidence].sort(comparePortablePaths) }))
    .sort((left, right) => comparePortablePaths(left.root, right.root));
}

export function validateForeignRootReviews(
  inspection: InspectionResult,
  reviews: readonly ForeignRootReview[],
): CoverageDiagnostic[] {
  const diagnostics: CoverageDiagnostic[] = [];
  const expected = inspection.foreignCandidates.map((candidate) => candidate.root);
  const expectedSet = new Set(expected);
  const seen = new Set<string>();
  for (const [index, review] of reviews.entries()) {
    if (seen.has(review.root)) {
      diagnostics.push({
        code: 'foreign-root-duplicate',
        path: `/foreign_roots/${index}/root`,
        message: `Foreign root appears more than once: ${review.root}`,
      });
    }
    seen.add(review.root);
    if (!expectedSet.has(review.root)) {
      diagnostics.push({
        code: 'foreign-root-unexpected',
        path: `/foreign_roots/${index}/root`,
        message: `Foreign root was not detected in the current inventory: ${review.root}`,
      });
    }
    if (review.disposition === 'unresolved') {
      diagnostics.push({
        code: 'foreign-root-unresolved',
        path: `/foreign_roots/${index}/disposition`,
        message: `Foreign root remains unresolved: ${review.root}`,
      });
    }
    if (review.evidence.includes(PENDING_COVERAGE_EVIDENCE)) {
      diagnostics.push({
        code: 'foreign-root-evidence-pending',
        path: `/foreign_roots/${index}/evidence`,
        message: `Resolved foreign root requires concrete evidence: ${review.root}`,
      });
    }
  }
  for (const root of expected) {
    if (!seen.has(root)) {
      diagnostics.push({
        code: 'foreign-root-missing',
        path: '/foreign_roots',
        message: `Detected foreign root has no review: ${root}`,
      });
    }
  }
  return diagnostics;
}

function selectedForeignFiles(
  inspection: InspectionResult,
  reviews: readonly ForeignRootReview[],
): FileFingerprint[] {
  const translatedRoots = new Set(
    reviews.filter((review) => review.disposition === 'translate').map((review) => review.root),
  );
  const directPaths = new Set<string>();
  for (const candidate of inspection.foreignCandidates) {
    if (!translatedRoots.has(candidate.root)) continue;
    for (const candidatePath of candidate.paths) directPaths.add(candidatePath);
  }
  const roots = inspection.foreignCandidates
    .filter((candidate) => translatedRoots.has(candidate.root))
    .map((candidate) => candidate.root)
    .filter((root) => root !== '.');

  return inspection.inventory.files.filter(
    (file) =>
      directPaths.has(file.path) || roots.some((root) => isInsideForeignRoot(file.path, root)),
  );
}

function boundaryIssues(
  inspection: InspectionResult,
  reviews: readonly ForeignRootReview[],
): ForeignCoverageIssue[] {
  const translatedRoots = new Set(
    reviews.filter((review) => review.disposition === 'translate').map((review) => review.root),
  );
  const roots = inspection.foreignCandidates
    .filter((candidate) => translatedRoots.has(candidate.root))
    .map((candidate) => candidate.root)
    .filter((root) => root !== '.');
  const issues: ForeignCoverageIssue[] = [];
  for (const link of inspection.inventory.symlinks) {
    if (!roots.some((root) => isInsideForeignRoot(link.path, root))) continue;
    issues.push({
      code: 'foreign-source-symlink',
      path: link.path,
      message: `Foreign context contains a ${link.boundary} symbolic-link boundary that was not followed.`,
      blocking: true,
    });
  }
  for (const exclusion of inspection.inventory.exclusions) {
    if (!roots.some((root) => isInsideForeignRoot(exclusion.path, root))) continue;
    issues.push({
      code: 'foreign-source-excluded',
      path: exclusion.path,
      message: `Foreign context crosses an excluded ${exclusion.reason} boundary and cannot be proven complete.`,
      blocking: true,
    });
  }
  return issues;
}

function issueKey(issue: ForeignCoverageIssue): string {
  return `${issue.code}\u0000${issue.path}`;
}

function compareSources(left: ForeignCoverageSource, right: ForeignCoverageSource): number {
  return (
    comparePortablePaths(left.source_path, right.source_path) ||
    comparePortablePaths(left.source_kind, right.source_kind) ||
    comparePortablePaths(left.source_id, right.source_id)
  );
}

function createCoverageTemplate(
  inventoryDigest: string,
  foreignRoots: readonly ForeignRootReview[],
  sources: readonly ForeignCoverageSource[],
): CoverageMatrix {
  const records: CoverageRecord[] = sources.map((source) => ({
    ...source,
    disposition: 'unresolved',
    targets: [],
    evidence: [PENDING_COVERAGE_EVIDENCE],
  }));
  return {
    schema_version: COVERAGE_SCHEMA_VERSION,
    coverage_id: deterministicUlid(canonicalJson([inventoryDigest, foreignRoots, sources])),
    source_inventory_digest: inventoryDigest,
    foreign_roots: foreignRoots.map((review) => ({
      ...review,
      evidence: [...review.evidence],
    })),
    records,
    unresolved_count: records.length,
  };
}

export async function discoverForeignCoverage(
  root: string,
  inspection: InspectionResult,
  foreignRoots: readonly ForeignRootReview[] = defaultForeignRootReviews(inspection),
): Promise<ForeignCoverageCatalog> {
  if (inspection.state !== 'C') {
    throw new AdoptionError(
      'PCP_STATE_C_REQUIRED',
      `Foreign coverage discovery requires a State C candidate, not ${inspection.state}.`,
    );
  }

  const rootDiagnostics = validateForeignRootReviews(inspection, foreignRoots);
  if (rootDiagnostics.length > 0) {
    throw new AdoptionError(
      'PCP_STATE_C_ROOT_REVIEW_INVALID',
      `State C foreign-root review is not ready: ${rootDiagnostics
        .slice(0, 8)
        .map((diagnostic) => `${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`)
        .join('; ')}`,
    );
  }
  const normalizedRoots = normalizedForeignRoots(foreignRoots);

  const sources: ForeignCoverageSource[] = [];
  const issues = boundaryIssues(inspection, normalizedRoots);
  for (const file of selectedForeignFiles(inspection, normalizedRoots)) {
    sources.push({
      source_id: `${isForeignAdapterSourcePath(file.path) ? 'adapter' : 'file'}:${file.path}`,
      source_path: file.path,
      source_kind: isForeignAdapterSourcePath(file.path) ? 'adapter' : 'file',
      fingerprint: file.sha256,
    });

    if (file.size > MAXIMUM_STRUCTURED_SOURCE_BYTES) {
      issues.push({
        code: 'foreign-source-too-large',
        path: file.path,
        message: 'Foreign context exceeds the 4 MiB semantic-review limit.',
        blocking: true,
      });
      continue;
    }

    let bytes: Buffer;
    try {
      bytes = await readFile(path.join(root, ...file.path.split('/')));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      issues.push({
        code: 'foreign-source-unreadable',
        path: file.path,
        message: `Foreign context cannot be read: ${detail}`,
        blocking: true,
      });
      continue;
    }
    if (sha256(bytes) !== file.sha256) {
      throw new AdoptionError(
        'PCP_SOURCE_CHANGED',
        `Foreign context changed after inventory: ${file.path}`,
      );
    }
    if (ENCRYPTED_EXTENSION.test(file.path) || ENCRYPTED_CONTENT.test(bytes.toString('utf8'))) {
      issues.push({
        code: 'foreign-source-encrypted',
        path: file.path,
        message: 'Encrypted foreign context cannot receive a semantic disposition automatically.',
        blocking: true,
      });
      continue;
    }
    if (bytes.subarray(0, Math.min(bytes.length, 8_192)).includes(0)) {
      issues.push({
        code: 'foreign-source-not-text',
        path: file.path,
        message: 'Binary foreign context cannot receive a semantic disposition automatically.',
        blocking: true,
      });
      continue;
    }

    let contents: string;
    try {
      contents = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      issues.push({
        code: 'foreign-source-invalid-utf8',
        path: file.path,
        message: 'Foreign context is not valid UTF-8 text.',
        blocking: true,
      });
      continue;
    }

    const entryKind = structuredSourceKind(file.path);
    if (entryKind === undefined) continue;
    const parsed = parseStructuredEntries(file.path, contents, entryKind);
    if (parsed.issue !== undefined) issues.push(parsed.issue);
    sources.push(...entrySources(file.path, entryKind, parsed.entries));
  }

  sources.sort(compareSources);
  const uniqueIssues = [...new Map(issues.map((issue) => [issueKey(issue), issue])).values()].sort(
    (left, right) =>
      comparePortablePaths(left.path, right.path) || comparePortablePaths(left.code, right.code),
  );
  return {
    source_inventory_digest: inspection.inventory.digest,
    foreign_roots: normalizedRoots,
    sources,
    issues: uniqueIssues,
    template: createCoverageTemplate(inspection.inventory.digest, normalizedRoots, sources),
  };
}

export function validateForeignCoverage(
  catalog: ForeignCoverageCatalog,
  value: unknown,
): CoverageValidationResult {
  const schema = new SchemaRegistry().validate('coverage', value);
  if (!schema.valid) {
    return {
      valid: false,
      diagnostics: schema.diagnostics.map((diagnostic) => ({
        code: 'coverage-schema-invalid',
        path: diagnostic.path,
        message: diagnostic.message,
      })),
    };
  }

  const coverage = value as CoverageMatrix;
  const diagnostics: CoverageDiagnostic[] = catalog.issues.map((issue) => ({
    code: issue.code,
    path: issue.path,
    message: issue.message,
  }));
  if (coverage.coverage_id !== catalog.template.coverage_id) {
    diagnostics.push({
      code: 'coverage-id-mismatch',
      path: '/coverage_id',
      message: 'Coverage ID does not match the matrix emitted for this candidate.',
    });
  }
  if (coverage.source_inventory_digest !== catalog.source_inventory_digest) {
    diagnostics.push({
      code: 'coverage-inventory-mismatch',
      path: '/source_inventory_digest',
      message: 'Coverage was prepared against a different candidate inventory.',
    });
  }
  if (
    canonicalJson(normalizedForeignRoots(coverage.foreign_roots)) !==
    canonicalJson(normalizedForeignRoots(catalog.foreign_roots))
  ) {
    diagnostics.push({
      code: 'coverage-foreign-roots-mismatch',
      path: '/foreign_roots',
      message: 'Coverage foreign-root review does not match the scoped matrix for this candidate.',
    });
  }

  const recordsById = new Map<string, CoverageRecord>();
  for (const [index, record] of coverage.records.entries()) {
    if (recordsById.has(record.source_id)) {
      diagnostics.push({
        code: 'coverage-source-id-duplicate',
        path: `/records/${index}/source_id`,
        message: `Coverage source ID appears more than once: ${record.source_id}`,
      });
    } else {
      recordsById.set(record.source_id, record);
    }
  }

  const expectedById = new Map(catalog.sources.map((source) => [source.source_id, source]));
  for (const source of catalog.sources) {
    const record = recordsById.get(source.source_id);
    if (record === undefined) {
      diagnostics.push({
        code: 'coverage-source-missing',
        path: '/records',
        message: `Discovered foreign source has no coverage record: ${source.source_id}`,
      });
      continue;
    }
    if (
      record.source_path !== source.source_path ||
      record.source_kind !== source.source_kind ||
      record.fingerprint !== source.fingerprint
    ) {
      diagnostics.push({
        code: 'coverage-source-mismatch',
        path: `/records/${coverage.records.indexOf(record)}`,
        message: `Coverage metadata does not match the discovered source: ${source.source_id}`,
      });
    }
  }

  for (const [index, record] of coverage.records.entries()) {
    if (!expectedById.has(record.source_id) && record.source_kind !== 'fact') {
      diagnostics.push({
        code: 'coverage-source-unexpected',
        path: `/records/${index}`,
        message: `Only explicit fileless facts may extend the discovered source set: ${record.source_id}`,
      });
    }
    if (record.disposition === 'unresolved') {
      diagnostics.push({
        code: 'coverage-source-unresolved',
        path: `/records/${index}/disposition`,
        message: `Foreign source remains unresolved: ${record.source_id}`,
      });
    } else if (record.evidence.includes(PENDING_COVERAGE_EVIDENCE)) {
      diagnostics.push({
        code: 'coverage-evidence-pending',
        path: `/records/${index}/evidence`,
        message: `Resolved coverage requires concrete evidence: ${record.source_id}`,
      });
    }
  }

  const actualUnresolved = coverage.records.filter(
    (record) => record.disposition === 'unresolved',
  ).length;
  if (coverage.unresolved_count !== actualUnresolved) {
    diagnostics.push({
      code: 'coverage-unresolved-count-mismatch',
      path: '/unresolved_count',
      message: `Declared unresolved_count ${coverage.unresolved_count} does not match ${actualUnresolved} unresolved records.`,
    });
  }

  return { valid: diagnostics.length === 0, diagnostics };
}
