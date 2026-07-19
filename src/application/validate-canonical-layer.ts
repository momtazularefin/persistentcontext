import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { parseDocument } from 'yaml';

import {
  validateCanonicalSemantics,
  type CanonicalRecord,
  type CanonicalSemanticRecords,
} from '../domain/canonical-semantics.js';
import {
  compareCanonicalDiagnostics,
  type CanonicalDiagnostic,
  type CanonicalValidationOptions,
  type CanonicalValidationReport,
} from '../domain/canonical-validation.js';
import type { SchemaName } from '../domain/schema-catalog.js';
import {
  parseCanonicalMarkdown,
  type ParsedCanonicalMarkdown,
} from '../infrastructure/canonical-markdown.js';
import {
  matchingOwnershipClasses,
  type OwnershipPatterns,
} from '../infrastructure/canonical-ownership.js';
import { canonicalSourceDigest } from '../infrastructure/canonical-source-digest.js';
import { loadCapabilityManifests } from '../infrastructure/adoption-assets.js';
import { SchemaRegistry } from '../infrastructure/schema-validator.js';
import { renderPlatformAdapters } from './render-platform-adapters.js';
import { validatePlatformAdapters } from './validate-platform-adapters.js';

interface CanonicalFile {
  absolute_path: string;
  relative_path: string;
}

interface MarkdownRecord extends CanonicalFile {
  contents: string;
  parsed: ParsedCanonicalMarkdown;
  metadata: Record<string, unknown> | undefined;
}

interface LoadedYaml extends CanonicalRecord {
  schema: SchemaName;
}

