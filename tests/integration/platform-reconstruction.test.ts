import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';

import { adoptProject } from '../../src/application/adopt-project.js';
import { renderPlatformAdapters } from '../../src/application/render-platform-adapters.js';
import type { AdoptionInput } from '../../src/domain/adoption.js';
import type { SupportedAdapterId } from '../../src/domain/adapters.js';

const schemaFixture = fileURLToPath(
  new URL('../fixtures/schemas/adoption-input.yaml', import.meta.url),
);
const temporaryRoots: string[] = [];

const startupPaths: Record<SupportedAdapterId, string[]> = {
  codex: ['AGENTS.md'],
  antigravity: ['.agents/rules/pcp.md'],
  'claude-code-desktop': ['CLAUDE.md'],
  'github-copilot-vscode': ['AGENTS.md', '.github/copilot-instructions.md'],
  cursor: ['AGENTS.md', '.cursor/rules/pcp.mdc'],
};

interface Reconstruction {
  canonical_entry: string;
  project_id: string;
  project_name: string;
  purpose: string;
  lifecycle: string;
  active_workstreams: string[];
  vcs_mode: string;
  overview_signal: boolean;
  next_action_signal: boolean;
}

const expectedReconstruction: Reconstruction = {
  canonical_entry: '.pcp/00-index.md',
  project_id: 'northstar-notes',
  project_name: 'Northstar Notes',
  purpose: 'Keep field observations searchable and ready for a weekly editorial review.',
  lifecycle: 'active',
  active_workstreams: ['weekly-review'],
  vcs_mode: 'none',
  overview_signal: true,
  next_action_signal: true,
};

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function externalInput(input: AdoptionInput): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'pcp-reconstruction-input-'));
  temporaryRoots.push(directory);
  const target = path.join(directory, 'adoption.json');
  await writeFile(target, `${JSON.stringify(input, null, 2)}\n`, 'utf8');
  return target;
}

async function reconstructionInput(): Promise<AdoptionInput> {
  const wrapper = parse(await readFile(schemaFixture, 'utf8')) as { valid: AdoptionInput };
  const input = structuredClone(wrapper.valid);
  input.project = {
    ...input.project,
    project_id: 'northstar-notes',
    name: 'Northstar Notes',
    purpose: 'Keep field observations searchable and ready for a weekly editorial review.',
    project_type: 'writing',
    lifecycle: 'active',
    tags: ['field-notes', 'editorial'],
  };
  input.capabilities = ['concurrent-execution-blocks'];
  input.workstreams = {
    schema_version: 1,
    workstreams: [
      {
        workstream_id: 'weekly-review',
        name: 'Weekly editorial review',
        kind: 'ceb',
        status: 'active',
        paths: ['notes'],
        areas: ['editorial'],
        dependencies: [],
        completion: {
          criteria: ['The weekly collection is reviewed and prioritized.'],
          evidence: [],
        },
      },
    ],
  };
  input.documents = input.documents.map((document) => {
    if (document.path === 'knowledge/10-overview.md') {
      return {
        ...document,
        body: '# Project overview\n\nNorthstar signal: observations become a weekly editorial queue.',
      };
    }
    if (document.path === 'operations/20-plan.md') {
      return {
        ...document,
        body: '# Project plan\n\n## Next actions\n\n- Review the newest field observations every Friday.',
      };
    }
    return document;
  });
  return input;
}

async function adoptedFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'pcp-platform-reconstruction-'));
  temporaryRoots.push(root);
  await writeFile(
    path.join(root, 'README.md'),
    '# Northstar Notes\n\nField observations for editorial review.\n',
    'utf8',
  );
  const input = await externalInput(await reconstructionInput());
  const preview = await adoptProject(root, { input });
  if (!('plan' in preview) || preview.plan === undefined) {
    throw new Error('Expected an applicable reconstruction fixture plan.');
  }
  await adoptProject(root, { input, apply: preview.plan.plan_digest });
  return root;
}

function referencedPaths(markdown: string): string[] {
  const references = new Set<string>();
  for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/gu)) {
    if (match[1] !== undefined) references.add(match[1]);
  }
  for (const match of markdown.matchAll(/`([^`]+\.(?:md|yaml))`/gu)) {
    if (match[1] !== undefined) references.add(match[1]);
  }
  return [...references];
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`);
  return value;
}

