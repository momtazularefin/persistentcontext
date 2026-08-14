import path from 'node:path';

import { isForeignAdapterSourcePath } from './adapters.js';
import { comparePortablePaths, type RepositoryInventory } from './inspection.js';

const DOCUMENTATION_EXTENSIONS = new Set(['.adoc', '.asciidoc', '.md', '.mdx', '.rst']);
const DOCUMENTATION_BASENAMES = new Set([
  'authors',
  'changelog',
  'code_of_conduct',
  'contributing',
  'copying',
  'license',
  'notice',
  'readme',
  'security',
]);
const DEDICATED_ROOT_PRIORITY = [
  'docs',
  'documentation',
  'doc',
  'handbook',
  'guides',
  'research',
  'specs',
] as const;

export interface DocumentationRootCandidate {
  path: string;
  document_paths: string[];
}

export interface DocumentationAssessment {
  document_paths: string[];
  root_candidates: DocumentationRootCandidate[];
  recommended_root: string;
  recommended_root_source: 'existing' | 'default';
}

function normalizedBasename(candidatePath: string): string {
  return path.posix.basename(candidatePath).toLowerCase();
}

export function isProjectDocumentationPath(candidatePath: string): boolean {
  const normalized = candidatePath.replaceAll('\\', '/');
  if (
    normalized === '.pcp' ||
    normalized.startsWith('.pcp/') ||
    isForeignAdapterSourcePath(normalized)
  ) {
    return false;
  }
  const basename = normalizedBasename(normalized);
  const extension = path.posix.extname(basename);
  return DOCUMENTATION_EXTENSIONS.has(extension) || DOCUMENTATION_BASENAMES.has(basename);
}

export function documentationPaths(
  inventory: RepositoryInventory,
  excludedPaths: ReadonlySet<string> = new Set(),
): string[] {
  return inventory.files
    .map((file) => file.path)
    .filter((candidatePath) => !excludedPaths.has(candidatePath))
    .filter(isProjectDocumentationPath)
    .sort(comparePortablePaths);
}

function topLevelRoot(candidatePath: string): string | undefined {
  const segments = candidatePath.split('/');
  return segments.length > 1 ? segments[0] : undefined;
}

export function assessDocumentation(inventory: RepositoryInventory): DocumentationAssessment {
  const documentPaths = documentationPaths(inventory);
  const byRoot = new Map<string, string[]>();
  for (const documentPath of documentPaths) {
    const root = topLevelRoot(documentPath);
    if (root === undefined) continue;
    const paths = byRoot.get(root) ?? [];
    paths.push(documentPath);
    byRoot.set(root, paths);
  }
  const rootCandidates = [...byRoot]
    .map(([candidatePath, paths]) => ({
      path: candidatePath,
      document_paths: paths.sort(comparePortablePaths),
    }))
    .sort((left, right) => comparePortablePaths(left.path, right.path));
  const directoryKeys = new Map(
    inventory.directories.map((directory) => [directory.toLowerCase(), directory] as const),
  );
  const selected = DEDICATED_ROOT_PRIORITY.map((candidate) => directoryKeys.get(candidate)).find(
    (candidate): candidate is string => candidate !== undefined,
  );

  return {
    document_paths: documentPaths,
    root_candidates: rootCandidates,
    recommended_root: selected ?? 'docs',
    recommended_root_source: selected === undefined ? 'default' : 'existing',
  };
}

export function isInsideDocumentationRoot(candidatePath: string, root: string): boolean {
  return candidatePath === root || candidatePath.startsWith(`${root}/`);
}