const GENERATED_MARKER = '<!-- PCP: GENERATED; DO NOT EDIT -->';
const REQUIRED_CANONICAL_PATHS = [
  '.gitignore',
  '00-index.md',
  'continuity/00-index.md',
  'continuity/actors/00-index.md',
  'continuity/archive/00-index.md',
  'continuity/checkpoints/00-index.md',
  'continuity/events/00-index.md',
  'knowledge/00-index.md',
  'operations/00-index.md',
  'pcp.yaml',
  'projects/00-index.md',
  'protocol/00-index.md',
  'references/00-index.md',
  'schemas/00-index.md',
  'state/00-index.md',
  'state/project.yaml',
  'state/projects.yaml',
  'state/vcs-policy.yaml',
  'state/workstreams.yaml',
  'templates/00-index.md',
  'tools/00-index.md',
  'tools/pcp.mjs',
  'tools/pcp.sha256',
  'views/00-index.md',
] as const;
const TEXT_FILE_PATTERN = /(?:\.md|\.ya?ml|\.json|\.mjs|\.js|\.ts|\.txt|\.gitignore)$/i;
const WINDOWS_ABSOLUTE_PATH = /\b[A-Za-z]:[\\/][^\s`"'<>]+/;
const FILE_URI = /^file:\/\//i;
const SECRET_PATTERNS: Array<[string, RegExp]> = [
  ['secret.private-key', /-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/],
  ['secret.aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['secret.github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['secret.openai-key', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  [
    'secret.assignment',
    /\b(?:password|passwd|api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9+/_=-]{12,}/i,
  ],
];

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : undefined;
}

function relativeFrom(root: string, target: string): string {
  return path.relative(root, target).split(path.sep).join('/');
}

function isInside(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
}

function issue(code: string, relativePath: string, message: string): CanonicalDiagnostic {
  return { severity: 'error', code, path: relativePath, message };
}

async function collectFiles(
  directory: string,
  layerRoot: string,
  diagnostics: CanonicalDiagnostic[],
): Promise<CanonicalFile[]> {
  const files: CanonicalFile[] = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    diagnostics.push(
      issue(
        'filesystem.read-failed',
        relativeFrom(layerRoot, directory) || '.',
        error instanceof Error ? error.message : 'Unable to read canonical directory.',
      ),
    );
    return files;
  }

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = relativeFrom(layerRoot, absolutePath);
    if (entry.isSymbolicLink()) {
      diagnostics.push(
        issue('path.symlink', relativePath, 'Symlinks are not allowed inside the canonical layer.'),
      );
    } else if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath, layerRoot, diagnostics)));
    } else if (entry.isFile()) {
      files.push({ absolute_path: absolutePath, relative_path: relativePath });
    }
  }
  return files;
}

function schemaForPath(relativePath: string): SchemaName | undefined {
  if (relativePath === 'pcp.yaml') return 'pcp-manifest';
  if (relativePath === 'state/project.yaml') return 'project';
  if (relativePath === 'state/projects.yaml') return 'project-registry';
  if (relativePath === 'state/workstreams.yaml') return 'workstreams';
  if (relativePath === 'state/vcs-policy.yaml') return 'vcs-policy';
  if (/^continuity\/actors\/[^/]+\.yaml$/.test(relativePath)) return 'actor-profile';
  if (/^continuity\/(?:events|archive)\/[^/]+\.yaml$/.test(relativePath)) {
    return 'event';
  }
  if (/^continuity\/checkpoints\/[^/]+\.yaml$/.test(relativePath)) return 'checkpoint';
  return undefined;
}

function addSemanticRecord(records: CanonicalSemanticRecords, record: LoadedYaml): void {
  if (record.path === 'state/project.yaml') records.project = record;
  if (record.path === 'state/projects.yaml') records.project_registry = record;
  if (record.path === 'state/workstreams.yaml') records.workstreams = record;
  if (record.path === 'state/vcs-policy.yaml') records.vcs_policy = record;
  if (record.schema === 'actor-profile') records.actors.push(record);
  if (record.schema === 'event') records.events.push(record);
  if (record.schema === 'checkpoint') records.checkpoints.push(record);
}

function ownershipPatterns(manifest: unknown): OwnershipPatterns | undefined {
  const ownership = objectValue(objectValue(manifest)?.ownership);
  if (ownership === undefined) return undefined;
  const protocol = stringArray(ownership.protocol);
  const project = stringArray(ownership.project);
  const generated = stringArray(ownership.generated);
  const runtime = stringArray(ownership.runtime);
  return protocol !== undefined &&
    project !== undefined &&
    generated !== undefined &&
    runtime !== undefined
    ? { protocol, project, generated, runtime }
    : undefined;
}

function pathNumber(fileName: string): number | undefined {
  const match = /^(\d+)-[a-z0-9]+(?:-[a-z0-9]+)*(?:\.generated)?\.md$/.exec(fileName);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

function normalizedLinkTarget(target: string): string {
  const withoutAngles =
    target.startsWith('<') && target.endsWith('>') ? target.slice(1, -1) : target;
  return withoutAngles.split('#', 1)[0]?.split('?', 1)[0] ?? '';
}

async function validateMarkdownLinks(
  projectRoot: string,
  layerRoot: string,
  records: MarkdownRecord[],
  diagnostics: CanonicalDiagnostic[],
): Promise<Map<string, Set<string>>> {
  const graph = new Map<string, Set<string>>();
  const canonicalMarkdown = new Set(records.map((record) => path.resolve(record.absolute_path)));

  for (const record of records) {
    const edges = new Set<string>();
    graph.set(path.resolve(record.absolute_path), edges);
    for (const link of record.parsed.links) {
      const diagnosticPath = `${record.relative_path}:${link.line}`;
      const rawTarget = link.target;
      if (rawTarget.startsWith('#')) continue;
      if (FILE_URI.test(rawTarget)) {
        diagnostics.push(issue('link.file-uri', diagnosticPath, 'file:// links are not portable.'));
        continue;
      }
      if (WINDOWS_ABSOLUTE_PATH.test(rawTarget) || rawTarget.startsWith('/')) {
        diagnostics.push(
          issue('link.absolute', diagnosticPath, `Link must be repository-relative: ${rawTarget}`),
        );
        continue;
      }
      if (rawTarget.includes('\\')) {
        diagnostics.push(
          issue('link.backslash', diagnosticPath, `Link must use forward slashes: ${rawTarget}`),
        );
        continue;
      }
      if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(rawTarget)) {
        if (!/^(?:https?|mailto):/i.test(rawTarget)) {
          diagnostics.push(
            issue(
              'link.unsupported-scheme',
              diagnosticPath,
              `Unsupported link scheme: ${rawTarget}`,
            ),
          );
        }
        continue;
      }

      let relativeTarget: string;
      try {
        relativeTarget = decodeURIComponent(normalizedLinkTarget(rawTarget));
      } catch {
        diagnostics.push(
          issue('link.encoding', diagnosticPath, `Invalid URL encoding: ${rawTarget}`),
        );
        continue;
      }
      if (relativeTarget.length === 0) continue;
      const target = path.resolve(path.dirname(record.absolute_path), relativeTarget);
      if (!isInside(projectRoot, target)) {
        diagnostics.push(
          issue(
            'link.outside-project',
            diagnosticPath,
            `Link escapes the project root: ${rawTarget}`,
          ),
        );
        continue;
      }
      try {
        await stat(target);
      } catch {
        diagnostics.push(
          issue('link.missing', diagnosticPath, `Link target does not exist: ${rawTarget}`),
        );
        continue;
      }
      if (isInside(layerRoot, target) && canonicalMarkdown.has(target)) edges.add(target);
    }
  }
  return graph;
}

function validateMarkdownStructure(
  layerRoot: string,
  records: MarkdownRecord[],
  graph: Map<string, Set<string>>,
  diagnostics: CanonicalDiagnostic[],
): void {
  const byDirectory = new Map<string, MarkdownRecord[]>();
  for (const record of records) {
    const directory = path.dirname(record.absolute_path);
    const siblings = byDirectory.get(directory) ?? [];
    siblings.push(record);
    byDirectory.set(directory, siblings);

    const number = pathNumber(path.basename(record.absolute_path));
    if (number === undefined) {
      diagnostics.push(
        issue(
          'markdown.numbering',
          record.relative_path,
          'Canonical Markdown filenames must use a numeric kebab-case prefix.',
        ),
      );
    } else if (number % 10 !== 0) {
      diagnostics.push(
        issue(
          'markdown.increment',
          record.relative_path,
          'Canonical Markdown numbers must use increments of ten.',
        ),
      );
    }
  }

  for (const [directory, siblings] of byDirectory) {
    const index = siblings.find((record) => path.basename(record.absolute_path) === '00-index.md');
    if (index === undefined) {
      diagnostics.push(
        issue(
          'index.missing',
          relativeFrom(layerRoot, directory) || '.',
          'Every canonical Markdown folder must contain 00-index.md.',
        ),
      );
      continue;
    }
    const seenNumbers = new Map<number, string>();
    for (const sibling of siblings) {
      const number = pathNumber(path.basename(sibling.absolute_path));
      if (number === undefined) continue;
      const previous = seenNumbers.get(number);
      if (previous !== undefined) {
        diagnostics.push(
          issue(
            'markdown.duplicate-number',
            sibling.relative_path,
            `Reading-order number ${number} duplicates ${previous}.`,
          ),
        );
      } else {
        seenNumbers.set(number, sibling.relative_path);
      }
    }

    const indexTargets = graph.get(path.resolve(index.absolute_path)) ?? new Set<string>();
    for (const sibling of siblings) {
      if (sibling === index) continue;
      if (!indexTargets.has(path.resolve(sibling.absolute_path))) {
        diagnostics.push(
          issue(
            'index.unlisted-document',
            index.relative_path,
            `Folder index does not link ${path.basename(sibling.absolute_path)}.`,
          ),
        );
      }
    }
  }

  const rootIndex = path.resolve(layerRoot, '00-index.md');
  const reached = new Set<string>();
  const queue = [rootIndex];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (reached.has(current)) continue;
    reached.add(current);
    queue.push(...(graph.get(current) ?? []));
  }
  for (const record of records) {
    if (!reached.has(path.resolve(record.absolute_path))) {
      diagnostics.push(
        issue(
          'markdown.orphan',
          record.relative_path,
          'Canonical Markdown is not reachable from .pcp/00-index.md.',
        ),
      );
    }
  }
}

function validatePortableYamlStrings(
  value: unknown,
  relativePath: string,
  diagnostics: CanonicalDiagnostic[],
  pointer = '',
): void {
  if (typeof value === 'string') {
    if (WINDOWS_ABSOLUTE_PATH.test(value) || /^\/(?:Users|home|etc|var|tmp)\//.test(value)) {
      diagnostics.push(
        issue(
          'path.absolute',
          `${relativePath}#${pointer || '/'}`,
          'Canonical YAML contains an absolute path.',
        ),
      );
    }
    if (FILE_URI.test(value)) {
      diagnostics.push(
        issue(
          'path.file-uri',
          `${relativePath}#${pointer || '/'}`,
          'Canonical YAML contains a file:// URI.',
        ),
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      validatePortableYamlStrings(item, relativePath, diagnostics, `${pointer}/${index}`);
    });
    return;
  }
  const object = objectValue(value);
  if (object !== undefined) {
    for (const [key, item] of Object.entries(object)) {
      validatePortableYamlStrings(item, relativePath, diagnostics, `${pointer}/${key}`);
    }
  }
}

