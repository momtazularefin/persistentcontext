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
    expect(readme).toContain(
      'State C intake first requires an evidence-backed disposition for every detected foreign root',
    );
    expect(readme).toContain('fingerprinted file/adapter/history/registry records');
    expect(readme).toContain('can still be marked `project-owned` and preserved unchanged');
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
    expect(workflow).toContain('npm run scan:package');
    expect(workflow).toContain('npm run scan:private');
    expect(workflow).toContain('golden (${{ matrix.os }})');
    expect(workflow).toContain('os: [ubuntu-latest, windows-latest]');
    expect(workflow).toContain('npm run test:golden');
    expect(workflow).toContain('npm run verify:candidate');
    expect(workflow).toContain('needs: [verify, golden]');
  });

  it('publishes a reproducible release-candidate contract without claiming dogfood', async () => {
    const [readme, documentation, manifestText] = await Promise.all([
      readFile(new URL('README.md', projectRoot), 'utf8'),
      readFile(new URL('docs/release-candidate.md', projectRoot), 'utf8'),
      readFile(new URL('release/0.1.0-rc.json', projectRoot), 'utf8'),
    ]);
    const manifest = JSON.parse(manifestText) as unknown;

    expect(readme).toContain('is a release candidate');
    expect(documentation).toContain(
      'The private `rise` conversion criteria are intentionally not claimed',
    );
    expect(documentation).toContain('explicitly unfreeze this candidate');
    expect(manifest).toMatchObject({
      schema_version: 1,
      release: '0.1.0',
      stage: 'release-candidate',
      verification: { local_command: 'npm ci && npm run verify' },
    });
  });
});
