import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';

import { renderPlatformAdapters } from '../../src/application/render-platform-adapters.js';
import { upgradeProject } from '../../src/application/upgrade-project.js';
import { validateCanonicalLayer } from '../../src/application/validate-canonical-layer.js';
import type { UpgradeApplyResult, UpgradePreview } from '../../src/domain/upgrade.js';
import { loadReleaseTemplateFiles } from '../../src/infrastructure/adoption-assets.js';
import { canonicalSourceDigest } from '../../src/infrastructure/canonical-source-digest.js';
import { inventoryRepository } from '../../src/infrastructure/filesystem-inventory.js';

const coreTemplate = fileURLToPath(new URL('../../templates/core/.pcp/', import.meta.url));
const temporaryRoots: string[] = [];

async function olderManagedProject(
  version = '0.0.9',
  capabilities: string[] = [],
): Promise<{
  root: string;
  preserved: Map<string, Buffer>;
}> {
  const root = await mkdtemp(path.join(tmpdir(), 'pcp-upgrade-project-'));
  temporaryRoots.push(root);
  if (capabilities.length === 0) {
    await cp(coreTemplate, path.join(root, '.pcp'), { recursive: true });
  } else {
    const release = await loadReleaseTemplateFiles(capabilities);
    for (const [portablePath, content] of release.files) {
      const target = path.join(root, ...portablePath.split('/'));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content);
    }
  }
  await mkdir(path.join(root, 'docs'), { recursive: true });
  const adapters = renderPlatformAdapters();
  const manifestPath = path.join(root, '.pcp', 'pcp.yaml');
  const manifest = parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
  (manifest.protocol as Record<string, unknown>).version = version;
  manifest.capabilities = capabilities;
  manifest.adapter_ids = adapters.map((adapter) => adapter.manifest.adapter_id);
  await writeFile(manifestPath, stringify(manifest), 'utf8');
  for (const adapter of adapters) {
    const target = path.join(root, ...adapter.manifest.target_path.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, adapter.content);
  }

  const knowledgePath = path.join(root, '.pcp', 'knowledge', '10-overview.md');
  await writeFile(
    knowledgePath,
    `${await readFile(knowledgePath, 'utf8')}\nProject-owned upgrade evidence stays unchanged.\n`,
  );
  const runtimePath = path.join(root, '.pcp', 'runtime', 'actors', 'cache.json');
  await mkdir(path.dirname(runtimePath), { recursive: true });
  await writeFile(runtimePath, '{"actor_id":"local-cache"}\n');
  const sourcePath = path.join(root, 'src', 'app.ts');
  await mkdir(path.dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, 'export const preserved = true;\n');

  const protocolPath = path.join(root, '.pcp', 'protocol', '10-context-contract.md');
  await writeFile(
    protocolPath,
    `${await readFile(protocolPath, 'utf8')}\nOlder protocol guidance to replace.\n`,
  );
  const ignorePath = path.join(root, '.pcp', '.gitignore');
  await writeFile(ignorePath, `${await readFile(ignorePath, 'utf8')}# older release\n`);

  return {
    root,
    preserved: new Map([
      ['.pcp/knowledge/10-overview.md', await readFile(knowledgePath)],
      ['.pcp/runtime/actors/cache.json', await readFile(runtimePath)],
      ['src/app.ts', await readFile(sourcePath)],
    ]),
  };
}

const legacyCebTemplate = `---
doc: templates/40-workstream.md
type: plan
status: static
version: 1.1.0
last_updated: 2026-07-15T11:20:00Z
ownership: project
---

# Workstream scaffold

This Markdown scaffold supplements, but never replaces, the canonical entry in \`../state/workstreams.yaml\`.

- Workstream ID: \`[stable slug]\`
- Name: \`[human-readable name]\`
- Kind: \`[sequential | concurrent | ceb]\`
- Status: \`[planned | active | blocked | complete | cancelled]\`
- Paths: \`[owned relative paths]\`
- Areas: \`[semantic scope slugs]\`
- Dependencies: \`[workstream IDs]\`
- Completion criteria: \`[observable conditions]\`
- Evidence: \`[one criterion-to-proof mapping per completion criterion]\`
- Completion announcement: \`[what downstream work may now do]\`

Use this document for discussion only. Apply lifecycle changes through the digest-bound \`pcp workstream\` commands so the registry, generated view, and continuity event remain atomic.
`;

