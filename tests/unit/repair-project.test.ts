import { cp, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse, stringify } from 'yaml';

import { renderPlatformAdapters } from '../../src/application/render-platform-adapters.js';
import { repairProject } from '../../src/application/repair-project.js';
import { validateCanonicalLayer } from '../../src/application/validate-canonical-layer.js';
import { validatePlatformAdapters } from '../../src/application/validate-platform-adapters.js';
import type { RepairApplyResult, RepairPreview } from '../../src/domain/repair.js';
import { inventoryRepository } from '../../src/infrastructure/filesystem-inventory.js';

const coreTemplate = fileURLToPath(new URL('../../templates/core/.pcp/', import.meta.url));
const temporaryRoots: string[] = [];

vi.setConfig({ testTimeout: 15_000 });

async function managedProject(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'pcp-repair-project-'));
  temporaryRoots.push(root);
  await cp(coreTemplate, path.join(root, '.pcp'), { recursive: true });
  const adapters = renderPlatformAdapters();
  const manifestPath = path.join(root, '.pcp', 'pcp.yaml');
  const manifest = parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
  manifest.adapter_ids = adapters.map((adapter) => adapter.manifest.adapter_id);
  await writeFile(manifestPath, stringify(manifest), 'utf8');
  for (const adapter of adapters) {
    const target = path.join(root, ...adapter.manifest.target_path.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, adapter.content);
  }
  return root;
}

function applicable(
  preview: RepairPreview | RepairApplyResult,
): asserts preview is RepairPreview & {
  applicable: true;
  plan: NonNullable<RepairPreview['plan']>;
} {
  if (preview.mutated || !preview.applicable || preview.plan === undefined) {
    throw new Error('Expected an applicable repair preview.');
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('managed adapter repair', () => {
  it('returns a stable no-op preview when every generated adapter is current', async () => {
    const root = await managedProject();
    const first = await repairProject(root);
    const repeated = await repairProject(root);
    expect(repeated).toEqual(first);
    expect(first).toMatchObject({
      command: 'repair',
      applicable: false,
      repair_paths: [],
      diagnostics: [],
      mutated: false,
    });
  });

  it('previews and applies exact replacements and missing adapter writes', async () => {
    const root = await managedProject();
    await writeFile(path.join(root, 'AGENTS.md'), '# Locally changed generated adapter\n');
    await unlink(path.join(root, 'CLAUDE.md'));
    await rm(path.join(root, '.agents'), { recursive: true, force: true });
    const before = await inventoryRepository(root);

    const first = await repairProject(root);
    const repeated = await repairProject(root);
    expect(repeated).toEqual(first);
    applicable(first);
    expect(first.repair_paths).toEqual(['AGENTS.md', '.agents/rules/pcp.md', 'CLAUDE.md']);
    expect(first.plan.operations.map((operation) => [operation.action, operation.path])).toEqual([
      ['replace', 'AGENTS.md'],
      ['mkdir', '.agents'],
      ['mkdir', '.agents/rules'],
      ['write', '.agents/rules/pcp.md'],
      ['write', 'CLAUDE.md'],
    ]);

    await expect(repairProject(root, { apply: '0'.repeat(64) })).rejects.toMatchObject({
      code: 'PCP_PLAN_DIGEST_MISMATCH',
      mutated: false,
    });
    expect((await inventoryRepository(root)).digest).toBe(before.digest);

    const applied = await repairProject(root, { apply: first.plan.plan_digest });
    expect(applied).toMatchObject({
      command: 'repair',
      repaired_paths: first.repair_paths,
      applied_operations: 5,
      validation: { valid: true, checked_adapters: 5 },
      recovery_cleaned: true,
      mutated: true,
    });
    expect(await validateCanonicalLayer(root, { archive_content: 'filenames-only' })).toMatchObject(
      {
        valid: true,
      },
    );
    expect(
      await validatePlatformAdapters(
        root,
        renderPlatformAdapters().map((adapter) => adapter.manifest),
      ),
    ).toMatchObject({ valid: true, checked_adapters: 5 });
  });

  it('rejects stale approval, target collisions, and unrelated canonical damage', async () => {
    const root = await managedProject();
    await writeFile(path.join(root, 'AGENTS.md'), '# First drift\n');
    const preview = await repairProject(root);
    applicable(preview);
    await writeFile(path.join(root, 'AGENTS.md'), '# Second drift\n');
    await expect(repairProject(root, { apply: preview.plan.plan_digest })).rejects.toMatchObject({
      code: 'PCP_PLAN_DIGEST_MISMATCH',
    });

    const collision = await managedProject();
    await unlink(path.join(collision, 'CLAUDE.md'));
    await mkdir(path.join(collision, 'CLAUDE.md'));
    await expect(repairProject(collision)).rejects.toMatchObject({ code: 'PCP_REPAIR_BLOCKED' });

    const broken = await managedProject();
    await writeFile(path.join(broken, '.pcp', 'state', 'project.yaml'), 'not: valid\n');
    await expect(repairProject(broken)).rejects.toMatchObject({ code: 'PCP_REPAIR_BLOCKED' });
  });

  it('restores every adapter byte after failure at each operation boundary', async () => {
    for (let boundary = 1; boundary <= 6; boundary += 1) {
      const root = await managedProject();
      for (const adapter of renderPlatformAdapters()) {
        const target = path.join(root, ...adapter.manifest.target_path.split('/'));
        await writeFile(target, `# Drifted ${adapter.manifest.adapter_id}\n`);
      }
      const before = await inventoryRepository(root);
      const preview = await repairProject(root);
      applicable(preview);
      expect(preview.plan.operations).toHaveLength(5);

      await expect(
        repairProject(root, {
          apply: preview.plan.plan_digest,
          fail_after_operation: boundary,
        }),
      ).rejects.toMatchObject({ code: 'PCP_FAULT_INJECTED', mutated: false });
      expect((await inventoryRepository(root)).digest, `boundary ${boundary}`).toBe(before.digest);
    }
  }, 60_000);
});
