import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

import type { SchemaName } from '../../src/domain/schema-catalog.js';
import { SchemaRegistry } from '../../src/infrastructure/schema-validator.js';

interface CapabilityIndexEntry {
  folder: string;
  path: string;
  title: string;
}

interface CapabilityManifest {
  schema_version: number;
  capability_id: string;
  name: string;
  description: string;
  dependencies: string[];
  manifest_value: string;
  overlay_root: string;
  index_entries: CapabilityIndexEntry[];
  root_paths: string[];
}

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const templateRoot = path.join(repositoryRoot, 'templates');
const coreRoot = path.join(templateRoot, 'core', '.pcp');
const capabilitiesRoot = path.join(templateRoot, 'capabilities');

function relativeFrom(root: string, target: string): string {
  return path.relative(root, target).split(path.sep).join('/');
}

async function walkFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const target = path.join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Template source cannot be a symlink: ${target}`);
    if (entry.isDirectory()) result.push(...(await walkFiles(target)));
    if (entry.isFile()) result.push(target);
  }
  return result;
}

async function loadYaml(file: string): Promise<unknown> {
  return parse(await readFile(file, 'utf8')) as unknown;
}

function frontmatter(contents: string): unknown {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(contents);
  if (match?.[1] === undefined) throw new Error('Canonical Markdown is missing frontmatter.');
  return parse(match[1]) as unknown;
}

function markdownLinks(contents: string): string[] {
  const links: string[] = [];
  const expression = /\[[^\]]+\]\(([^)]+\.md(?:#[^)]+)?)\)/g;
  for (const match of contents.matchAll(expression)) {
    const target = match[1]?.split('#', 1)[0];
    if (target !== undefined) links.push(target);
  }
  return links;
}

async function canonicalMarkdown(root: string): Promise<string[]> {
  return (await walkFiles(root)).filter((file) => file.endsWith('.md'));
}

describe('canonical template sources', () => {
  it('contains every required core capability area', async () => {
    const expected = [
      'continuity',
      'continuity/actors',
      'continuity/archive',
      'continuity/checkpoints',
      'continuity/events',
      'knowledge',
      'operations',
      'projects',
      'protocol',
      'references',
      'schemas',
      'state',
      'templates',
      'tools',
      'views',
    ];

    for (const area of expected) {
      expect((await stat(path.join(coreRoot, area))).isDirectory(), area).toBe(true);
    }
  });

  it('ships a schema-valid clean-genesis machine state', async () => {
    const registry = new SchemaRegistry();
    const records: Array<[string, SchemaName]> = [
      ['pcp.yaml', 'pcp-manifest'],
      ['state/project.yaml', 'project'],
      ['state/projects.yaml', 'project-registry'],
      ['state/workstreams.yaml', 'workstreams'],
      ['state/vcs-policy.yaml', 'vcs-policy'],
    ];

    for (const [relativePath, schema] of records) {
      const value = await loadYaml(path.join(coreRoot, relativePath));
      expect(registry.validate(schema, value), relativePath).toEqual({
        valid: true,
        diagnostics: [],
      });
    }

    const files = await walkFiles(coreRoot);
    expect(
      files.filter((file) => relativeFrom(coreRoot, file).match(/^continuity\/actors\/.*\.yaml$/)),
    ).toEqual([]);
    expect(
      files.filter((file) =>
        relativeFrom(coreRoot, file).match(/^continuity\/(?:events|archive)\/.*\.yaml$/),
      ),
    ).toEqual([]);
  });

  it('numbers and validates every canonical Markdown file', async () => {
    const registry = new SchemaRegistry();
    const files = await canonicalMarkdown(coreRoot);

    for (const file of files) {
      const relativePath = relativeFrom(coreRoot, file);
      const fileName = path.basename(file);
      const number = /^(\d+)-[a-z0-9]+(?:-[a-z0-9]+)*(?:\.generated)?\.md$/.exec(fileName)?.[1];
      expect(number, relativePath).toBeDefined();
      expect(Number(number) % 10, relativePath).toBe(0);

      const metadata = frontmatter(await readFile(file, 'utf8'));
      expect(registry.validate('frontmatter', metadata), relativePath).toEqual({
        valid: true,
        diagnostics: [],
      });
      expect((metadata as { doc?: unknown }).doc, relativePath).toBe(relativePath);
    }
  });

  it('gives every Markdown folder an index and makes every core document reachable', async () => {
    const files = await canonicalMarkdown(coreRoot);
    const known = new Set(files.map((file) => path.resolve(file)));
    const directories = new Set(files.map((file) => path.dirname(file)));

    for (const directory of directories) {
      expect(
        known.has(path.join(directory, '00-index.md')),
        relativeFrom(coreRoot, directory),
      ).toBe(true);
    }

    const queue = [path.join(coreRoot, '00-index.md')];
    const reached = new Set<string>();
    while (queue.length > 0) {
      const current = path.resolve(queue.shift() as string);
      if (reached.has(current)) continue;
      reached.add(current);

      for (const link of markdownLinks(await readFile(current, 'utf8'))) {
        const target = path.resolve(path.dirname(current), link);
        expect(target.startsWith(`${path.resolve(coreRoot)}${path.sep}`), link).toBe(true);
        expect(known.has(target), `${relativeFrom(coreRoot, current)} -> ${link}`).toBe(true);
        queue.push(target);
      }
    }

    expect(
      [...known].filter((file) => !reached.has(file)).map((file) => relativeFrom(coreRoot, file)),
    ).toEqual([]);
  });

  it('declares four complete opt-in capability overlays without orphan entries', async () => {
    const capabilityDirectories = (await readdir(capabilitiesRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(capabilityDirectories).toEqual([
      'concurrent-execution-blocks',
      'scratch-space',
      'spec-driven-projects',
      'walkthroughs',
    ]);

    const registry = new SchemaRegistry();
    const knownIds = new Set(capabilityDirectories);
    for (const directory of capabilityDirectories) {
      const root = path.join(capabilitiesRoot, directory);
      const manifest = (await loadYaml(path.join(root, 'capability.yaml'))) as CapabilityManifest;
      expect(manifest.schema_version, directory).toBe(1);
      expect(manifest.capability_id, directory).toBe(directory);
      expect(manifest.manifest_value, directory).toBe(directory);
      expect(manifest.overlay_root, directory).toBe('overlay');
      expect(
        manifest.dependencies.every((dependency) => knownIds.has(dependency)),
        directory,
      ).toBe(true);

      const overlay = path.join(root, manifest.overlay_root);
      const overlayPcp = path.join(overlay, '.pcp');
      const markdown = await canonicalMarkdown(overlayPcp);
      const declared = new Set(
        manifest.index_entries.map((entry) => `${entry.folder}/${entry.path}`),
      );
      expect([...declared].sort(), directory).toEqual(
        markdown.map((file) => relativeFrom(overlayPcp, file)).sort(),
      );

      for (const file of markdown) {
        const relativePath = relativeFrom(overlayPcp, file);
        const metadata = frontmatter(await readFile(file, 'utf8'));
        expect(registry.validate('frontmatter', metadata), relativePath).toEqual({
          valid: true,
          diagnostics: [],
        });
        expect((metadata as { doc?: unknown }).doc, relativePath).toBe(relativePath);
        expect(/^\d+-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(path.basename(file)), relativePath).toBe(
          true,
        );
        expect(
          await stat(path.join(coreRoot, path.dirname(relativePath), '00-index.md')),
        ).toBeDefined();
      }

      for (const rootPath of manifest.root_paths) {
        expect(rootPath.includes('\\'), rootPath).toBe(false);
        expect(path.isAbsolute(rootPath), rootPath).toBe(false);
        expect((await stat(path.join(overlay, rootPath))).isFile(), rootPath).toBe(true);
      }
    }
  });
});
