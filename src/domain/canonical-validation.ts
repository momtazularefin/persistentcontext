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
}

export function compareCanonicalDiagnostics(
  left: CanonicalDiagnostic,
  right: CanonicalDiagnostic,
): number {
  const leftKey = `${left.path}\u0000${left.severity}\u0000${left.code}\u0000${left.message}`;
  const rightKey = `${right.path}\u0000${right.severity}\u0000${right.code}\u0000${right.message}`;
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}
