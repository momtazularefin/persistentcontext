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
});
