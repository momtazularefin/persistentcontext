import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const projectRoot = new URL('../../', import.meta.url);

describe('public project contract', () => {
  it('cannot be accidentally published as a global CLI', async () => {
    const packageJson = JSON.parse(
      await readFile(new URL('package.json', projectRoot), 'utf8'),
    ) as Record<string, unknown>;

    expect(packageJson.name).toBe('persistentcontext');
    expect(packageJson.private).toBe(true);
    expect(packageJson.license).toBe('Apache-2.0');
    expect(packageJson).not.toHaveProperty('bin');
  });

  it('documents the scaffold limitation honestly', async () => {
    const readme = await readFile(new URL('README.md', projectRoot), 'utf8');
    expect(readme).toContain('Do not use this revision to migrate a live context layer.');
    expect(readme).toContain('intentionally fail closed');
  });
});
