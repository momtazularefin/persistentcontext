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
      'assets/templates/core/.pcp/pcp.yaml',
      'assets/templates/core/.pcp/views/10-status.generated.md',
    ];
    for (const asset of assets) {
      await expect(access(new URL(asset, skillRoot))).resolves.toBeUndefined();
    }
  });
});
