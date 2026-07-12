import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

function normalizeSource(contents: string): string {
  return contents.replace(/\r\n?/g, '\n');
}

function resolveContained(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Canonical source escapes the .pcp root: ${relativePath}`);
  }
  return resolved;
}

export interface CanonicalSourceContent {
  path: string;
  contents: string;
}

export function canonicalSourceDigestFromContents(sources: CanonicalSourceContent[]): string {
  const hash = createHash('sha256');
  for (const source of [...sources].sort((left, right) => left.path.localeCompare(right.path))) {
    const contents = normalizeSource(source.contents);
    hash.update(source.path);
    hash.update('\0');
    hash.update(String(Buffer.byteLength(contents)));
    hash.update('\0');
    hash.update(contents);
    hash.update('\0');
  }
  return hash.digest('hex');
}

export async function canonicalSourceDigest(root: string, sources: string[]): Promise<string> {
  const contents = await Promise.all(
    sources.map(async (source) => ({
      path: source,
      contents: await readFile(resolveContained(root, source), 'utf8'),
    })),
  );
  return canonicalSourceDigestFromContents(contents);
}
