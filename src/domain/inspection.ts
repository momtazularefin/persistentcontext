export const INSPECTION_SCHEMA_VERSION = 1;

export function comparePortablePaths(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export type IntakeState = 'managed' | 'A' | 'B' | 'C';
export type InspectionConfidence = 'high' | 'medium' | 'low';

export type SignalCategory =
  | 'managed-manifest'
  | 'agent-instructions'
  | 'persistent-memory'
  | 'agent-identity'
  | 'change-journal'
  | 'workflow'
  | 'orchestration'
  | 'project-manifest'
  | 'source-code'
  | 'tests'
  | 'deployment'
  | 'documentation'
  | 'data'
  | 'creative-assets';

export type SignalStrength = 'strong' | 'moderate' | 'weak';

export interface InspectionSignal {
  code: string;
  category: SignalCategory;
  path: string;
  reason: string;
  strength: SignalStrength;
}

export type ExclusionReason =
  'gitignore' | 'generated-or-vendor' | 'version-control-metadata' | 'nested-repository';

export interface ExcludedEntry {
  path: string;
  reason: ExclusionReason;
}

export type SymlinkBoundary = 'internal' | 'external' | 'broken';

export interface FileFingerprint {
  path: string;
  size: number;
  sha256: string;
}

export interface SymlinkFingerprint {
  path: string;
  target: string;
  targetSha256: string;
  boundary: SymlinkBoundary;
}

export interface InventoryCounts {
  files: number;
  directories: number;
  symlinks: number;
  bytes: number;
  excluded: number;
  nestedRepositories: number;
}

export interface RepositoryInventory {
  digest: string;
  counts: InventoryCounts;
  directories: string[];
  files: FileFingerprint[];
  symlinks: SymlinkFingerprint[];
  exclusions: ExcludedEntry[];
  nestedRepositories: string[];
}

export interface ForeignLayerCandidate {
  root: string;
  categories: SignalCategory[];
  paths: string[];
}

export interface InspectionAmbiguity {
  code: string;
  message: string;
  paths: string[];
}

export interface InspectionResult {
  schemaVersion: typeof INSPECTION_SCHEMA_VERSION;
  candidate: '.';
  state: IntakeState;
  confidence: InspectionConfidence;
  signals: InspectionSignal[];
  foreignCandidates: ForeignLayerCandidate[];
  ambiguities: InspectionAmbiguity[];
  inventory: RepositoryInventory;
  mutated: false;
}

export class InspectionError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'InspectionError';
  }
}
