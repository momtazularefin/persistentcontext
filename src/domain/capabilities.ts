export const SUPPORTED_CAPABILITY_IDS = [
  'concurrent-execution-blocks',
  'scratch-space',
  'spec-driven-projects',
  'walkthroughs',
] as const;

export type SupportedCapabilityId = (typeof SUPPORTED_CAPABILITY_IDS)[number];

export interface CapabilityIndexEntry {
  folder: string;
  path: string;
  title: string;
}

export interface CapabilityManifest {
  schema_version: 1;
  capability_id: SupportedCapabilityId;
  name: string;
  description: string;
  dependencies: SupportedCapabilityId[];
  manifest_value: SupportedCapabilityId;
  overlay_root: 'overlay';
  index_entries: CapabilityIndexEntry[];
  root_paths: string[];
}

export function normalizeCapabilityIds(values: readonly string[]): SupportedCapabilityId[] {
  const selected = new Set(values);
  return SUPPORTED_CAPABILITY_IDS.filter((capability) => selected.has(capability));
}
