import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const sourceSkill = path.join(projectRoot, 'skills', 'build-pcp');
const scanner = path.join(projectRoot, 'scripts', 'scan-package-content.mjs');
const temporaryRoots: string[] = [];

async function packagedFixture(): Promise<string> {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'pcp-package-scan-'));
  temporaryRoots.push(temporaryRoot);
  const skillRoot = path.join(temporaryRoot, 'build-pcp');
  await cp(sourceSkill, skillRoot, { recursive: true });
  return skillRoot;
}

function scan(skillRoot: string) {
  return spawnSync(process.execPath, [scanner, '--root', skillRoot], {
    encoding: 'utf8',
    windowsHide: true,
  });
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe('skill package-content scan', () => {
  it('accepts the checked public package', async () => {
    const result = scan(await packagedFixture());
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Package-content scan passed');
  });

  it('rejects a file outside the package allowlist', async () => {
    const skillRoot = await packagedFixture();
    await writeFile(path.join(skillRoot, 'notes.txt'), 'unexpected package material\n', 'utf8');

    const result = scan(skillRoot);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('notes.txt: outside the public skill-package allowlist');
  });

  it('rejects an asset whose bytes no longer match the manifest', async () => {
    const skillRoot = await packagedFixture();
    await writeFile(
      path.join(skillRoot, 'assets', 'templates', 'README.md'),
      '# Changed after packaging\n',
      'utf8',
    );

    const result = scan(skillRoot);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('assets/templates/README.md: checksum mismatch');
  });
});
