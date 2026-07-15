import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { parseDocument } from 'yaml';

import type {
  CanonicalRenderOptions,
  CanonicalRenderReport,
} from '../domain/canonical-rendering.js';
import {
  compareCanonicalDiagnostics,
  type CanonicalDiagnostic,
} from '../domain/canonical-validation.js';
import type { SchemaName } from '../domain/schema-catalog.js';
import {
  canonicalSourceDigest,
  canonicalSourceDigestFromContents,
} from '../infrastructure/canonical-source-digest.js';
import { SchemaRegistry } from '../infrastructure/schema-validator.js';

const VIEW_PATH = 'views/10-status.generated.md';
const PROJECT_VIEW_PATH = `.pcp/${VIEW_PATH}`;
const GENERATED_MARKER = '<!-- PCP: GENERATED; DO NOT EDIT -->';
const RENDERER_TEMPLATE_UPDATED_AT = '2026-07-14T07:20:00Z';
const SOURCES: Array<[string, SchemaName]> = [
  ['state/project.yaml', 'project'],
  ['state/projects.yaml', 'project-registry'],
  ['state/workstreams.yaml', 'workstreams'],
  ['state/vcs-policy.yaml', 'vcs-policy'],
];

interface LoadedRenderSource {
  contents: string;
  value: Record<string, unknown>;
}

function objectValue(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Schema-valid canonical source must be an object.');
  }
  return value as Record<string, unknown>;
}

function objectArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.map(objectValue);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function scalar(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : '';
}

function prose(value: unknown): string {
  return scalar(value).replace(/\s+/g, ' ').trim().replace(/\\/g, '\\\\');
}

function tableCell(value: unknown): string {
  const result = prose(value).replace(/\|/g, '\\|');
  return result.length === 0 ? '—' : result;
}

function code(value: unknown): string {
  return `\`${scalar(value).replace(/`/g, '\\`')}\``;
}

function codeList(value: unknown): string {
  const values = stringArray(value);
  return values.length === 0 ? 'None.' : values.map(code).join(', ');
}

function issue(codeValue: string, pathValue: string, message: string): CanonicalDiagnostic {
  return { severity: 'error', code: codeValue, path: pathValue, message };
}

async function loadSource(
  layerRoot: string,
  relativePath: string,
  schema: SchemaName,
  registry: SchemaRegistry,
  diagnostics: CanonicalDiagnostic[],
): Promise<LoadedRenderSource | undefined> {
  let contents: string;
  try {
    contents = await readFile(path.join(layerRoot, relativePath), 'utf8');
  } catch (error) {
    diagnostics.push(
      issue(
        'render.source-read',
        `.pcp/${relativePath}`,
        error instanceof Error ? error.message : 'Unable to read canonical render source.',
      ),
    );
    return undefined;
  }

  const document = parseDocument(contents, { prettyErrors: false, uniqueKeys: true });
  if (document.errors.length > 0) {
    for (const error of document.errors) {
      diagnostics.push(issue('render.source-yaml', `.pcp/${relativePath}`, error.message));
    }
    return undefined;
  }
  let value: unknown;
  try {
    value = document.toJS({ maxAliasCount: 50 }) as unknown;
  } catch (error) {
    diagnostics.push(
      issue(
        'render.source-yaml',
        `.pcp/${relativePath}`,
        error instanceof Error ? error.message : 'Unable to safely decode render source.',
      ),
    );
    return undefined;
  }

  const result = registry.validate(schema, value);
  if (!result.valid) {
    for (const diagnostic of result.diagnostics) {
      diagnostics.push(
        issue(
          `render.source-${diagnostic.keyword}`,
          `.pcp/${relativePath}#${diagnostic.path === '/' ? '' : diagnostic.path}`,
          diagnostic.message,
        ),
      );
    }
    return undefined;
  }
  return { contents, value: objectValue(value) };
}

function renderProjects(projects: Array<Record<string, unknown>>): string[] {
  if (projects.length === 0) return ['No managed subprojects are registered.'];
  return [
    '| ID | Name | Type | Lifecycle | Artifact roots |',
    '| --- | --- | --- | --- | --- |',
    ...projects.map(
      (project) =>
        `| ${code(project.project_id)} | ${tableCell(project.name)} | ${code(project.project_type)} | ${code(project.lifecycle)} | ${codeList(project.artifact_roots)} |`,
    ),
  ];
}

function renderWorkstreams(workstreams: Array<Record<string, unknown>>): string[] {
  if (workstreams.length === 0) return ['No workstreams are registered.'];
  return [
    '| ID | Name | Kind | Status | Dependencies | Evidence |',
    '| --- | --- | --- | --- | --- | --- |',
    ...workstreams.map((workstream) => {
      const completion = objectValue(workstream.completion);
      return `| ${code(workstream.workstream_id)} | ${tableCell(workstream.name)} | ${code(workstream.kind)} | ${code(workstream.status)} | ${codeList(workstream.dependencies)} | ${objectArray(completion.evidence).length} item(s) |`;
    }),
  ];
}

