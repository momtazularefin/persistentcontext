import { describe, expect, it } from 'vitest';

import { canonicalSourceDigestFromContents } from '../../src/infrastructure/canonical-source-digest.js';
import { byCodeUnits, compareCodeUnits } from '../../src/domain/ordering.js';

describe('deterministic ordering', () => {
  it('orders by code unit rather than by collation', () => {
    // ICU collation folds case and treats punctuation as variable, so a
    // locale-aware comparator can place 'a' before 'Z' and reorder names that
    // differ only by a separator. Code-unit order is total and host-independent.
    expect(compareCodeUnits('Z', 'a')).toBeLessThan(0);
    expect(compareCodeUnits('CHANGELOG.md', 'CONTRIBUTING.md')).toBeLessThan(0);
    expect(compareCodeUnits('a-b.md', 'ab.md')).toBeLessThan(0);
    expect(compareCodeUnits('same', 'same')).toBe(0);

    expect(['b', 'A', 'a', 'B'].sort(compareCodeUnits)).toEqual(['A', 'B', 'a', 'b']);
    expect([{ id: 'b' }, { id: 'A' }].sort(byCodeUnits((item) => item.id))).toEqual([
      { id: 'A' },
      { id: 'b' },
    ]);
  });

  it('derives one canonical digest regardless of the order the sources arrive in', () => {
    const sources = [
      { path: 'CONTRIBUTING.md', contents: 'contributing' },
      { path: 'CHANGELOG.md', contents: 'changelog' },
      { path: 'docs/architecture.md', contents: 'architecture' },
      { path: 'LICENSE', contents: 'license' },
      { path: 'state/vcs-policy.yaml', contents: 'policy' },
      { path: 'state/vcspolicy.yaml', contents: 'other' },
    ];
    const forward = canonicalSourceDigestFromContents([...sources]);
    const reversed = canonicalSourceDigestFromContents([...sources].reverse());
    const collated = canonicalSourceDigestFromContents(
      [...sources].sort((left, right) => left.path.localeCompare(right.path, 'cs-CZ')),
    );

    expect(reversed).toBe(forward);
    expect(collated).toBe(forward);
  });

  it('normalizes line endings so a checkout policy cannot change project identity', () => {
    expect(canonicalSourceDigestFromContents([{ path: 'a.md', contents: 'one\r\ntwo' }])).toBe(
      canonicalSourceDigestFromContents([{ path: 'a.md', contents: 'one\ntwo' }]),
    );
  });
});
