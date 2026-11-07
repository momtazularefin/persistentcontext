import { parse } from 'yaml';
import path from 'node:path';
import { isFileReference, normalizePathReference } from '../domain/path-references.js';

// Support angle-bracket destinations and the balanced parentheses commonly
// found in installed tool directories, as well as ordinary inline links.
const LINK_DESTINATION = /(!?\[[^\]]*\]\()(<[^>\r\n]*>|(?:[^()\r\n]|\([^()\r\n]*\))+)(\))/g;

function unwrappedTarget(target: string): string {
  const trimmed = target.trim();
  return trimmed.startsWith('<') && trimmed.endsWith('>') ? trimmed.slice(1, -1) : trimmed;
}

export function normalizeMarkdownPathReferences(
  contents: string,
  projectRoot: string,
  documentPath: string,
): string {
  return contents.replace(
    LINK_DESTINATION,
    (match: string, prefix: string, target: string, suffix: string) => {
      const reference = unwrappedTarget(target);
      if (!isFileReference(reference) && !/^(?:[A-Za-z]:[\\/]|\/|\\\\)/.test(reference))
        return match;
      const normalized = normalizePathReference(projectRoot, reference);
      const replacement = isFileReference(normalized)
        ? normalized
        : encodeURI(path.posix.relative(path.posix.dirname(documentPath), normalized) || '.')
            .replaceAll('#', '%23')
            .replaceAll('?', '%3F');
      return `${prefix}${replacement.replaceAll('(', '%28').replaceAll(')', '%29')}${suffix}`;
    },
  );
}

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
  for (const link of contents.matchAll(LINK_DESTINATION)) {
    const target = link[2] === undefined ? undefined : unwrappedTarget(link[2]);
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
