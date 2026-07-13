import { parse } from 'yaml';

export interface MarkdownLink {
  target: string;
  line: number;
}

export interface ParsedCanonicalMarkdown {
  frontmatter: unknown;
  body: string;
  links: MarkdownLink[];
}

function lineNumber(contents: string, offset: number): number {
  return contents.slice(0, offset).split(/\r?\n/).length;
}

export function parseCanonicalMarkdown(contents: string): ParsedCanonicalMarkdown {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(contents);
  if (match?.[1] === undefined) {
    throw new Error('Canonical Markdown must start with a YAML frontmatter block.');
  }

  const links: MarkdownLink[] = [];
  const expression = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const link of contents.matchAll(expression)) {
    const target = link[1]?.trim();
    if (target !== undefined && target.length > 0) {
      links.push({ target, line: lineNumber(contents, link.index) });
    }
  }

  return {
    frontmatter: parse(match[1]) as unknown,
    body: contents.slice(match[0].length),
    links,
  };
}
