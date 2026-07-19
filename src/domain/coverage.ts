export const COVERAGE_SCHEMA_VERSION = 1;
export const PENDING_COVERAGE_EVIDENCE = 'Pending semantic disposition.';

export type CoverageSourceKind = 'file' | 'history-entry' | 'registry-entry' | 'fact' | 'adapter';

export type CoverageDisposition =
  | 'represented'
  | 'promoted'
  | 'superseded'
  | 'operational-noise'
  | 'historical-only'
  | 'sensitive-local'
  | 'project-owned'
  | 'unresolved';

export type ForeignRootDisposition = 'translate' | 'project-owned' | 'unresolved';

export interface ForeignRootReview {
  root: string;
  disposition: ForeignRootDisposition;
  evidence: string[];
}

export interface CoverageRecord {
  source_id: string;
  source_path: string;
  source_kind: CoverageSourceKind;
  fingerprint: string;
  disposition: CoverageDisposition;
  targets: string[];
  evidence: string[];
}

export interface CoverageMatrix {
  schema_version: typeof COVERAGE_SCHEMA_VERSION;
  coverage_id: string;
  source_inventory_digest: string;
  foreign_roots: ForeignRootReview[];
  records: CoverageRecord[];
  unresolved_count: number;
}

export interface ForeignCoverageSource {
  source_id: string;
  source_path: string;
  source_kind: Exclude<CoverageSourceKind, 'fact'>;
  fingerprint: string;
}

export type ForeignCoverageIssueCode =
  | 'foreign-source-encrypted'
  | 'foreign-source-excluded'
  | 'foreign-source-invalid-utf8'
  | 'foreign-source-not-text'
  | 'foreign-source-symlink'
  | 'foreign-source-too-large'
  | 'foreign-source-unreadable'
  | 'foreign-structured-source-malformed'
  | 'foreign-structured-source-unrecognized';

export interface ForeignCoverageIssue {
  code: ForeignCoverageIssueCode;
  path: string;
  message: string;
  blocking: true;
}

export interface ForeignCoverageCatalog {
  source_inventory_digest: string;
  foreign_roots: ForeignRootReview[];
  sources: ForeignCoverageSource[];
  issues: ForeignCoverageIssue[];
  template: CoverageMatrix;
}

export interface CoverageDiagnostic {
  code: string;
  path: string;
  message: string;
}

export interface CoverageValidationResult {
  valid: boolean;
  diagnostics: CoverageDiagnostic[];
}
