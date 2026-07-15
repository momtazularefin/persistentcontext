import { describe, expect, it } from 'vitest';

import { PCP_NAME, PCP_RELEASE_STAGE, PCP_VERSION } from '../../src/domain/release.js';

describe('release identity', () => {
  it('uses the locked public identity', () => {
    expect(PCP_NAME).toBe('Persistent Context Protocol');
    expect(PCP_VERSION).toBe('0.1.0');
    expect(PCP_RELEASE_STAGE).toBe('actor-registration');
  });
});
