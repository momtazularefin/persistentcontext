import { describe, expect, it } from 'vitest';
import {
  normalizeMarkdownPathReferences,
  parseCanonicalMarkdown,
} from '../../src/infrastructure/canonical-markdown.js';

describe('Markdown path reference normalization', () => {
  it('normalizes absolute links using the document location while preserving prose', () => {
    const markdown =
      '# Tools\n[Internal](/workspace/project/docs/a b#c.md)\n[External](R:/Program Files (x86)/tool.exe)\nQuoted R:/tools.\n';
    expect(
      normalizeMarkdownPathReferences(markdown, '/workspace/project', '.pcp/knowledge/10-tools.md'),
    ).toBe(
      '# Tools\n[Internal](../../docs/a%20b%23c.md)\n[External](file:///R:/Program%20Files%20%28x86%29/tool.exe)\nQuoted R:/tools.\n',
    );
  });

  it('parses angle-bracket and balanced destinations and preserves ordinary links', () => {
    const markdown =
      '---\ndoc: example.md\n---\n[External](<file:///opt/a%20b.md>)\n[Tool](file:///opt/tool(x86)/run)\n[Guide](../docs/guide.md)\n';
    expect(parseCanonicalMarkdown(markdown).links.map((link) => link.target)).toEqual([
      'file:///opt/a%20b.md',
      'file:///opt/tool(x86)/run',
      '../docs/guide.md',
    ]);
    expect(
      normalizeMarkdownPathReferences(
        '[Guide](../docs/guide.md)',
        '/workspace/project',
        '.pcp/00-index.md',
      ),
    ).toBe('[Guide](../docs/guide.md)');
  });
});
