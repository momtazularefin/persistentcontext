import type { CanonicalDiagnostic } from './canonical-validation.js';

export interface CanonicalRenderOptions {
  check?: boolean;
}

export interface CanonicalRenderReport {
  valid: boolean;
  mode: 'check' | 'write';
  changed_paths: string[];
  diagnostics: CanonicalDiagnostic[];
}

export interface CanonicalRenderBuild {
  valid: boolean;
  content?: string;
  diagnostics: CanonicalDiagnostic[];
}
