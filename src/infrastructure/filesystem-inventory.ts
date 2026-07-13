import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, opendir, readFile, readlink, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import createIgnore, { type Ignore } from 'ignore';

import {
  comparePortablePaths,
  InspectionError,
  type ExcludedEntry,
  type ExclusionReason,
  type FileFingerprint,
  type RepositoryInventory,
  type SymlinkBoundary,
  type SymlinkFingerprint,
} from '../domain/inspection.js';

interface IgnoreContext {
  base: string;
  matcher: Ignore;
}

interface MutableInventory {
  directories: string[];
  files: FileFingerprint[];
  symlinks: SymlinkFingerprint[];
  exclusions: ExcludedEntry[];
  nestedRepositories: string[];
  bytes: number;
}

const generatedDirectoryNames = new Set([
  '.cache',
  '.gradle',
  '.next',
  '.nuxt',
  '.parcel-cache',
  '.pytest_cache',
  '.terraform',
  '.turbo',
  '.venv',
  '__pycache__',
  'bin',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'obj',
  'out',
  'target',
  'vendor',
  'venv',
]);

const versionControlDirectoryNames = new Set(['.git', '.hg', '.svn']);
const generatedFileNames = new Set(['.ds_store', 'thumbs.db']);

export function toPortablePath(value: string): string {
  return value.split(path.sep).join('/');
}

function isWithinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

export async function resolveCandidateRoot(candidate: string): Promise<string> {
  const resolved = path.resolve(candidate);

  if (path.parse(resolved).root === resolved) {
    throw new InspectionError(
      'PCP_UNSAFE_ROOT',
      'Refusing to inspect an entire filesystem root; select a project directory instead.',
    );
  }

  let metadata;
  try {
    metadata = await lstat(resolved);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new InspectionError('PCP_CANDIDATE_UNREADABLE', `Cannot inspect candidate: ${detail}`);
  }

  if (metadata.isSymbolicLink()) {
    throw new InspectionError(
      'PCP_UNSAFE_ROOT',
      'The candidate root is a symbolic link; select its real directory explicitly.',
    );
  }
  if (!metadata.isDirectory()) {
    throw new InspectionError('PCP_CANDIDATE_NOT_DIRECTORY', 'The candidate must be a directory.');
  }

  return resolved;
}

function exclusionForName(name: string, isDirectory: boolean): ExclusionReason | undefined {
  const normalized = name.toLowerCase();
  if (isDirectory && versionControlDirectoryNames.has(normalized)) {
    return 'version-control-metadata';
  }
  if (isDirectory && generatedDirectoryNames.has(normalized)) {
    return 'generated-or-vendor';
  }
  if (!isDirectory && generatedFileNames.has(normalized)) {
    return 'generated-or-vendor';
  }
  return undefined;
}

export function mutationPathExclusion(candidatePath: string): ExclusionReason | undefined {
  const segments = candidatePath.split('/');
  if (segments.some((segment) => versionControlDirectoryNames.has(segment.toLowerCase()))) {
    return 'version-control-metadata';
  }
  for (const segment of segments.slice(0, -1)) {
    const reason = exclusionForName(segment, true);
    if (reason !== undefined) return reason;
  }
  const finalSegment = segments.at(-1);
  return finalSegment === undefined ? undefined : exclusionForName(finalSegment, false);
}

function relativeFromBase(candidate: string, base: string): string | undefined {
  if (base === '') return candidate;
  if (candidate === base) return '';
  const prefix = `${base}/`;
  return candidate.startsWith(prefix) ? candidate.slice(prefix.length) : undefined;
}

function isIgnored(
  candidate: string,
  isDirectory: boolean,
  contexts: readonly IgnoreContext[],
): boolean {
  let ignored = false;
  const portableCandidate = isDirectory ? `${candidate}/` : candidate;

  for (const context of contexts) {
    const relative = relativeFromBase(portableCandidate, context.base);
    if (relative === undefined || relative === '') continue;
    const result = context.matcher.test(relative);
    if (result.ignored) ignored = true;
    if (result.unignored) ignored = false;
  }

  return ignored;
}

async function loadIgnoreContext(
  absoluteDirectory: string,
  relativeDirectory: string,
): Promise<IgnoreContext | undefined> {
  const ignorePath = path.join(absoluteDirectory, '.gitignore');
  try {
    const contents = await readFile(ignorePath, 'utf8');
    return {
      base: relativeDirectory,
      matcher: createIgnore({ allowRelativePaths: true, ignorecase: false }).add(contents),
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'EISDIR') return undefined;
    throw error;
  }
}

async function mutationIgnoreContexts(
  root: string,
  candidatePath: string,
): Promise<IgnoreContext[]> {
  const contexts: IgnoreContext[] = [];
  let absoluteDirectory = root;
  let relativeDirectory = '';
  const rootContext = await loadIgnoreContext(absoluteDirectory, relativeDirectory);
  if (rootContext !== undefined) contexts.push(rootContext);

  for (const segment of candidatePath.split('/').slice(0, -1)) {
    absoluteDirectory = path.join(absoluteDirectory, segment);
    relativeDirectory = relativeDirectory === '' ? segment : `${relativeDirectory}/${segment}`;
    let metadata;
    try {
      metadata = await lstat(absoluteDirectory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') break;
      throw error;
    }
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) break;
    const context = await loadIgnoreContext(absoluteDirectory, relativeDirectory);
    if (context !== undefined) contexts.push(context);
  }

  return contexts;
}

export async function isMutationPathIgnored(root: string, candidatePath: string): Promise<boolean> {
  const contexts = await mutationIgnoreContexts(root, candidatePath);

  return isIgnored(candidatePath, false, contexts);
}

