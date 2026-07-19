import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

import { AdoptionError, canonicalJson, normalizeText } from '../domain/adoption.js';
import {
  SUPPORTED_CAPABILITY_IDS,
  normalizeCapabilityIds,
  type CapabilityManifest,
  type SupportedCapabilityId,
} from '../domain/capabilities.js';
import { comparePortablePaths } from '../domain/inspection.js';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

function candidateTemplateRoots(): string[] {
  return [
    path.resolve(moduleDirectory, '../../templates/core'),
    path.resolve(moduleDirectory, '../templates/core'),
    path.resolve(moduleDirectory, '../assets/templates/core'),
  ];
}

function candidateCapabilityRoots(): string[] {
  return [
    path.resolve(moduleDirectory, '../../templates/capabilities'),
    path.resolve(moduleDirectory, '../templates/capabilities'),
    path.resolve(moduleDirectory, '../assets/templates/capabilities'),
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

async function isCapabilityTemplateRoot(candidate: string): Promise<boolean> {
  try {
    const entries = await readdir(candidate, { withFileTypes: true });
    return SUPPORTED_CAPABILITY_IDS.every((capability) =>
      entries.some((entry) => entry.isDirectory() && entry.name === capability),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

export async function resolveCapabilityTemplateRoot(): Promise<string> {
  for (const candidate of candidateCapabilityRoots()) {
    if (await isCapabilityTemplateRoot(candidate)) return candidate;
  }
  throw new AdoptionError(
    'PCP_ADOPTION_ASSETS_MISSING',
    'The verified PCP capability assets could not be located beside the engine.',
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
        `A PCP template contains an unsupported symbolic link: ${relativePath}`,
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

function isPortableRelativePath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === path.posix.normalize(value) &&
    value !== '.' &&
    !value.startsWith('../') &&
    !value.startsWith('/') &&
    !value.includes('\\')
  );
}

function capabilityManifest(value: unknown, expected: SupportedCapabilityId): CapabilityManifest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AdoptionError(
      'PCP_ADOPTION_CAPABILITY_INVALID',
      `Capability ${expected} has an invalid manifest.`,
    );
  }
  const item = value as Record<string, unknown>;
  const dependencies = item.dependencies;
  const indexEntries = item.index_entries;
  const rootPaths = item.root_paths;
  if (
    item.schema_version !== 1 ||
    item.capability_id !== expected ||
    item.manifest_value !== expected ||
    item.overlay_root !== 'overlay' ||
    typeof item.name !== 'string' ||
    typeof item.description !== 'string' ||
    !Array.isArray(dependencies) ||
    !dependencies.every(
      (entry) =>
        typeof entry === 'string' &&
        (SUPPORTED_CAPABILITY_IDS as readonly string[]).includes(entry),
    ) ||
    !Array.isArray(indexEntries) ||
    !indexEntries.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        !Array.isArray(entry) &&
        isPortableRelativePath((entry as Record<string, unknown>).folder) &&
        isPortableRelativePath((entry as Record<string, unknown>).path) &&
        typeof (entry as Record<string, unknown>).title === 'string',
    ) ||
    !Array.isArray(rootPaths) ||
    !rootPaths.every(isPortableRelativePath)
  ) {
    throw new AdoptionError(
      'PCP_ADOPTION_CAPABILITY_INVALID',
      `Capability ${expected} has malformed or unsafe metadata.`,
    );
  }
  return value as CapabilityManifest;
}

export interface LoadedCapabilityTemplates {
  manifests: CapabilityManifest[];
  files: ReadonlyMap<string, Buffer>;
}

const EMBEDDED_CAPABILITY_MANIFESTS: Readonly<Record<SupportedCapabilityId, CapabilityManifest>> = {
  'concurrent-execution-blocks': {
    schema_version: 1,
    capability_id: 'concurrent-execution-blocks',
    name: 'Concurrent Execution Blocks',
    description:
      'Adds dependency-aware parallel work guidance and a human-readable scaffold over the core workstream lifecycle.',
    dependencies: [],
    manifest_value: 'concurrent-execution-blocks',
    overlay_root: 'overlay',
    index_entries: [
      {
        folder: 'protocol',
        path: '90-concurrent-execution-blocks.md',
        title: 'Concurrent Execution Blocks',
      },
      { folder: 'templates', path: '40-workstream.md', title: 'Workstream scaffold' },
    ],
    root_paths: [],
  },
  'scratch-space': {
    schema_version: 1,
    capability_id: 'scratch-space',
    name: 'Scratch space',
    description:
      'Adds a noncanonical root scratch area for temporary exploration without weakening canonical documentation rules.',
    dependencies: [],
    manifest_value: 'scratch-space',
    overlay_root: 'overlay',
    index_entries: [{ folder: 'protocol', path: '100-scratch-space.md', title: 'Scratch space' }],
    root_paths: ['scratch/README.md'],
  },
  'spec-driven-projects': {
    schema_version: 1,
    capability_id: 'spec-driven-projects',
    name: 'Spec-driven projects',
    description:
      'Adds a bounded spec-to-plan-to-task delivery contract and an inert project specification scaffold.',
    dependencies: [],
    manifest_value: 'spec-driven-projects',
    overlay_root: 'overlay',
    index_entries: [
      { folder: 'protocol', path: '80-spec-driven-delivery.md', title: 'Spec-driven delivery' },
      {
        folder: 'templates',
        path: '30-project-spec.md',
        title: 'Project specification scaffold',
      },
    ],
    root_paths: [],
  },
  walkthroughs: {
    schema_version: 1,
    capability_id: 'walkthroughs',
    name: 'Incremental walkthroughs',
    description:
      'Adds a living FAQ workflow for building verified user guidance from real questions and answers.',
    dependencies: [],
    manifest_value: 'walkthroughs',
    overlay_root: 'overlay',
    index_entries: [
      { folder: 'protocol', path: '110-walkthrough-creation.md', title: 'Walkthrough creation' },
      { folder: 'templates', path: '50-walkthrough.md', title: 'Walkthrough scaffold' },
    ],
    root_paths: [],
  },
};

export function loadCapabilityManifests(selectedValues: readonly string[]): CapabilityManifest[] {
  const selected = normalizeCapabilityIds(selectedValues);
  if (selected.length !== new Set(selectedValues).size) {
    throw new AdoptionError(
      'PCP_ADOPTION_CAPABILITY_INVALID',
      'Capability selection contains an unknown or duplicate value.',
    );
  }
  return selected.map((capability) => structuredClone(EMBEDDED_CAPABILITY_MANIFESTS[capability]));
}

export async function loadCapabilityTemplateFiles(
  selectedValues: readonly string[],
): Promise<LoadedCapabilityTemplates> {
  const manifests = loadCapabilityManifests(selectedValues);
  if (manifests.length === 0) return { manifests, files: new Map() };

  const root = await resolveCapabilityTemplateRoot();
  const files = new Map<string, Buffer>();
  for (const manifest of manifests) {
    const capability = manifest.capability_id;
    const capabilityRoot = path.join(root, capability);
    const assetManifest = capabilityManifest(
      parse(await readFile(path.join(capabilityRoot, 'capability.yaml'), 'utf8')),
      capability,
    );
    if (canonicalJson(assetManifest) !== canonicalJson(manifest)) {
      throw new AdoptionError(
        'PCP_ADOPTION_CAPABILITY_INVALID',
        `Capability ${capability} asset metadata does not match the bundled release contract.`,
      );
    }
    for (const dependency of manifest.dependencies) {
      if (!manifests.some((selected) => selected.capability_id === dependency)) {
        throw new AdoptionError(
          'PCP_ADOPTION_CAPABILITY_DEPENDENCY',
          `Capability ${capability} requires ${dependency}.`,
        );
      }
    }

    const overlayRoot = path.join(capabilityRoot, manifest.overlay_root);
    const collected: Array<{ path: string; content: Buffer }> = [];
    await collectFiles(overlayRoot, overlayRoot, collected);
    const declaredMarkdown = new Set(
      manifest.index_entries.map((entry) => `.pcp/${entry.folder}/${entry.path}`),
    );
    for (const file of collected) {
      if (files.has(file.path)) {
        throw new AdoptionError(
          'PCP_ADOPTION_CAPABILITY_COLLISION',
          `Selected capability overlays collide at ${file.path}.`,
        );
      }
      if (
        file.path.startsWith('.pcp/') &&
        file.path.endsWith('.md') &&
        !declaredMarkdown.has(file.path)
      ) {
        throw new AdoptionError(
          'PCP_ADOPTION_CAPABILITY_INVALID',
          `Capability ${capability} has an undeclared canonical document: ${file.path}.`,
        );
      }
      files.set(file.path, file.content);
    }
    for (const declared of declaredMarkdown) {
      if (!files.has(declared)) {
        throw new AdoptionError(
          'PCP_ADOPTION_CAPABILITY_INVALID',
          `Capability ${capability} declares a missing document: ${declared}.`,
        );
      }
    }
    for (const rootPath of manifest.root_paths) {
      if (!files.has(rootPath)) {
        throw new AdoptionError(
          'PCP_ADOPTION_CAPABILITY_INVALID',
          `Capability ${capability} declares a missing root path: ${rootPath}.`,
        );
      }
    }
  }
  return { manifests, files };
}

function addCapabilityIndexEntry(source: Buffer, linkPath: string, title: string): Buffer {
  const text = normalizeText(source.toString('utf8'));
  const link = `[${linkPath}](${linkPath})`;
  if (text.includes(link)) return source;
  const lines = text.trimEnd().split('\n');
  const insertion = lines.findIndex((line) => line.startsWith('Optional capabilities '));
  if (insertion < 0) {
    throw new AdoptionError(
      'PCP_ADOPTION_CAPABILITY_INVALID',
      `Capability index has no extension marker for ${linkPath}.`,
    );
  }
  const highest = lines.reduce((value, line) => {
    const number = /^(\d+)\. /u.exec(line)?.[1];
    return number === undefined ? value : Math.max(value, Number(number));
  }, 0);
  lines.splice(insertion, 0, `${highest + 1}. ${link} — ${title}.`, '');
  return Buffer.from(`${lines.join('\n')}\n`, 'utf8');
}

export interface LoadedReleaseTemplates {
  manifests: CapabilityManifest[];
  files: ReadonlyMap<string, Buffer>;
}

export async function loadReleaseTemplateFiles(
  selectedValues: readonly string[],
): Promise<LoadedReleaseTemplates> {
  const files = new Map(await loadCoreTemplateFiles());
  const capabilities = await loadCapabilityTemplateFiles(selectedValues);
  for (const capability of capabilities.manifests) {
    for (const entry of capability.index_entries) {
      const indexPath = `.pcp/${entry.folder}/00-index.md`;
      const index = files.get(indexPath);
      if (index === undefined) {
        throw new AdoptionError(
          'PCP_ADOPTION_CAPABILITY_INVALID',
          `Capability ${capability.capability_id} targets a missing index: ${indexPath}.`,
        );
      }
      files.set(indexPath, addCapabilityIndexEntry(index, entry.path, entry.title));
    }
  }
  for (const [overlayPath, content] of capabilities.files) {
    if (files.has(overlayPath)) {
      throw new AdoptionError(
        'PCP_ADOPTION_CAPABILITY_COLLISION',
        `Capability overlay collides with core content: ${overlayPath}.`,
      );
    }
    files.set(overlayPath, content);
  }
  return { manifests: capabilities.manifests, files };
}
