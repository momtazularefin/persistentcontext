import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AdoptionError } from '../domain/adoption.js';
import { comparePortablePaths } from '../domain/inspection.js';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

function candidateTemplateRoots(): string[] {
  return [
    path.resolve(moduleDirectory, '../../templates/core'),
    path.resolve(moduleDirectory, '../templates/core'),
    path.resolve(moduleDirectory, '../assets/templates/core'),
  ];
}

async function isCoreTemplateRoot(candidate: string): Promise<boolean> {
  try {
    const marker = await lstat(path.join(candidate, '.pcp', 'pcp.yaml'));
    return marker.isFile() && !marker.isSymbolicLink();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

export async function resolveCoreTemplateRoot(): Promise<string> {
  for (const candidate of candidateTemplateRoots()) {
    if (await isCoreTemplateRoot(candidate)) return candidate;
  }
  throw new AdoptionError(
    'PCP_ADOPTION_ASSETS_MISSING',
    'The verified core PCP template assets could not be located beside the engine.',
  );
}

async function collectFiles(
  directory: string,
  root: string,
  result: Array<{ path: string; content: Buffer }>,
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => comparePortablePaths(left.name, right.name));

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const metadata = await lstat(absolutePath);
    const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');
    if (metadata.isSymbolicLink()) {
      throw new AdoptionError(
        'PCP_ADOPTION_ASSET_SYMLINK',
        `The core template contains an unsupported symbolic link: ${relativePath}`,
      );
    }
    if (metadata.isDirectory()) {
      await collectFiles(absolutePath, root, result);
    } else if (metadata.isFile()) {
      result.push({ path: relativePath, content: await readFile(absolutePath) });
    }
  }
}

export async function loadCoreTemplateFiles(): Promise<ReadonlyMap<string, Buffer>> {
  const root = await resolveCoreTemplateRoot();
  const files: Array<{ path: string; content: Buffer }> = [];
  await collectFiles(root, root, files);
  files.sort((left, right) => comparePortablePaths(left.path, right.path));
  return new Map(files.map((file) => [file.path, file.content]));
}
