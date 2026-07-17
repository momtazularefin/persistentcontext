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
    expect(readme).toContain('node dist/pcp.mjs adopt --candidate path/to/project --input');
    expect(readme).toContain('node dist/pcp.mjs register path/to/managed-project --client codex');
    expect(readme).toContain('node dist/pcp.mjs validate path/to/managed-project');
    expect(readme).toContain('node dist/pcp.mjs render path/to/managed-project --check');
    expect(readme).toContain('node dist/pcp.mjs workstream validate path/to/managed-project');
    expect(readme).toContain('node dist/pcp.mjs workstream complete path/to/managed-project');
    expect(readme).toContain('node dist/pcp.mjs repair path/to/managed-project --json');
    expect(readme).toContain('node dist/pcp.mjs upgrade path/to/managed-project --json');
    expect(readme).toContain('All adoption is preview-first');
    expect(readme).toContain('Every applicable State A, B, or C plan installs the same five');
    expect(readme).toContain('State C intake additionally discovers complete foreign directories');
    expect(readme).toContain('can be marked `project-owned` and preserved unchanged');
    expect(readme).toContain('five generated platform delegations');
    expect(readme).toContain('outside the five-product contract fails closed');
    expect(readme).toContain('that digest also binds the reviewed coverage');
    expect(readme).toContain('Apply revalidates the live canonical layer and complete adapter set');
    expect(readme).toContain('generated views and adapters');
    expect(readme).toContain('Every successful invocation returns a fresh execution ULID');
    expect(readme).toContain('one proof per criterion');
    expect(readme).toContain('stable caller-supplied `change_key`');
    expect(readme).toContain('event payload digests and duplicate change keys');
    expect(readme).toContain('reject downgrades and unsafe collisions');
  });

  it('normalizes text for deterministic cross-platform checks', async () => {
    const attributes = await readFile(new URL('.gitattributes', projectRoot), 'utf8');
    const workflow = await readFile(new URL('.github/workflows/ci.yml', projectRoot), 'utf8');

    expect(attributes.trim()).toBe('* text=auto eol=lf');
    expect(workflow).toContain('uses: actions/checkout@v5');
    expect(workflow).not.toContain('uses: actions/checkout@v4');
  });
});
