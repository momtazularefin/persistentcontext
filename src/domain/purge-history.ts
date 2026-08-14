import type { MutationPlan } from './adoption.js';

export interface PurgedHistoryCounts {
  actor_profiles: number;
  active_events: number;
  archived_events: number;
  checkpoints: number;
  identity_caches: number;
}

export interface PurgeHistoryPreview {
  schema_version: 1;
  command: 'purge-history';
  candidate: '.';
  applicable: boolean;
  purge_paths: string[];
  counts: PurgedHistoryCounts;
  warning: string;
  plan?: MutationPlan;
  event_created: false;
  mutated: false;
}

export interface PurgeHistoryApplyResult {
  schema_version: 1;
  command: 'purge-history';
  candidate: '.';
  status: 'purged';
  plan_digest: string;
  purged_paths: string[];
  counts: PurgedHistoryCounts;
  applied_operations: number;
  validation: { valid: true; checked_files: number };
  recovery_cleaned: true;
  identity_reset: true;
  next_action: string;
  event_created: false;
  mutated: true;
}

export interface PurgeHistoryPlanMaterial {
  preview: PurgeHistoryPreview & { applicable: true; plan: MutationPlan };
}

export class PurgeHistoryError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly mutated = false,
    public readonly recovery_root?: string,
  ) {
    super(message);
    this.name = 'PurgeHistoryError';
  }
}
