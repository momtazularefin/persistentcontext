import { createHash } from 'node:crypto';

import { ulid } from 'ulid';

import type { CoverageMatrix, ForeignCoverageIssue, ForeignRootReview } from './coverage.js';
import type { AdapterManifest } from './adapters.js';
import type { SupportedCapabilityId } from './capabilities.js';
import type {
  InspectionConfidence,
  InspectionResult,
  IntakeState,
  RepositoryInventory,
} from './inspection.js';

export const ADOPTION_SCHEMA_VERSION = 1;

export const REQUIRED_ADOPTION_DOCUMENTS = [
  'knowledge/10-overview.md',
  'knowledge/20-architecture.md',
  'knowledge/30-source-map.md',
  'knowledge/40-build-and-tooling.md',
  'knowledge/50-domain-and-invariants.md',
  'operations/10-working-agreement.md',
  'operations/20-plan.md',
  'operations/30-decisions.md',
] as const;

export type RequiredAdoptionDocumentPath = (typeof REQUIRED_ADOPTION_DOCUMENTS)[number];
export type AdoptionDocumentType = 'knowledge' | 'policy' | 'plan';
export type AdoptionDocumentStatus = 'static' | 'living';
export type AdoptionEvidenceBasis =
  'repository' | 'user' | 'repository-and-user' | 'not-applicable';

export interface AdoptionDocumentInput {
  path: RequiredAdoptionDocumentPath;
  type: AdoptionDocumentType;
  status: AdoptionDocumentStatus;
  basis: AdoptionEvidenceBasis;
  evidence_paths: string[];
  body: string;
}

export interface AdoptionScaffoldFile {
  path: string;
  content: string;
}

export interface AdoptionProjectState {
  schema_version: 1;
  project_id: string;
  name: string;
  purpose: string;
  project_type:
    | 'software'
    | 'research'
    | 'data'
    | 'writing'
    | 'career'
    | 'creative'
    | 'operations'
    | 'mixed'
    | 'other';
  lifecycle: 'seed' | 'active' | 'maintenance' | 'paused' | 'complete' | 'archived';
  artifact_roots: string[];
  context_roots: string[];
  repositories: Array<Record<string, unknown>>;
  tags: string[];
}

export interface AdoptionInput {
  schema_version: 1;
  baseline_at: string;
  persistence: 'tracked' | 'local';
  capabilities: SupportedCapabilityId[];
  project: AdoptionProjectState;
  projects: {
    schema_version: 1;
    projects: Array<Record<string, unknown>>;
  };
  workstreams: {
    schema_version: 1;
    workstreams: Array<Record<string, unknown>>;
  };
  vcs_policy: Record<string, unknown>;
  documents: AdoptionDocumentInput[];
  foreign_roots?: ForeignRootReview[];
  coverage?: CoverageMatrix;
  scaffold_files: AdoptionScaffoldFile[];
}

export type MutationAction = 'mkdir' | 'write' | 'replace' | 'remove' | 'move';

export interface MutationOperation {
  operation_id: string;
  action: MutationAction;
  path: string;
  source_path?: string;
  content_digest?: string;
  preimage_digest?: string;
}

export interface MutationPlan {
  schema_version: 1;
  plan_id: string;
  classification: IntakeState;
  candidate_inventory_digest: string;
  coverage_digest?: string;
  operations: MutationOperation[];
  validations: string[];
  plan_digest: string;
}

export type AdoptionQuestionResponseShape = 'text' | 'enum' | 'object' | 'file-set';

export interface AdoptionQuestion {
  id: string;
  prompt: string;
  reason: string;
  required: true;
  response_shape: AdoptionQuestionResponseShape;
  options?: string[];
  when?: string;
}

export interface AdoptionEvidenceGroup {
  category: string;
  paths: string[];
}

export interface AdoptionBaseline {
  suggested_project_id: string;
  seed_sources: string[];
  evidence_groups: AdoptionEvidenceGroup[];
  nested_repositories: string[];
  required_documents: readonly RequiredAdoptionDocumentPath[];
  preserves_existing_paths: true;
}

export interface AdoptionPreview {
  schema_version: 1;
  command: 'adopt';
  candidate: '.';
  classification: IntakeState;
  confidence: InspectionConfidence;
  applicable: boolean;
  questions: AdoptionQuestion[];
  baseline: AdoptionBaseline;
  foreign_roots?: ForeignRootReview[];
  coverage?: CoverageMatrix;
  coverage_issues?: ForeignCoverageIssue[];
  coverage_status?: 'requires-root-review' | 'requires-disposition' | 'blocked' | 'complete';
  adapters?: AdapterManifest[];
  plan?: MutationPlan;
  mutated: false;
}

export interface AdoptionApplyResult {
  schema_version: 1;
  command: 'adopt';
  candidate: '.';
  classification: 'A' | 'B' | 'C';
  plan_digest: string;
  applied_operations: number;
  validation: {
    valid: true;
    checked_files: number;
  };
  clean_genesis: {
    actor_profiles: 0;
    active_events: 0;
    archived_events: 0;
  };
  recovery_cleaned: true;
  mutated: true;
}

export interface AdoptionPlanMaterial {
  inspection: InspectionResult;
  input: AdoptionInput;
  preview: AdoptionPreview & {
    classification: 'A' | 'B' | 'C';
    applicable: true;
    plan: MutationPlan;
  };
  content_by_path: ReadonlyMap<string, Buffer>;
}

export class AdoptionError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly mutated = false,
    public readonly recoveryRoot?: string,
  ) {
    super(message);
    this.name = 'AdoptionError';
  }
}

export function normalizeText(value: string): string {
  return value.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizedJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => normalizedJsonValue(item));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, normalizedJsonValue(item)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizedJsonValue(value));
}

export function deterministicUlid(seed: string): string {
  const bytes = createHash('sha256').update(seed).digest();
  let index = 0;
  return ulid(1, () => {
    const value = bytes[index % bytes.length];
    index += 1;
    return (value ?? 0) / 256;
  });
}

interface PlanOperationInput {
  action: MutationAction;
  path: string;
  source_path?: string;
  content_digest?: string;
  preimage_digest?: string;
}

type MutationPlanInput = {
  inventory: RepositoryInventory;
  operations: PlanOperationInput[];
  validations: string[];
} & (
  | { classification: 'A' | 'B' | 'managed'; coverageDigest?: never }
  | { classification: 'C'; coverageDigest: string }
);

export function createMutationPlan(input: MutationPlanInput): MutationPlan {
  const operationSeed = canonicalJson(input.operations);
  const coverageDigest = input.classification === 'C' ? input.coverageDigest : undefined;
  const operations = input.operations.map((operation) => ({
    operation_id: deterministicUlid(
      canonicalJson([
        input.inventory.digest,
        operation.action,
        operation.path,
        operation.source_path,
        operation.content_digest,
        operation.preimage_digest,
      ]),
    ),
    ...operation,
  }));
  const planWithoutDigest = {
    schema_version: ADOPTION_SCHEMA_VERSION,
    plan_id: deterministicUlid(
      canonicalJson([input.inventory.digest, operationSeed, coverageDigest]),
    ),
    classification: input.classification,
    candidate_inventory_digest: input.inventory.digest,
    ...(coverageDigest === undefined ? {} : { coverage_digest: coverageDigest }),
    operations,
    validations: [...input.validations].sort(),
  } satisfies Omit<MutationPlan, 'plan_digest'>;

  return {
    ...planWithoutDigest,
    plan_digest: sha256(canonicalJson(planWithoutDigest)),
  };
}
