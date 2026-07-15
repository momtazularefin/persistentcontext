import type { AdapterManifest } from './adapters.js';
import type { MutationPlan } from './adoption.js';
import type { CanonicalDiagnostic } from './canonical-validation.js';
import type { InspectionResult } from './inspection.js';

export interface RepairPreview {
  schema_version: 1;
  command: 'repair';
  candidate: '.';
  applicable: boolean;
  repair_paths: string[];
  diagnostics: CanonicalDiagnostic[];
  adapters: AdapterManifest[];
  plan?: MutationPlan;
  mutated: false;
}

export interface RepairApplyResult {
  schema_version: 1;
  command: 'repair';
  candidate: '.';
  plan_digest: string;
  repaired_paths: string[];
  applied_operations: number;
  validation: { valid: true; checked_files: number; checked_adapters: number };
  recovery_cleaned: true;
  mutated: true;
}

export interface RepairPlanMaterial {
  inspection: InspectionResult;
  preview: RepairPreview & { applicable: true; plan: MutationPlan };
  content_by_path: ReadonlyMap<string, Buffer>;
}

export class RepairError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly mutated = false,
    public readonly recovery_root?: string,
  ) {
    super(message);
    this.name = 'RepairError';
  }
}