async function legacy01ManagedProject(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'pcp-upgrade-legacy-01-'));
  temporaryRoots.push(root);
  await cp(coreTemplate, path.join(root, '.pcp'), { recursive: true });
  await rm(path.join(root, '.pcp', 'state', 'documentation.yaml'));
  const legacyProjectPath = path.join(root, '.pcp', 'state', 'project.yaml');
  const legacyProject = parse(await readFile(legacyProjectPath, 'utf8')) as Record<string, unknown>;
  delete legacyProject.documentation_root;
  delete legacyProject.documentation_root_source;
  await writeFile(legacyProjectPath, stringify(legacyProject), 'utf8');
  const manifestPath = path.join(root, '.pcp', 'pcp.yaml');
  const manifest = parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
  (manifest.protocol as Record<string, unknown>).version = '0.1.0';
  delete manifest.update;
  manifest.capabilities = ['concurrent-execution-blocks'];
  manifest.adapter_ids = renderPlatformAdapters().map((adapter) => adapter.manifest.adapter_id);
  await writeFile(manifestPath, stringify(manifest), 'utf8');

  for (const adapter of renderPlatformAdapters()) {
    const target = path.join(root, ...adapter.manifest.target_path.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, adapter.content);
  }
  const workstreamsPath = path.join(root, '.pcp', 'state', 'workstreams.yaml');
  await writeFile(
    workstreamsPath,
    stringify({
      schema_version: 1,
      workstreams: [
        {
          workstream_id: 'delivery',
          name: 'Delivery CEB',
          kind: 'ceb',
          status: 'active',
          paths: ['src'],
          areas: ['implementation'],
          dependencies: ['foundation'],
          completion: { criteria: ['Delivery is verified.'], evidence: [] },
        },
        {
          workstream_id: 'foundation',
          name: 'Foundation',
          kind: 'sequential',
          status: 'complete',
          paths: [],
          areas: [],
          dependencies: [],
          completion: {
            criteria: ['Foundation is verified.'],
            evidence: [{ criterion: 'Foundation is verified.', proof: 'Verified.' }],
            announcement: 'Foundation is complete.',
          },
        },
      ],
    }),
    'utf8',
  );

  const protocolPath = path.join(root, '.pcp', 'protocol', '90-concurrent-execution-blocks.md');
  await writeFile(
    protocolPath,
    `---\ndoc: protocol/90-concurrent-execution-blocks.md\ntype: protocol\nstatus: static\nversion: 1.1.0\nlast_updated: 2026-07-15T11:20:00Z\nownership: protocol\n---\n\n# Concurrent Execution Blocks\n\nLegacy CEB guidance.\n`,
  );
  const templatePath = path.join(root, '.pcp', 'templates', '40-workstream.md');
  await writeFile(templatePath, legacyCebTemplate, 'utf8');
  for (const [indexPath, line] of [
    [
      'protocol/00-index.md',
      '8. [90-concurrent-execution-blocks.md](90-concurrent-execution-blocks.md) — Concurrent Execution Blocks.',
    ],
    [
      'templates/00-index.md',
      '3. [40-workstream.md](40-workstream.md) — Concurrent Execution Blocks workstream scaffold.',
    ],
  ] as const) {
    const target = path.join(root, '.pcp', ...indexPath.split('/'));
    await writeFile(target, `${await readFile(target, 'utf8')}\n${line}\n`, 'utf8');
  }

  const checkpointId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
  await writeFile(
    path.join(root, '.pcp', 'continuity', 'checkpoints', `${checkpointId}.yaml`),
    stringify({
      schema_version: 1,
      checkpoint_id: checkpointId,
      actor_id: 'codex-machine-01ARZ3NDEK',
      workstream_id: 'delivery',
      last_event_id: null,
      reconciled_at: '2026-07-15T00:00:00Z',
      scopes: ['implementation'],
      paths: ['src'],
      dependencies: ['foundation'],
    }),
    'utf8',
  );

  const viewPath = path.join(root, '.pcp', 'views', '10-status.generated.md');
  const sourceDigest = await canonicalSourceDigest(path.join(root, '.pcp'), [
    'state/project.yaml',
    'state/projects.yaml',
    'state/workstreams.yaml',
    'state/vcs-policy.yaml',
  ]);
  await writeFile(
    viewPath,
    (await readFile(viewPath, 'utf8'))
      .replace('  - state/documentation.yaml\n', '')
      .replace(/source_digest: [a-f0-9]{64}/u, `source_digest: ${sourceDigest}`),
    'utf8',
  );
  return root;
}

