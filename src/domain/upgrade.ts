import type { AdapterManifest } from './adapters.js';
import type { MutationPlan } from './adoption.js';
import type { InspectionResult } from './inspection.js';

export interface UpgradePreview {
  schema_version: 1;
  command: 'upgrade';
  candidate: '.';
  from_version: string;
  to_version: string;
  applicable: boolean;
  upgrade_paths: string[];
  preserved_files: number;
  preservation_digest: string;
  adapters: AdapterManifest[];
  plan?: MutationPlan;
  mutated: false;
}

export interface UpgradeApplyResult {
  schema_version: 1;
  command: 'upgrade';
  candidate: '.';
  from_version: string;
  to_version: string;
  plan_digest: string;
  upgraded_paths: string[];
  preserved_files: number;
  preservation_digest: string;
  applied_operations: number;
  validation: { valid: true; checked_files: number; checked_adapters: number };
  recovery_cleaned: true;
  mutated: true;
}

export interface UpgradePlanMaterial {
  inspection: InspectionResult;
  preview: UpgradePreview & { applicable: true; plan: MutationPlan };
  content_by_path: ReadonlyMap<string, Buffer>;
  preserved: ReadonlyMap<string, string>;
}

export class UpgradeError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly mutated = false,
    public readonly recovery_root?: string,
  ) {
    super(message);
    this.name = 'UpgradeError';
  }
}
