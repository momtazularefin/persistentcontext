import { access, readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const skillRoot = new URL('../../skills/build-pcp/', import.meta.url);

describe('build-pcp skill contract', () => {
  it('contains complete metadata and no placeholders', async () => {
    const skill = await readFile(new URL('SKILL.md', skillRoot), 'utf8');
    expect(skill).toContain('name: build-pcp');
    expect(skill).not.toContain('TODO');
    expect(skill.split(/\r?\n/u).length).toBeLessThan(500);
  });

  it('routes directly to every lifecycle reference', async () => {
    const references = [
      'adoption.md',
      'operation.md',
      'migration-and-repair.md',
      'capabilities.md',
    ];

    const skill = await readFile(new URL('SKILL.md', skillRoot), 'utf8');
    for (const reference of references) {
      expect(skill).toContain(`references/${reference}`);
      await expect(access(new URL(`references/${reference}`, skillRoot))).resolves.toBeUndefined();
    }
  });

  it('packages the canonical schemas and templates as checked assets', async () => {
    const assets = [
      'assets/pcp-assets.sha256',
      'assets/schemas/v1/adoption-input.schema.json',
      'assets/schemas/v1/pcp-manifest.schema.json',
      'assets/schemas/v1/workstream-operation-input.schema.json',
      'assets/templates/core/.pcp/pcp.yaml',
      'assets/templates/core/.pcp/views/10-status.generated.md',
      'assets/templates/core/.pcp/tools/pcp.mjs',
      'assets/templates/core/.pcp/tools/pcp.sha256',
      'assets/templates/capabilities/concurrent-execution-blocks/capability.yaml',
      'assets/templates/capabilities/scratch-space/capability.yaml',
      'assets/templates/capabilities/spec-driven-projects/capability.yaml',
      'assets/templates/capabilities/walkthroughs/capability.yaml',
    ];
    for (const asset of assets) {
      await expect(access(new URL(asset, skillRoot))).resolves.toBeUndefined();
    }
  });

  it('documents executable actor registration without inventing an event', async () => {
    const skill = await readFile(new URL('SKILL.md', skillRoot), 'utf8');
    const operation = await readFile(new URL('references/operation.md', skillRoot), 'utf8');

    expect(skill).toContain('`register`');
    expect(operation).toContain(
      'register <project-root> --client <client> --machine-label <machine-slug> --json',
    );
    expect(operation).toContain('returned `execution_id`');
    expect(operation).toContain('Registration, status checks, and unchanged rendering');
    expect(operation).toContain('supply a stable `change_key`');
    expect(operation).toContain('assigns a payload digest');
  });

  it('documents digest-bound workstream completion through the engine', async () => {
    const operation = await readFile(new URL('references/operation.md', skillRoot), 'utf8');

    expect(operation).toContain('workstream validate <project-root>');
    expect(operation).toContain('workstream complete <project-root>');
    expect(operation).toContain('one exact criterion-to-proof mapping');
    expect(operation).toContain('same continuity lock');
  });

  it('documents preview-first adapter repair and ownership-aware upgrade', async () => {
    const skill = await readFile(new URL('SKILL.md', skillRoot), 'utf8');
    const migration = await readFile(
      new URL('references/migration-and-repair.md', skillRoot),
      'utf8',
    );

    expect(skill).toContain('Repair changes only missing or stale generated adapters');
    expect(skill).toContain('Upgrade merges live project selections');
    expect(migration).toContain('repair <project-root> --json');
    expect(migration).toContain('repair <project-root> --apply <plan-digest> --json');
    expect(migration).toContain('Use `render` for generated status-view drift');
    expect(migration).toContain('upgrade <project-root> --json');
    expect(migration).toContain('every project/runtime-owned canonical file');
  });

  it('documents every executable lifecycle command without an improvised mutation path', async () => {
    const references = await Promise.all(
      ['adoption.md', 'operation.md', 'migration-and-repair.md'].map((reference) =>
        readFile(new URL(`references/${reference}`, skillRoot), 'utf8'),
      ),
    );
    const documented = references.join('\n');
    for (const command of [
      'inspect <candidate-directory> --json',
      'adopt --candidate <candidate-directory> --input <temporary-input> --json',
      'adopt --candidate <candidate-directory> --input <temporary-input> --apply <plan-digest> --json',
      'register <project-root> --client <client> --machine-label <machine-slug> --json',
      'status <project-root> --actor-id <actor-id>',
      'record <project-root> --input <external-event.yaml> --json',
      'validate <project-root> --archive-index-only --json',
      'render <project-root> --check --json',
      'workstream validate <project-root>',
      'workstream create <project-root> --input <external-workstream.yaml> --json',
      'workstream update <project-root> --input <external-workstream.yaml> --json',
      'workstream complete <project-root> --input <external-workstream.yaml> --json',
      'repair <project-root> --apply <plan-digest> --json',
      'upgrade <project-root> --apply <plan-digest> --json',
    ]) {
      expect(documented, command).toContain(command);
    }
    expect(documented).toContain('never reproduce its replacement or removal operations manually');
  });

  it('documents explicit checked capability selection and lifecycle preservation', async () => {
    const capabilityReference = await readFile(
      new URL('references/capabilities.md', skillRoot),
      'utf8',
    );
    for (const capability of [
      'concurrent-execution-blocks',
      'scratch-space',
      'spec-driven-projects',
      'walkthroughs',
    ]) {
      expect(capabilityReference).toContain(`\`${capability}\``);
    }
    expect(capabilityReference).toContain("input's `capabilities` array");
    expect(capabilityReference).toContain('installs overlays in canonical order');
    expect(capabilityReference).toContain('Upgrade preserves the installed selection');
    expect(capabilityReference).toContain('do not edit the manifest or copy overlays manually');
  });
});
