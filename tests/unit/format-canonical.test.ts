import { describe, expect, it } from 'vitest';

import {
  formatCanonicalRender,
  formatCanonicalValidation,
} from '../../src/presentation/format-canonical.js';

describe('canonical command formatting', () => {
  it('formats validation diagnostics for humans', () => {
    const output = formatCanonicalValidation({
      valid: false,
      checked_files: 4,
      diagnostics: [
        {
          severity: 'error',
          code: 'layer.required-path',
          path: 'state/project.yaml',
          message: 'Required canonical core file is missing.',
        },
      ],
    });

    expect(output).toContain('PCP validation: invalid');
    expect(output).toContain('Checked files: 4');
    expect(output).toContain('ERROR layer.required-path state/project.yaml');
  });

  it('formats render changes and diagnostics for humans', () => {
    const output = formatCanonicalRender({
      valid: false,
      mode: 'check',
      changed_paths: ['.pcp/views/10-status.generated.md'],
      diagnostics: [
        {
          severity: 'error',
          code: 'render.stale',
          path: '.pcp/views/10-status.generated.md',
          message: 'Generated status view is stale.',
        },
      ],
    });

    expect(output).toContain('PCP render check: failed');
    expect(output).toContain('Changed paths: 1');
    expect(output).toContain('ERROR render.stale');
  });
});
