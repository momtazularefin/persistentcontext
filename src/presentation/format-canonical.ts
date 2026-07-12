import type { CanonicalRenderReport } from '../domain/canonical-rendering.js';
import type { CanonicalValidationReport } from '../domain/canonical-validation.js';

function diagnosticLines(
  diagnostics: Array<{ severity: string; code: string; path: string; message: string }>,
): string[] {
  return diagnostics.map(
    (diagnostic) =>
      `- ${diagnostic.severity.toUpperCase()} ${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`,
  );
}

export function formatCanonicalValidation(report: CanonicalValidationReport): string {
  const lines = [
    `PCP validation: ${report.valid ? 'valid' : 'invalid'}`,
    `Checked files: ${report.checked_files}`,
  ];
  if (report.diagnostics.length > 0) {
    lines.push('Diagnostics:', ...diagnosticLines(report.diagnostics));
  }
  return `${lines.join('\n')}\n`;
}

export function formatCanonicalRender(report: CanonicalRenderReport): string {
  const lines = [
    `PCP render ${report.mode}: ${report.valid ? 'current' : 'failed'}`,
    `Changed paths: ${report.changed_paths.length}`,
    ...report.changed_paths.map((changedPath) => `- ${changedPath}`),
  ];
  if (report.diagnostics.length > 0) {
    lines.push('Diagnostics:', ...diagnosticLines(report.diagnostics));
  }
  return `${lines.join('\n')}\n`;
}