function objectArray(value: unknown, label: string): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value.map((item, index) => objectValue(item, `${label}[${index}]`));
}

async function reachableContext(root: string): Promise<Set<string>> {
  const reached = new Set<string>();
  const expanded = new Set<string>();
  const queue = ['.pcp/00-index.md'];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || expanded.has(current)) continue;
    expanded.add(current);
    reached.add(current);
    if (!current.endsWith('.md')) continue;
    const contents = await readFile(path.join(root, ...current.split('/')), 'utf8');
    for (const reference of referencedPaths(contents)) {
      const resolved = path.posix.normalize(
        path.posix.join(path.posix.dirname(current), reference),
      );
      if (!resolved.startsWith('.pcp/') || resolved.includes('..')) continue;
      reached.add(resolved);
      if (resolved.endsWith('00-index.md')) queue.push(resolved);
    }
  }
  return reached;
}

async function reconstructFromPlatform(
  root: string,
  platform: SupportedAdapterId,
): Promise<Reconstruction> {
  const adapters = await Promise.all(
    startupPaths[platform].map((adapterPath) =>
      readFile(path.join(root, ...adapterPath.split('/')), 'utf8'),
    ),
  );
  expect(
    adapters.every((adapter) => adapter.includes('.pcp/00-index.md')),
    platform,
  ).toBe(true);
  if (platform === 'cursor') {
    expect(adapters.some((adapter) => adapter.includes('alwaysApply: true'))).toBe(true);
  }
  if (platform === 'claude-code-desktop') {
    expect(adapters[0]).toContain('@.pcp/00-index.md');
  }

  const reachable = await reachableContext(root);
  for (const required of [
    '.pcp/state/project.yaml',
    '.pcp/state/workstreams.yaml',
    '.pcp/state/vcs-policy.yaml',
    '.pcp/knowledge/10-overview.md',
    '.pcp/operations/20-plan.md',
  ]) {
    expect(reachable.has(required), `${platform}: ${required}`).toBe(true);
  }

  const [projectText, workstreamsText, vcsText, overview, plan] = await Promise.all([
    readFile(path.join(root, '.pcp', 'state', 'project.yaml'), 'utf8'),
    readFile(path.join(root, '.pcp', 'state', 'workstreams.yaml'), 'utf8'),
    readFile(path.join(root, '.pcp', 'state', 'vcs-policy.yaml'), 'utf8'),
    readFile(path.join(root, '.pcp', 'knowledge', '10-overview.md'), 'utf8'),
    readFile(path.join(root, '.pcp', 'operations', '20-plan.md'), 'utf8'),
  ]);
  const project = objectValue(parse(projectText) as unknown, 'project');
  const workstreams = objectValue(parse(workstreamsText) as unknown, 'workstreams');
  const vcs = objectValue(parse(vcsText) as unknown, 'vcs policy');
  return {
    canonical_entry: '.pcp/00-index.md',
    project_id: stringValue(project.project_id, 'project.project_id'),
    project_name: stringValue(project.name, 'project.name'),
    purpose: stringValue(project.purpose, 'project.purpose'),
    lifecycle: stringValue(project.lifecycle, 'project.lifecycle'),
    active_workstreams: objectArray(workstreams.workstreams, 'workstreams.workstreams')
      .filter((workstream) => workstream.status === 'active')
      .map((workstream) => stringValue(workstream.workstream_id, 'workstream.workstream_id')),
    vcs_mode: stringValue(vcs.mode, 'vcs.mode'),
    overview_signal: overview.includes('Northstar signal'),
    next_action_signal: plan.includes('Review the newest field observations every Friday.'),
  };
}

describe('supported-platform reconstruction', () => {
  it('reconstructs one identical current project from every declared startup surface', async () => {
    const root = await adoptedFixture();
    const platforms = renderPlatformAdapters().map((adapter) => adapter.manifest.adapter_id);
    const reconstructions = await Promise.all(
      platforms.map((platform) => reconstructFromPlatform(root, platform as SupportedAdapterId)),
    );

    for (const reconstruction of reconstructions) {
      expect(reconstruction).toEqual(expectedReconstruction);
    }
    expect(new Set(reconstructions.map((item) => JSON.stringify(item))).size).toBe(1);
  });
});