function validateTextSafety(
  relativePath: string,
  contents: string,
  diagnostics: CanonicalDiagnostic[],
): void {
  if (WINDOWS_ABSOLUTE_PATH.test(contents)) {
    diagnostics.push(
      issue(
        'path.absolute-text',
        relativePath,
        'Canonical content contains a machine-specific drive path.',
      ),
    );
  }
  for (const [code, pattern] of SECRET_PATTERNS) {
    if (pattern.test(contents)) {
      diagnostics.push(
        issue(code, relativePath, 'Canonical content appears to contain secret material.'),
      );
    }
  }
}

async function validateOwnership(
  layerRoot: string,
  files: CanonicalFile[],
  markdown: Map<string, MarkdownRecord>,
  patterns: OwnershipPatterns,
  diagnostics: CanonicalDiagnostic[],
): Promise<void> {
  for (const file of files) {
    const matches = matchingOwnershipClasses(file.relative_path, patterns);
    if (matches.length === 0) {
      diagnostics.push(
        issue(
          'ownership.unowned',
          file.relative_path,
          'File does not match any manifest ownership class.',
        ),
      );
      continue;
    }
    if (matches.length > 1) {
      diagnostics.push(
        issue(
          'ownership.collision',
          file.relative_path,
          `File matches multiple ownership classes: ${matches.join(', ')}.`,
        ),
      );
      continue;
    }

    const record = markdown.get(file.relative_path);
    if (record === undefined) continue;
    const declared = record.metadata?.ownership;
    if (declared !== matches[0]) {
      diagnostics.push(
        issue(
          'ownership.frontmatter-mismatch',
          file.relative_path,
          `Frontmatter ownership ${String(declared)} does not match manifest ownership ${matches[0]}.`,
        ),
      );
    }

    if (matches[0] === 'generated') {
      if (!record.contents.includes(GENERATED_MARKER)) {
        diagnostics.push(
          issue(
            'generated.editable',
            file.relative_path,
            `Generated Markdown must contain ${GENERATED_MARKER}.`,
          ),
        );
      }
      const sources = stringArray(record.metadata?.sources);
      const expectedDigest = record.metadata?.source_digest;
      if (sources !== undefined && typeof expectedDigest === 'string') {
        try {
          const actualDigest = await canonicalSourceDigest(layerRoot, sources);
          if (actualDigest !== expectedDigest) {
            diagnostics.push(
              issue(
                'generated.stale',
                file.relative_path,
                `Generated source digest is stale; expected ${actualDigest}.`,
              ),
            );
          }
        } catch (error) {
          diagnostics.push(
            issue(
              'generated.source',
              file.relative_path,
              error instanceof Error ? error.message : 'Unable to read a generated-view source.',
            ),
          );
        }
      }
    } else if (
      record.metadata?.sources !== undefined ||
      record.metadata?.source_digest !== undefined
    ) {
      diagnostics.push(
        issue(
          'generated.metadata-on-source',
          file.relative_path,
          'Only generated Markdown may declare sources or a source digest.',
        ),
      );
    }
  }
}

