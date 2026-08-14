import type { AdapterManifest } from './adapters.js';
import type { MutationPlan } from './adoption.js';
import type { InspectionResult } from './inspection.js';

export interface UpgradeAgentMigration {
  required: boolean;
  instruction_path: '.pcp/protocol/120-updates-and-reset.md';
  review_paths: string[];
  instructions: string[];
  completion_commands: string[];
}

export interface UpgradeHistoryPurgeOffer {
  prompt_after_completion: boolean;
  requires_explicit_human_confirmation: true;
  preview_command: 'node .pcp/tools/pcp.mjs purge-history . --json';
  apply_command: 'node .pcp/tools/pcp.mjs purge-history . --apply <plan-digest> --json';
}

export interface UpgradePreview {
  schema_version: 1;
  command: 'upgrade';
  candidate: '.';
  from_version: string;
  to_version: string;
  applicable: boolean;
  upgrade_paths: string[];
  release_owned_paths: string[];
  mechanical_migration_paths: string[];
  agent_migration: UpgradeAgentMigration;
  history_purge: UpgradeHistoryPurgeOffer;
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
  release_owned_paths: string[];
  mechanical_migration_paths: string[];
  agent_migration: UpgradeAgentMigration;
  history_purge: UpgradeHistoryPurgeOffer;
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

interface ParsedSemver {
  core: [number, number, number];
  prerelease: Array<number | string>;
}

function parsedSemver(value: string): ParsedSemver {
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.exec(
      value,
    );
  if (match === null)
    throw new UpgradeError('PCP_UPGRADE_VERSION_INVALID', `Invalid version: ${value}`);
  const prerelease =
    match[4] === undefined
      ? []
      : match[4].split('.').map((identifier) => {
          if (!/^\d+$/u.test(identifier)) return identifier;
          if (identifier.length > 1 && identifier.startsWith('0')) {
            throw new UpgradeError('PCP_UPGRADE_VERSION_INVALID', `Invalid version: ${value}`);
          }
          return Number(identifier);
        });
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease,
  };
}

export function comparePcpVersions(left: string, right: string): number {
  const leftVersion = parsedSemver(left);
  const rightVersion = parsedSemver(right);
  for (let index = 0; index < leftVersion.core.length; index += 1) {
    const difference = (leftVersion.core[index] ?? 0) - (rightVersion.core[index] ?? 0);
    if (difference !== 0) return difference;
  }
  if (leftVersion.prerelease.length === 0 || rightVersion.prerelease.length === 0) {
    if (leftVersion.prerelease.length === rightVersion.prerelease.length) return 0;
    return leftVersion.prerelease.length === 0 ? 1 : -1;
  }
  const length = Math.max(leftVersion.prerelease.length, rightVersion.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = leftVersion.prerelease[index];
    const rightIdentifier = rightVersion.prerelease[index];
    if (leftIdentifier === undefined || rightIdentifier === undefined) {
      if (leftIdentifier === rightIdentifier) return 0;
      return leftIdentifier === undefined ? -1 : 1;
    }
    if (leftIdentifier === rightIdentifier) continue;
    if (typeof leftIdentifier === 'number' && typeof rightIdentifier === 'number') {
      return leftIdentifier - rightIdentifier;
    }
    if (typeof leftIdentifier === 'number') return -1;
    if (typeof rightIdentifier === 'number') return 1;
    return leftIdentifier < rightIdentifier ? -1 : 1;
  }
  return 0;
}
