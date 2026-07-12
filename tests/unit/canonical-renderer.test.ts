import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse, stringify } from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';

import { renderCanonicalViews } from '../../src/application/render-canonical-views.js';
import { validateCanonicalLayer } from '../../src/application/validate-canonical-layer.js';

const templateProject = fileURLToPath(new URL('../../templates/core/', import.meta.url));
const templateLayer = path.join(templateProject, '.pcp');
const sources = [
  'state/project.yaml',
  'state/projects.yaml',
  'state/workstreams.yaml',
  'state/vcs-policy.yaml',
];
const temporaryRoots: string[] = [];

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

async function createProject(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'pcp-render-'));
  temporaryRoots.push(root);
  await cp(templateLayer, path.join(root, '.pcp'), { recursive: true });
  return root;
}

async function readYamlObject(file: string): Promise<Record<string, unknown>> {
  return objectValue(parse(await readFile(file, 'utf8')) as unknown, file);
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('canonical view rendering', () => {
  it('keeps the committed core projection current and valid', async () => {
    expect(await renderCanonicalViews(templateProject, { check: true })).toEqual({
      valid: true,
      mode: 'check',
      changed_paths: [],
      diagnostics: [],
    });
    expect((await validateCanonicalLayer(templateProject, { clean_genesis: true })).valid).toBe(
      true,
    );
  });

  it('checks without mutation, renders drift, and becomes idempotent', async () => {
    const root = await createProject();
    const projectFile = path.join(root, '.pcp', 'state', 'project.yaml');
    const viewFile = path.join(root, '.pcp', 'views', '10-status.generated.md');
    const before = await readFile(viewFile, 'utf8');
    const project = await readYamlObject(projectFile);
    project.purpose = 'A changed canonical purpose.';
    await writeFile(projectFile, stringify(project), 'utf8');

    const check = await renderCanonicalViews(root, { check: true });
    expect(check.valid).toBe(false);
    expect(check.changed_paths).toEqual(['.pcp/views/10-status.generated.md']);
    expect(check.diagnostics.map((item) => item.code)).toContain('render.stale');
    expect(await readFile(viewFile, 'utf8')).toBe(before);

    const write = await renderCanonicalViews(root);
    expect(write).toEqual({
      valid: true,
      mode: 'write',
      changed_paths: ['.pcp/views/10-status.generated.md'],
      diagnostics: [],
    });
    expect(await readFile(viewFile, 'utf8')).not.toBe(before);
    expect((await validateCanonicalLayer(root)).valid).toBe(true);
    expect((await renderCanonicalViews(root, { check: true })).valid).toBe(true);
    expect((await renderCanonicalViews(root)).changed_paths).toEqual([]);
  });

  it('normalizes source line endings across operating systems', async () => {
    const root = await createProject();
    for (const source of sources) {
      const file = path.join(root, '.pcp', source);
      const contents = (await readFile(file, 'utf8'))
        .replace(/\r\n?/g, '\n')
        .replace(/\n/g, '\r\n');
      await writeFile(file, contents, 'utf8');
    }

    expect(await renderCanonicalViews(root, { check: true })).toEqual({
      valid: true,
      mode: 'check',
      changed_paths: [],
      diagnostics: [],
    });
  });

  it('refuses to render schema-invalid canonical sources', async () => {
    const root = await createProject();
    const projectFile = path.join(root, '.pcp', 'state', 'project.yaml');
    const viewFile = path.join(root, '.pcp', 'views', '10-status.generated.md');
    const before = await readFile(viewFile, 'utf8');
    const project = await readYamlObject(projectFile);
    project.project_id = 'Not A Slug';
    await writeFile(projectFile, stringify(project), 'utf8');

    const report = await renderCanonicalViews(root);
    expect(report.valid).toBe(false);
    expect(report.changed_paths).toEqual([]);
    expect(report.diagnostics.map((item) => item.code)).toContain('render.source-pattern');
    expect(await readFile(viewFile, 'utf8')).toBe(before);
  });

  it('renders managed projects and workstreams with Markdown-safe table cells', async () => {
    const root = await createProject();
    const projectsFile = path.join(root, '.pcp', 'state', 'projects.yaml');
    const projects = await readYamlObject(projectsFile);
    projects.projects = [
      {
        schema_version: 1,
        project_id: 'example-project',
        name: 'Example | Project',
        purpose: 'Exercise generated project tables.',
        project_type: 'software',
        lifecycle: 'active',
        artifact_roots: ['src'],
        context_roots: ['.pcp/projects'],
        repositories: [],
        tags: ['example'],
      },
    ];
    await writeFile(projectsFile, stringify(projects), 'utf8');

    const workstreamsFile = path.join(root, '.pcp', 'state', 'workstreams.yaml');
    const workstreams = await readYamlObject(workstreamsFile);
    workstreams.workstreams = [
      {
        workstream_id: 'example-work',
        name: 'Example work',
        kind: 'sequential',
        status: 'active',
        paths: ['src'],
        areas: ['implementation'],
        dependencies: [],
        completion: { criteria: ['Tests pass.'], evidence: [] },
      },
    ];
    await writeFile(workstreamsFile, stringify(workstreams), 'utf8');

    expect((await renderCanonicalViews(root)).valid).toBe(true);
    const view = await readFile(path.join(root, '.pcp', 'views', '10-status.generated.md'), 'utf8');
    expect(view).toContain('Example \\| Project');
    expect(view).toContain(
      '| `example-work` | Example work | `sequential` | `active` | None. | 0 item(s) |',
    );
    expect((await validateCanonicalLayer(root)).valid).toBe(true);
  });
});
