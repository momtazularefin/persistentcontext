export type CanonicalDiagnosticSeverity = 'error' | 'warning';

export interface CanonicalDiagnostic {
  severity: CanonicalDiagnosticSeverity;
  code: string;
  path: string;
  message: string;
}

export interface CanonicalValidationReport {
  valid: boolean;
  checked_files: number;
  diagnostics: CanonicalDiagnostic[];
}

export interface CanonicalValidationOptions {
  clean_genesis?: boolean;
  archive_content?: 'full' | 'filenames-only';
  legacy_upgrade_source?: '0.1';
  documentation_inventory?: 'full' | 'skip';
  /**
   * How generated adapters are judged. `rendered` compares each adapter's bytes
   * with what the running engine renders. `structure` checks the adapter set,
   * targets, canonical source, and manifest IDs but not content.
   *
   * `structure` exists for exactly one caller: an upgrade judging an installation
   * made by an older release. The incoming engine renders the new release's
   * adapters and cannot know the old release's bytes, so comparing content makes
   * every adapter change unupgradable, and those adapters are precisely the files
   * the upgrade regenerates. Post-upgrade validation stays `rendered`.
   */
  adapter_content?: 'rendered' | 'structure';
}

export function compareCanonicalDiagnostics(
  left: CanonicalDiagnostic,
  right: CanonicalDiagnostic,
): number {
  const leftKey = `${left.path}\u0000${left.severity}\u0000${left.code}\u0000${left.message}`;
  const rightKey = `${right.path}\u0000${right.severity}\u0000${right.code}\u0000${right.message}`;
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}