function assignLoadedYaml(
  loaded: Map<string, LoadedYaml>,
  relativePath: string,
  schema: SchemaName,
  value: unknown,
): void {
  loaded.set(relativePath, { path: relativePath, schema, value });
}

export async function validateCanonicalLayer(
  projectRoot: string,
  options: CanonicalValidationOptions = {},
): Promise<CanonicalValidationReport> {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const layerRoot = path.join(resolvedProjectRoot, '.pcp');
  const diagnostics: CanonicalDiagnostic[] = [];

  try {
    if (!(await stat(layerRoot)).isDirectory()) {
      diagnostics.push(issue('layer.missing', '.pcp', '.pcp exists but is not a directory.'));
    }
  } catch {
    diagnostics.push(issue('layer.missing', '.pcp', 'Project does not contain a .pcp directory.'));
    return { valid: false, checked_files: 0, diagnostics };
  }

  const files = await collectFiles(layerRoot, layerRoot, diagnostics);
  const presentPaths = new Set(files.map((file) => file.relative_path));
  for (const requiredPath of REQUIRED_CANONICAL_PATHS) {
    if (!presentPaths.has(requiredPath)) {
      diagnostics.push(
        issue('layer.required-path', requiredPath, 'Required canonical core file is missing.'),
      );
    }
  }
  if (presentPaths.has('tools/pcp.mjs') && presentPaths.has('tools/pcp.sha256')) {
    const engineBytes = await readFile(path.join(layerRoot, 'tools', 'pcp.mjs'));
    const checksum = await readFile(path.join(layerRoot, 'tools', 'pcp.sha256'), 'utf8');
    const actual = createHash('sha256').update(engineBytes).digest('hex');
    if (checksum !== `${actual}  pcp.mjs\n`) {
      diagnostics.push(
        issue(
          'engine.checksum',
          'tools/pcp.sha256',
          'Installed engine checksum does not match tools/pcp.mjs.',
        ),
      );
    }
  }
  const schemaRegistry = new SchemaRegistry();
  const loadedYaml = new Map<string, LoadedYaml>();
  const semanticRecords: CanonicalSemanticRecords = {
    actors: [],
    events: [],
    checkpoints: [],
  };

  for (const file of files.filter((item) => /\.ya?ml$/i.test(item.relative_path))) {
    const schema = schemaForPath(file.relative_path);
    if (schema === undefined) {
      diagnostics.push(
        issue(
          'yaml.unknown-contract',
          file.relative_path,
          'Canonical YAML path does not map to a release schema.',
        ),
      );
      continue;
    }
    if (
      options.archive_content === 'filenames-only' &&
      /^continuity\/archive\/[^/]+\.yaml$/.test(file.relative_path)
    ) {
      const eventId = path.basename(file.relative_path, '.yaml');
      if (!/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/u.test(eventId)) {
        diagnostics.push(
          issue(
            'event.archive-filename',
            file.relative_path,
            'Archived event filename must be a ULID.',
          ),
        );
      } else {
        assignLoadedYaml(loadedYaml, file.relative_path, schema, { event_id: eventId });
        addSemanticRecord(semanticRecords, loadedYaml.get(file.relative_path) as LoadedYaml);
      }
      continue;
    }
    const contents = await readFile(file.absolute_path, 'utf8');
    const document = parseDocument(contents, { prettyErrors: false, uniqueKeys: true });
    if (document.errors.length > 0) {
      for (const error of document.errors) {
        diagnostics.push(issue('yaml.parse', file.relative_path, error.message));
      }
      continue;
    }

    let value: unknown;
    try {
      value = document.toJS({ maxAliasCount: 50 }) as unknown;
    } catch (error) {
      diagnostics.push(
        issue(
          'yaml.alias-limit',
          file.relative_path,
          error instanceof Error ? error.message : 'Unable to safely decode YAML aliases.',
        ),
      );
      continue;
    }
    validatePortableYamlStrings(value, file.relative_path, diagnostics);
    const result = schemaRegistry.validate(schema, value);
    if (!result.valid) {
      for (const schemaDiagnostic of result.diagnostics) {
        diagnostics.push(
          issue(
            `schema.${schemaDiagnostic.keyword}`,
            `${file.relative_path}#${schemaDiagnostic.path === '/' ? '' : schemaDiagnostic.path}`,
            schemaDiagnostic.message,
          ),
        );
      }
      continue;
    }
    assignLoadedYaml(loadedYaml, file.relative_path, schema, value);
    addSemanticRecord(semanticRecords, loadedYaml.get(file.relative_path) as LoadedYaml);
  }

  const markdownRecords: MarkdownRecord[] = [];
  for (const file of files.filter(
    (item) => item.relative_path.endsWith('.md') && !item.relative_path.startsWith('runtime/'),
  )) {
    const contents = await readFile(file.absolute_path, 'utf8');
    try {
      const parsed = parseCanonicalMarkdown(contents);
      const result = schemaRegistry.validate('frontmatter', parsed.frontmatter);
      const metadata = result.valid ? objectValue(parsed.frontmatter) : undefined;
      if (!result.valid) {
        for (const schemaDiagnostic of result.diagnostics) {
          diagnostics.push(
            issue(
              `frontmatter.${schemaDiagnostic.keyword}`,
              `${file.relative_path}#${schemaDiagnostic.path === '/' ? '' : schemaDiagnostic.path}`,
              schemaDiagnostic.message,
            ),
          );
        }
      } else if (metadata?.doc !== file.relative_path) {
        diagnostics.push(
          issue(
            'frontmatter.path-mismatch',
            file.relative_path,
            `Frontmatter doc must equal ${file.relative_path}.`,
          ),
        );
      }
      markdownRecords.push({ ...file, contents, parsed, metadata });
    } catch (error) {
      diagnostics.push(
        issue(
          'frontmatter.parse',
          file.relative_path,
          error instanceof Error ? error.message : 'Unable to parse Markdown frontmatter.',
        ),
      );
    }
  }

  const graph = await validateMarkdownLinks(
    resolvedProjectRoot,
    layerRoot,
    markdownRecords,
    diagnostics,
  );
  validateMarkdownStructure(layerRoot, markdownRecords, graph, diagnostics);

  const manifest = loadedYaml.get('pcp.yaml')?.value;
  const capabilityIds = stringArray(objectValue(manifest)?.capabilities);
  if (capabilityIds !== undefined) {
    try {
      const capabilities = loadCapabilityManifests(capabilityIds);
      for (const capability of capabilities) {
        for (const entry of capability.index_entries) {
          const requiredPath = `${entry.folder}/${entry.path}`;
          if (!presentPaths.has(requiredPath)) {
            diagnostics.push(
              issue(
                'capability.required-path',
                requiredPath,
                `Enabled capability ${capability.capability_id} requires this canonical file.`,
              ),
            );
          }
        }
        for (const rootPath of capability.root_paths) {
          try {
            const metadata = await lstat(path.join(resolvedProjectRoot, ...rootPath.split('/')));
            if (!metadata.isFile() || metadata.isSymbolicLink()) {
              diagnostics.push(
                issue(
                  'capability.root-path',
                  rootPath,
                  `Enabled capability ${capability.capability_id} requires a regular project file.`,
                ),
              );
            }
          } catch {
            diagnostics.push(
              issue(
                'capability.root-path',
                rootPath,
                `Enabled capability ${capability.capability_id} requires this project file.`,
              ),
            );
          }
        }
      }
    } catch (error) {
      diagnostics.push(
        issue(
          'capability.selection',
          'pcp.yaml#capabilities',
          error instanceof Error ? error.message : 'Unable to validate enabled capabilities.',
        ),
      );
    }
  }
  const adapterIds = stringArray(objectValue(manifest)?.adapter_ids);
  if (adapterIds !== undefined && adapterIds.length > 0) {
    const expectedAdapters = renderPlatformAdapters().map((adapter) => adapter.manifest);
    const adapterValidation = await validatePlatformAdapters(resolvedProjectRoot, expectedAdapters);
    diagnostics.push(
      ...adapterValidation.diagnostics.map((diagnostic) =>
        issue(diagnostic.code, diagnostic.path, diagnostic.message),
      ),
    );
  }
  const patterns = ownershipPatterns(manifest);
  if (patterns !== undefined) {
    await validateOwnership(
      layerRoot,
      files,
      new Map(markdownRecords.map((record) => [record.relative_path, record])),
      patterns,
      diagnostics,
    );
  }

  for (const file of files.filter(
    (item) =>
      TEXT_FILE_PATTERN.test(item.relative_path) &&
      !item.relative_path.startsWith('runtime/') &&
      item.relative_path !== 'tools/pcp.mjs' &&
      !(
        options.archive_content === 'filenames-only' &&
        item.relative_path.startsWith('continuity/archive/')
      ),
  )) {
    validateTextSafety(file.relative_path, await readFile(file.absolute_path, 'utf8'), diagnostics);
  }

  diagnostics.push(...validateCanonicalSemantics(semanticRecords));

  const continuity = objectValue(objectValue(manifest)?.continuity);
  const activeEventLimit = continuity?.active_event_limit;
  if (typeof activeEventLimit === 'number') {
    const activeEventCount = files.filter((file) =>
      /^continuity\/events\/[^/]+\.yaml$/.test(file.relative_path),
    ).length;
    if (activeEventCount > activeEventLimit) {
      diagnostics.push(
        issue(
          'continuity.active-event-limit',
          'continuity/events',
          `Active events ${activeEventCount} exceed the configured limit ${activeEventLimit}; archive the oldest batch.`,
        ),
      );
    }
  }

  if (options.clean_genesis === true) {
    if (files.some((file) => /^continuity\/actors\/[^/]+\.yaml$/.test(file.relative_path))) {
      diagnostics.push(
        issue(
          'genesis.actor-profile',
          'continuity/actors',
          'Clean genesis must contain zero actor profiles.',
        ),
      );
    }
    if (
      files.some((file) => /^continuity\/(?:events|archive)\/[^/]+\.yaml$/.test(file.relative_path))
    ) {
      diagnostics.push(
        issue(
          'genesis.event',
          'continuity',
          'Clean genesis must contain zero active or archived events.',
        ),
      );
    }
  }

  diagnostics.sort(compareCanonicalDiagnostics);
  return {
    valid: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
    checked_files: files.length,
    diagnostics,
  };
}
