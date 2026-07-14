import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';

import { renderPlatformAdapters } from '../../src/application/render-platform-adapters.js';
import { validatePlatformAdapters } from '../../src/application/validate-platform-adapters.js';
import {
  SUPPORTED_ADAPTER_IDS,
  isForeignAdapterSourcePath,
  supportedAdapterForSourcePath,
} from '../../src/domain/adapters.js';
import { sha256 } from '../../src/domain/adoption.js';
import { SchemaRegistry } from '../../src/infrastructure/schema-validator.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function liveAdapterFixture(): Promise<{
  root: string;
  adapters: ReturnType<typeof renderPlatformAdapters>;
}> {
  const root = await mkdtemp(path.join(tmpdir(), 'pcp-platform-adapters-'));
  temporaryRoots.push(root);
  const adapters = renderPlatformAdapters();
  await mkdir(path.join(root, '.pcp'), { recursive: true });
  await writeFile(path.join(root, '.pcp', '00-index.md'), '# PCP\n');
  await writeFile(
    path.join(root, '.pcp', 'pcp.yaml'),
    stringify({ adapter_ids: adapters.map((adapter) => adapter.manifest.adapter_id) }),
  );
  for (const adapter of adapters) {
    const target = path.join(root, ...adapter.manifest.target_path.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, adapter.content);
  }
  return { root, adapters };
}

describe('platform adapters', () => {
  it('renders one deterministic schema-valid delegation for every target platform', () => {
    const first = renderPlatformAdapters();
    const repeated = renderPlatformAdapters();
    expect(repeated).toEqual(first);
    expect(first.map((adapter) => adapter.manifest.adapter_id)).toEqual(SUPPORTED_ADAPTER_IDS);
    expect(first.map((adapter) => adapter.manifest.target_path)).toEqual([
      'AGENTS.md',
      '.agents/rules/pcp.md',
      'CLAUDE.md',
      '.github/copilot-instructions.md',
      '.cursor/rules/pcp.mdc',
    ]);

    const registry = new SchemaRegistry();
    for (const adapter of first) {
      expect(registry.validate('adapter', adapter.manifest), adapter.manifest.adapter_id).toEqual({
        valid: true,
        diagnostics: [],
      });
      expect(adapter.manifest.content_digest).toBe(sha256(adapter.content));
      expect(adapter.content.toString('utf8')).toContain('.pcp/00-index.md');
      expect(adapter.content.toString('utf8')).toContain('PCP: GENERATED; DO NOT EDIT');
    }
    expect(
      first.find((adapter) => adapter.manifest.adapter_id === 'cursor')?.content.toString('utf8'),
    ).toContain('alwaysApply: true');
    expect(
      first
        .find((adapter) => adapter.manifest.adapter_id === 'claude-code-desktop')
        ?.content.toString('utf8'),
    ).toContain('@.pcp/00-index.md');
  });

  it('recognizes supported legacy entry points while leaving unimplemented vendors fail-closed', () => {
    expect(supportedAdapterForSourcePath('AGENTS.md')).toBe('codex');
    expect(supportedAdapterForSourcePath('packages/api/CLAUDE.md')).toBe('claude-code-desktop');
    expect(supportedAdapterForSourcePath('.agents/rules/project.md')).toBe('antigravity');
    expect(supportedAdapterForSourcePath('.github/instructions/api.instructions.md')).toBe(
      'github-copilot-vscode',
    );
    expect(supportedAdapterForSourcePath('apps/web/.cursor/rules/project.mdc')).toBe('cursor');

    for (const source of [
      'GEMINI.md',
      '.claude/commands/review.md',
      '.roo/rules/project.md',
      '.windsurf/rules/project.md',
      '.agents/skills/example/SKILL.md',
    ]) {
      expect(isForeignAdapterSourcePath(source), source).toBe(true);
      expect(supportedAdapterForSourcePath(source), source).toBeUndefined();
    }
    expect(isForeignAdapterSourcePath('.claude/settings.json')).toBe(false);
  });

  it('validates the complete live adapter set and reports content, source, and manifest drift', async () => {
    const { root, adapters } = await liveAdapterFixture();
    const manifests = adapters.map((adapter) => adapter.manifest);
    expect(await validatePlatformAdapters(root, manifests)).toEqual({
      valid: true,
      checked_adapters: 5,
      diagnostics: [],
    });

    await writeFile(path.join(root, 'AGENTS.md'), '# Changed outside PCP\n');
    await unlink(path.join(root, '.pcp', '00-index.md'));
    await writeFile(path.join(root, '.pcp', 'pcp.yaml'), 'adapter_ids: [codex]\n');
    const drifted = await validatePlatformAdapters(root, manifests.slice(0, -1));
    expect(drifted.valid).toBe(false);
    expect(drifted.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        'adapter.set',
        'adapter.digest',
        'adapter.source.read',
        'adapter.manifest.ids',
      ]),
    );
  });
});