export async function isMutationDirectoryIgnored(
  root: string,
  candidatePath: string,
): Promise<boolean> {
  const contexts = await mutationIgnoreContexts(root, candidatePath);
  return isIgnored(candidatePath, true, contexts);
}

async function hasNestedRepositoryMarker(absoluteDirectory: string): Promise<boolean> {
  try {
    await lstat(path.join(absoluteDirectory, '.git'));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function sha256File(absolutePath: string): Promise<string> {
  const before = await stat(absolutePath);
  const hash = createHash('sha256');

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(absolutePath);
    stream.on('data', (chunk: string | Buffer) => {
      hash.update(chunk);
    });
    stream.on('error', reject);
    stream.on('end', resolve);
  });

  const after = await stat(absolutePath);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
    throw new InspectionError(
      'PCP_SOURCE_CHANGED',
      `A file changed while it was being inspected: ${toPortablePath(absolutePath)}`,
    );
  }

  return hash.digest('hex');
}

async function inspectSymlink(
  root: string,
  absolutePath: string,
  relativePath: string,
): Promise<SymlinkFingerprint> {
  const rawTarget = await readlink(absolutePath);
  const targetSha256 = createHash('sha256').update(rawTarget).digest('hex');
  let boundary: SymlinkBoundary;

  try {
    const realTarget = await realpath(absolutePath);
    boundary = isWithinRoot(root, realTarget) ? 'internal' : 'external';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      boundary = 'broken';
    } else {
      throw error;
    }
  }

  return {
    path: relativePath,
    target: path.isAbsolute(rawTarget) ? '<absolute>' : toPortablePath(rawTarget),
    targetSha256,
    boundary,
  };
}

async function scanDirectory(
  root: string,
  absoluteDirectory: string,
  relativeDirectory: string,
  inheritedContexts: readonly IgnoreContext[],
  inventory: MutableInventory,
): Promise<void> {
  const localContext = await loadIgnoreContext(absoluteDirectory, relativeDirectory);
  const contexts =
    localContext === undefined ? inheritedContexts : [...inheritedContexts, localContext];
  const directory = await opendir(absoluteDirectory);

  for await (const entry of directory) {
    const absoluteEntry = path.join(absoluteDirectory, entry.name);
    const relativeEntry =
      relativeDirectory === '' ? entry.name : `${relativeDirectory}/${entry.name}`;
    const portableEntry = toPortablePath(relativeEntry);
    const metadata = await lstat(absoluteEntry);
    const isDirectory = metadata.isDirectory();

    const staticReason = exclusionForName(entry.name, isDirectory);
    if (staticReason !== undefined) {
      inventory.exclusions.push({ path: portableEntry, reason: staticReason });
      continue;
    }
    if (isIgnored(portableEntry, isDirectory, contexts)) {
      inventory.exclusions.push({ path: portableEntry, reason: 'gitignore' });
      continue;
    }

    if (metadata.isSymbolicLink()) {
      inventory.symlinks.push(await inspectSymlink(root, absoluteEntry, portableEntry));
      continue;
    }

    if (isDirectory) {
      if (await hasNestedRepositoryMarker(absoluteEntry)) {
        inventory.nestedRepositories.push(portableEntry);
        inventory.exclusions.push({ path: portableEntry, reason: 'nested-repository' });
        continue;
      }
      inventory.directories.push(portableEntry);
      await scanDirectory(root, absoluteEntry, portableEntry, contexts, inventory);
      continue;
    }

    if (metadata.isFile()) {
      const sha256 = await sha256File(absoluteEntry);
      inventory.files.push({ path: portableEntry, size: metadata.size, sha256 });
      inventory.bytes += metadata.size;
    }
  }
}

function inventoryDigest(inventory: MutableInventory): string {
  const hash = createHash('sha256');
  for (const directory of inventory.directories) {
    hash.update(`${JSON.stringify(['directory', directory])}\n`);
  }
  for (const file of inventory.files) {
    hash.update(`${JSON.stringify(['file', file.path, file.size, file.sha256])}\n`);
  }
  for (const link of inventory.symlinks) {
    hash.update(
      `${JSON.stringify(['symlink', link.path, link.target, link.targetSha256, link.boundary])}\n`,
    );
  }
  for (const nestedRepository of inventory.nestedRepositories) {
    hash.update(`${JSON.stringify(['nested-repository', nestedRepository])}\n`);
  }
  return hash.digest('hex');
}

export async function inventoryRepository(root: string): Promise<RepositoryInventory> {
  const inventory: MutableInventory = {
    directories: ['.'],
    files: [],
    symlinks: [],
    exclusions: [],
    nestedRepositories: [],
    bytes: 0,
  };

  await scanDirectory(root, root, '', [], inventory);
  inventory.directories.sort(comparePortablePaths);
  inventory.files.sort((left, right) => comparePortablePaths(left.path, right.path));
  inventory.symlinks.sort((left, right) => comparePortablePaths(left.path, right.path));
  inventory.exclusions.sort((left, right) => comparePortablePaths(left.path, right.path));
  inventory.nestedRepositories.sort(comparePortablePaths);

  return {
    digest: inventoryDigest(inventory),
    counts: {
      files: inventory.files.length,
      directories: inventory.directories.length,
      symlinks: inventory.symlinks.length,
      bytes: inventory.bytes,
      excluded: inventory.exclusions.length,
      nestedRepositories: inventory.nestedRepositories.length,
    },
    directories: inventory.directories,
    files: inventory.files,
    symlinks: inventory.symlinks,
    exclusions: inventory.exclusions,
    nestedRepositories: inventory.nestedRepositories,
  };
}
