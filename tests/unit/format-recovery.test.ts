import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { formatRecoveryDetails } from '../../src/presentation/format-recovery.js';

describe('recovery diagnostics', () => {
  it('uses a stable null path when no recovery material remains', () => {
    expect(formatRecoveryDetails([])).toEqual({
      recovery_retained: false,
      recovery_path: null,
    });
  });

  it('reports the exact retained path and removes duplicates', () => {
    const retainedPath = path.resolve('temporary', 'pcp-transaction-one');
    expect(formatRecoveryDetails([retainedPath, retainedPath])).toEqual({
      recovery_retained: true,
      recovery_path: retainedPath,
    });
  });

  it('preserves every path when nested transactions retain more than one location', () => {
    const workstreamPath = path.resolve('temporary', 'pcp-workstream-one');
    const eventPath = path.resolve('temporary', 'pcp-event-two');
    expect(formatRecoveryDetails([workstreamPath, eventPath])).toEqual({
      recovery_retained: true,
      recovery_path: workstreamPath,
      recovery_paths: [workstreamPath, eventPath],
    });
  });
});
