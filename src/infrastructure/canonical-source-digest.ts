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

export async function canonicalSourceDigest(root: string, sources: string[]): Promise<string> {
  const hash = createHash('sha256');
  for (const source of [...sources].sort()) {
    const contents = normalizeSource(await readFile(resolveContained(root, source), 'utf8'));
    hash.update(source);
    hash.update('\0');
    hash.update(String(Buffer.byteLength(contents)));
    hash.update('\0');
    hash.update(contents);
    hash.update('\0');
  }
  return hash.digest('hex');
}
