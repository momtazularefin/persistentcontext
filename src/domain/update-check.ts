export type UpgradeAvailability = 'update-available' | 'current' | 'installed-newer';

export interface UpgradeCheckResult {
  schema_version: 1;
  command: 'upgrade-check';
  candidate: '.';
  provider: 'github';
  repository: string;
  channel: 'main';
  source_url: string;
  source_revision: string;
  source_revision_url: string;
  source_manifest_url: string;
  source_bundle_url: string;
  installed_version: string;
  available_version: string;
  availability: UpgradeAvailability;
  update_available: boolean;
  next_actions: string[];
  mutated: false;
}

export class UpgradeCheckError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'UpgradeCheckError';
  }
}
