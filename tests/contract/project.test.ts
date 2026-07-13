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

  it('documents implemented and unavailable milestone behavior honestly', async () => {
    const readme = await readFile(new URL('README.md', projectRoot), 'utf8');
    expect(readme).toContain('node dist/pcp.mjs inspect path/to/project --json');
    expect(readme).toContain('node dist/pcp.mjs validate path/to/managed-project');
    expect(readme).toContain('node dist/pcp.mjs render path/to/managed-project --check');
    expect(readme).toContain('Do not use this revision to adopt or migrate a live context layer.');
    expect(readme).toContain('Structural adoption, migration, registration, journaling');
  });

  it('normalizes text for deterministic cross-platform checks', async () => {
    const attributes = await readFile(new URL('.gitattributes', projectRoot), 'utf8');
    const workflow = await readFile(new URL('.github/workflows/ci.yml', projectRoot), 'utf8');

    expect(attributes.trim()).toBe('* text=auto eol=lf');
    expect(workflow).toContain('uses: actions/checkout@v5');
    expect(workflow).not.toContain('uses: actions/checkout@v4');
  });
});