export function renderCanonicalStatusView(
  sources: Map<string, Record<string, unknown>>,
  sourceDigest: string,
): string {
  const project = objectValue(sources.get('state/project.yaml'));
  const projectRegistry = objectValue(sources.get('state/projects.yaml'));
  const workstreamRegistry = objectValue(sources.get('state/workstreams.yaml'));
  const vcsPolicy = objectValue(sources.get('state/vcs-policy.yaml'));
  const repository = objectValue(vcsPolicy.repository);
  const workflow = objectValue(vcsPolicy.workflow);

  const lines = [
    '---',
    `doc: ${VIEW_PATH}`,
    'type: generated',
    'status: generated',
    'version: 1.0.0',
    `last_updated: ${RENDERER_TEMPLATE_UPDATED_AT}`,
    'ownership: generated',
    'sources:',
    ...SOURCES.map(([source]) => `  - ${source}`),
    `source_digest: ${sourceDigest}`,
    '---',
    '',
    GENERATED_MARKER,
    '',
    '# Project status',
    '',
    'Generated from canonical YAML. Edit the source records, then render again.',
    '',
    '## Project',
    '',
    `- ID: ${code(project.project_id)}`,
    `- Name: ${prose(project.name)}`,
    `- Purpose: ${prose(project.purpose)}`,
    `- Type: ${code(project.project_type)}`,
    `- Lifecycle: ${code(project.lifecycle)}`,
    `- Artifact roots: ${codeList(project.artifact_roots)}`,
    `- Context roots: ${codeList(project.context_roots)}`,
    '',
    '## Managed projects',
    '',
    ...renderProjects(objectArray(projectRegistry.projects)),
    '',
    '## Workstreams',
    '',
    ...renderWorkstreams(objectArray(workstreamRegistry.workstreams)),
    '',
    '## Version control',
    '',
    `- Mode: ${code(vcsPolicy.mode)}`,
    `- System: ${code(vcsPolicy.system)}`,
    `- Provider: ${code(vcsPolicy.provider)}`,
    `- Default branch: ${code(repository.default_branch)}`,
    `- Commit signing: ${code(workflow.commit_signing)}`,
    `- Push cadence: ${code(workflow.push_cadence)}`,
    `- Pull request policy: ${code(workflow.pull_request_policy)}`,
    `- Human merge required: ${code(workflow.human_merge_required)}`,
    '',
  ];
  return lines.join('\n');
}

export async function renderCanonicalViews(
  projectRoot: string,
  options: CanonicalRenderOptions = {},
): Promise<CanonicalRenderReport> {
  const layerRoot = path.join(path.resolve(projectRoot), '.pcp');
  const diagnostics: CanonicalDiagnostic[] = [];
  const registry = new SchemaRegistry();
  const loadedSources = new Map<string, LoadedRenderSource>();

  for (const [relativePath, schema] of SOURCES) {
    const source = await loadSource(layerRoot, relativePath, schema, registry, diagnostics);
    if (source !== undefined) loadedSources.set(relativePath, source);
  }
  if (diagnostics.length > 0) {
    diagnostics.sort(compareCanonicalDiagnostics);
    return {
      valid: false,
      mode: options.check === true ? 'check' : 'write',
      changed_paths: [],
      diagnostics,
    };
  }

  const digest = canonicalSourceDigestFromContents(
    [...loadedSources].map(([sourcePath, source]) => ({
      path: sourcePath,
      contents: source.contents,
    })),
  );
  let currentSourceDigest: string;
  try {
    currentSourceDigest = await canonicalSourceDigest(
      layerRoot,
      SOURCES.map(([source]) => source),
    );
  } catch (error) {
    diagnostics.push(
      issue(
        'render.source-digest',
        '.pcp/state',
        error instanceof Error ? error.message : 'Unable to fingerprint render sources.',
      ),
    );
    return {
      valid: false,
      mode: options.check === true ? 'check' : 'write',
      changed_paths: [],
      diagnostics,
    };
  }
  if (currentSourceDigest !== digest) {
    return {
      valid: false,
      mode: options.check === true ? 'check' : 'write',
      changed_paths: [],
      diagnostics: [
        issue(
          'render.source-drift',
          '.pcp/state',
          'Canonical render sources changed while the render snapshot was being built.',
        ),
      ],
    };
  }
  const sources = new Map(
    [...loadedSources].map(([sourcePath, source]) => [sourcePath, source.value] as const),
  );
  const desired = renderCanonicalStatusView(sources, digest);
  const absoluteViewPath = path.join(layerRoot, VIEW_PATH);
  let current: string | undefined;
  try {
    current = await readFile(absoluteViewPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      diagnostics.push(
        issue(
          'render.view-read',
          PROJECT_VIEW_PATH,
          error instanceof Error ? error.message : 'Unable to read generated view.',
        ),
      );
    }
  }

  if (diagnostics.length > 0) {
    diagnostics.sort(compareCanonicalDiagnostics);
    return {
      valid: false,
      mode: options.check === true ? 'check' : 'write',
      changed_paths: [],
      diagnostics,
    };
  }
  if (current === desired) {
    return {
      valid: true,
      mode: options.check === true ? 'check' : 'write',
      changed_paths: [],
      diagnostics: [],
    };
  }

  if (options.check === true) {
    return {
      valid: false,
      mode: 'check',
      changed_paths: [PROJECT_VIEW_PATH],
      diagnostics: [
        issue('render.stale', PROJECT_VIEW_PATH, 'Generated status view is missing or stale.'),
      ],
    };
  }

  try {
    await writeFile(absoluteViewPath, desired, 'utf8');
  } catch (error) {
    return {
      valid: false,
      mode: 'write',
      changed_paths: [],
      diagnostics: [
        issue(
          'render.view-write',
          PROJECT_VIEW_PATH,
          error instanceof Error ? error.message : 'Unable to write generated view.',
        ),
      ],
    };
  }
  return {
    valid: true,
    mode: 'write',
    changed_paths: [PROJECT_VIEW_PATH],
    diagnostics: [],
  };
}