function applicable(
  preview: UpgradePreview | UpgradeApplyResult,
): asserts preview is UpgradePreview & {
  applicable: true;
  plan: NonNullable<UpgradePreview['plan']>;
} {
  if (preview.mutated || !preview.applicable || preview.plan === undefined) {
    throw new Error('Expected an applicable upgrade preview.');
  }
}

async function expectPreserved(
  root: string,
  preserved: ReadonlyMap<string, Buffer>,
): Promise<void> {
  for (const [portablePath, bytes] of preserved) {
    expect(await readFile(path.join(root, ...portablePath.split('/'))), portablePath).toEqual(
      bytes,
    );
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('ownership-aware upgrade', () => {
  it('migrates 0.1 CEB state and scoped checkpoints into the 0.2 global-sync contract', async () => {
    const root = await legacy01ManagedProject();
    const preview = await upgradeProject(root);
    applicable(preview);
    expect(preview.upgrade_paths).toEqual(
      expect.arrayContaining([
        '.pcp/state/workstreams.yaml',
        '.pcp/state/project.yaml',
        '.pcp/state/projects.yaml',
        '.pcp/state/documentation.yaml',
        'docs/README.md',
        '.pcp/protocol/90-concurrent-execution-blocks.md',
        '.pcp/templates/40-workstream.md',
        '.pcp/continuity/checkpoints/01ARZ3NDEKTSV4RRFFQ69G5FAV.yaml',
      ]),
    );
    expect(preview.agent_migration).toMatchObject({
      required: true,
      instruction_path: '.pcp/protocol/120-updates-and-reset.md',
    });
    expect(preview.agent_migration.review_paths).toEqual(
      expect.arrayContaining(['.pcp/state/project.yaml', 'docs/README.md']),
    );

    await upgradeProject(root, { apply: preview.plan.plan_digest });
    const manifest = parse(await readFile(path.join(root, '.pcp', 'pcp.yaml'), 'utf8')) as {
      protocol: { version: string };
      capabilities: string[];
    };
    const workstreams = parse(
      await readFile(path.join(root, '.pcp', 'state', 'workstreams.yaml'), 'utf8'),
    ) as { workstreams: Array<Record<string, unknown>> };
    expect(manifest).toMatchObject({ protocol: { version: '0.2.0' }, capabilities: [] });
    expect(workstreams.workstreams[0]).not.toHaveProperty('dependencies');
    expect(workstreams.workstreams.find((item) => item.workstream_id === 'delivery')).toMatchObject(
      {
        kind: 'concurrent',
      },
    );
    const project = parse(
      await readFile(path.join(root, '.pcp', 'state', 'project.yaml'), 'utf8'),
    ) as Record<string, unknown>;
    const documentation = parse(
      await readFile(path.join(root, '.pcp', 'state', 'documentation.yaml'), 'utf8'),
    ) as { documents: unknown[] };
    expect(project).toMatchObject({
      documentation_root: 'docs',
      documentation_root_source: 'default',
    });
    expect(documentation.documents).toEqual([
      expect.objectContaining({
        path: 'docs/README.md',
        project_id: 'pending-project',
        category: 'outcome',
      }),
    ]);
    await expect(readFile(path.join(root, 'docs', 'README.md'), 'utf8')).resolves.toContain(
      'Project-outcome knowledge belongs in this directory.',
    );
    await expect(
      readFile(path.join(root, '.pcp', 'templates', '40-workstream.md')),
    ).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await validateCanonicalLayer(root, { archive_content: 'filenames-only' })).toMatchObject(
      {
        valid: true,
        diagnostics: [],
      },
    );
  });

  it('previews and applies release-owned changes while preserving project and runtime bytes', async () => {
    const { root, preserved } = await olderManagedProject();
    const first = await upgradeProject(root);
    const repeated = await upgradeProject(root);
    expect(repeated).toEqual(first);
    applicable(first);
    expect(first).toMatchObject({
      from_version: '0.0.9',
      to_version: '0.2.0',
      applicable: true,
      mechanical_migration_paths: [],
      agent_migration: { required: true },
      history_purge: {
        prompt_after_completion: true,
        requires_explicit_human_confirmation: true,
      },
      mutated: false,
    });
    expect(first.release_owned_paths).toContain('.pcp/pcp.yaml');
    expect(first.upgrade_paths).toEqual(
      expect.arrayContaining([
        '.pcp/.gitignore',
        '.pcp/pcp.yaml',
        '.pcp/protocol/10-context-contract.md',
      ]),
    );
    expect(first.upgrade_paths).not.toContain('.pcp/knowledge/10-overview.md');
    expect(first.preserved_files).toBeGreaterThanOrEqual(preserved.size);

    const result = await upgradeProject(root, { apply: first.plan.plan_digest });
    expect(result).toMatchObject({
      command: 'upgrade',
      from_version: '0.0.9',
      to_version: '0.2.0',
      preserved_files: first.preserved_files,
      preservation_digest: first.preservation_digest,
      validation: { valid: true, checked_adapters: 5 },
      recovery_cleaned: true,
      agent_migration: { required: true },
      mutated: true,
    });
    await expectPreserved(root, preserved);
    expect(await validateCanonicalLayer(root, { archive_content: 'filenames-only' })).toMatchObject(
      {
        valid: true,
      },
    );
    const upgradedManifest = parse(await readFile(path.join(root, '.pcp', 'pcp.yaml'), 'utf8')) as {
      protocol: { version: string };
    };
    expect(upgradedManifest.protocol.version).toBe('0.2.0');
    expect(await upgradeProject(root)).toMatchObject({
      from_version: '0.2.0',
      to_version: '0.2.0',
      applicable: false,
      upgrade_paths: [],
      agent_migration: { required: false },
      history_purge: { prompt_after_completion: false },
      mutated: false,
    });
  });

  it('rejects stale approvals, invalid sources, and downgrade attempts without mutation', async () => {
    const { root } = await olderManagedProject();
    const preview = await upgradeProject(root);
    applicable(preview);
    await writeFile(path.join(root, 'src', 'app.ts'), 'export const changed = true;\n');
    await expect(upgradeProject(root, { apply: preview.plan.plan_digest })).rejects.toMatchObject({
      code: 'PCP_PLAN_DIGEST_MISMATCH',
      mutated: false,
    });

    const invalid = await olderManagedProject();
    await writeFile(path.join(invalid.root, '.pcp', 'state', 'project.yaml'), 'invalid: true\n');
    await expect(upgradeProject(invalid.root)).rejects.toMatchObject({
      code: 'PCP_UPGRADE_SOURCE_INVALID',
    });

    const newer = await olderManagedProject('9.0.0');
    await expect(upgradeProject(newer.root)).rejects.toMatchObject({
      code: 'PCP_UPGRADE_DOWNGRADE_FORBIDDEN',
    });
  });

  it('refreshes selected capability protocol while preserving its project-owned scaffold', async () => {
    const { root } = await olderManagedProject('0.0.9', ['spec-driven-projects']);
    const protocolPath = path.join(root, '.pcp', 'protocol', '80-spec-driven-delivery.md');
    const scaffoldPath = path.join(root, '.pcp', 'templates', '30-project-spec.md');
    await writeFile(
      protocolPath,
      `${await readFile(protocolPath, 'utf8')}\nOlder capability protocol text.\n`,
    );
    const personalizedScaffold = `${await readFile(scaffoldPath, 'utf8')}\nProject customization.\n`;
    await writeFile(scaffoldPath, personalizedScaffold);

    const preview = await upgradeProject(root);
    applicable(preview);
    expect(preview.upgrade_paths).toContain('.pcp/protocol/80-spec-driven-delivery.md');
    expect(preview.upgrade_paths).not.toContain('.pcp/templates/30-project-spec.md');
    await upgradeProject(root, { apply: preview.plan.plan_digest });

    expect(await readFile(protocolPath, 'utf8')).not.toContain('Older capability protocol text.');
    expect(await readFile(scaffoldPath, 'utf8')).toBe(personalizedScaffold);
    expect(await validateCanonicalLayer(root, { archive_content: 'filenames-only' })).toMatchObject(
      { valid: true },
    );
  });

  it('restores the exact project after failure at every upgrade boundary', async () => {
    const seed = await olderManagedProject();
    const seedPreview = await upgradeProject(seed.root);
    applicable(seedPreview);
    const boundaries = seedPreview.plan.operations.length + 1;

    for (let boundary = 1; boundary <= boundaries; boundary += 1) {
      const fixture = await olderManagedProject();
      const before = await inventoryRepository(fixture.root);
      const preview = await upgradeProject(fixture.root);
      applicable(preview);
      await expect(
        upgradeProject(fixture.root, {
          apply: preview.plan.plan_digest,
          fail_after_operation: boundary,
        }),
      ).rejects.toMatchObject({ code: 'PCP_FAULT_INJECTED', mutated: false });
      expect((await inventoryRepository(fixture.root)).digest, `boundary ${boundary}`).toBe(
        before.digest,
      );
      await expectPreserved(fixture.root, fixture.preserved);
    }
  });
});
