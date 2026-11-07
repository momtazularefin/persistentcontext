import { describe, expect, it } from 'vitest';

import {
  isFileReference,
  normalizePathReference,
  parseFileReference,
} from '../../src/domain/path-references.js';

describe('path references independent of the host platform', () => {
  it.each([
    ['/workspace/project', './docs/../src/index.ts/', 'src/index.ts'],
    ['/workspace/project', 'docs\\guide.md', 'docs/guide.md'],
    ['/workspace/project', '/workspace/project/docs/guide.md', 'docs/guide.md'],
    ['/workspace/project', 'file:///workspace/project/docs/a%20b.md', 'docs/a b.md'],
    ['/workspace/project', '/workspace/project', '.'],
    ['/workspace/project', '.', '.'],
    ['C:\\work\\project', 'c:/WORK/project/src/a.ts', 'src/a.ts'],
    ['C:\\work\\project', 'file:///C:/work/project/docs/a.md', 'docs/a.md'],
    ['C:\\work\\project', 'C:/work/project/', '.'],
    ['\\\\server\\share\\project', 'file://server/share/project/a.md', 'a.md'],
    ['/workspace/project', '/workspace/project-other/a.md', 'file:///workspace/project-other/a.md'],
    ['/workspace/project', '/opt/reference/a b#c%.md', 'file:///opt/reference/a%20b%23c%25.md'],
    ['C:\\work\\project', 'D:\\reference\\a.md', 'file:///D:/reference/a.md'],
    ['C:\\work\\project', 'C:/work/other/a.md', 'file:///C:/work/other/a.md'],
    ['/workspace/project', 'C:/reference/a.md', 'file:///C:/reference/a.md'],
    ['C:\\work\\project', '/opt/reference/a.md', 'file:///opt/reference/a.md'],
    ['/workspace/project', '//server/share/a b.md', 'file://server/share/a%20b.md'],
    ['/workspace/project', 'file:///D:/', 'file:///D:/'],
    ['/workspace/project', 'D:\\', 'file:///D:/'],
    ['/workspace/project', '/C:/reference/a.md', 'file:///C%3A/reference/a.md'],
    ['/workspace/project', '/\\server\\share', 'file:///%5Cserver%5Cshare'],
    ['C:\\work\\project', 'file://server/share/', 'file://server/share/'],
  ])('normalizes %s with %s to %s', (root, value, expected) => {
    expect(normalizePathReference(root, value)).toBe(expected);
  });

  it.each([
    '',
    '   ',
    'a\u0000b',
    'a\nb',
    'a\u0085b',
    '../other',
    'docs/../../other',
    'C:relative',
    '\\root-relative',
    ' \\root-relative',
    ' /reference',
    '\\\\?\\C:\\private',
    '\\\\.\\pipe\\name',
    '\\\\localhost\\share\\file.md',
    'https://example.com/a',
    'file:relative',
    'file:///tmp/a?query',
    'file:///tmp/a#fragment',
    'file:///tmp/a?',
    'file:///tmp/a#',
    'file://C:/reference/a',
    'file://user:pass@host/share/a',
    'file://host:123/share/a',
    'file:///tmp/a%2fb',
    'file:///C:/tmp/a%5Cb',
    'file:///tmp/a%00b',
    'file:///tmp/a%zz',
    'file:///C:',
    'file://server/',
    'file:///tmp/a b',
    ' file:///tmp/a',
  ])('rejects ambiguous or invalid reference %j', (value) => {
    expect(() => normalizePathReference('/workspace/project', value)).toThrow();
  });

  it('requires an absolute root and preserves Unicode and encoded filename characters', () => {
    expect(() => normalizePathReference('project', 'docs')).toThrow();
    expect(normalizePathReference('/workspace', '/reference/বাংলা#%.md')).toBe(
      'file:///reference/%E0%A6%AC%E0%A6%BE%E0%A6%82%E0%A6%B2%E0%A6%BE%23%25.md',
    );
    expect(normalizePathReference('/workspace', 'file:///reference/%252f.md')).toBe(
      'file:///reference/%252f.md',
    );
  });

  it('exposes a strict decoder and a scheme recognizer', () => {
    expect(parseFileReference('file:///C:/reference/a%20b.md')).toEqual({
      path: 'C:\\reference\\a b.md',
      windows: true,
    });
    expect(parseFileReference('file:///reference/a.md')).toEqual({
      path: '/reference/a.md',
      windows: false,
    });
    expect(isFileReference('FILE:///reference')).toBe(true);
    expect(isFileReference('file:invalid')).toBe(true);
    expect(isFileReference('docs/file.md')).toBe(false);
  });

  it.each([
    '/reference/a\\b.md',
    '/C:/reference/a.md',
    '/\\server\\share',
    '/reference/a b#c%.md',
    '/reference/বাংলা.md',
    'D:\\reference\\a b#c%.md',
    '\\\\server\\share\\a b#c%.md',
  ])('round-trips normalized external reference %j', (external) => {
    const normalized = normalizePathReference('/workspace/project', external);
    const decoded = parseFileReference(normalized);
    expect(decoded.path).toBe(external);
    expect(normalizePathReference('/workspace/project', normalized)).toBe(normalized);
  });
});
