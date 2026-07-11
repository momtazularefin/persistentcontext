import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = new URL('../', import.meta.url);
const distBundle = new URL('dist/pcp.mjs', projectRoot);
const skillBundle = new URL('skills/build-pcp/scripts/pcp.mjs', projectRoot);
const checksumPath = new URL('skills/build-pcp/scripts/pcp.sha256', projectRoot);

const [dist, skill, checksum] = await Promise.all([
  readFile(distBundle),
  readFile(skillBundle),
  readFile(checksumPath, 'utf8'),
]);

if (!dist.equals(skill)) {
  throw new Error('Skill engine differs from dist/pcp.mjs.');
}

const expectedDigest = createHash('sha256').update(dist).digest('hex');
if (checksum.trim() !== `${expectedDigest}  pcp.mjs`) {
  throw new Error('Skill engine checksum is stale.');
}

for (const flag of ['--help', '--version']) {
  const result = spawnSync(process.execPath, [fileURLToPath(distBundle), flag], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`pcp ${flag} failed: ${result.stderr}`);
  }
}

const inspectionFixture = fileURLToPath(
  new URL('tests/fixtures/inspection/conventional/', projectRoot),
);
const inspection = spawnSync(
  process.execPath,
  [fileURLToPath(skillBundle), 'inspect', inspectionFixture, '--json'],
  { encoding: 'utf8', windowsHide: true },
);
if (inspection.status !== 0) {
  throw new Error(`Bundled pcp inspect failed: ${inspection.stderr}`);
}
const result = JSON.parse(inspection.stdout);
if (
  result.state !== 'B' ||
  result.mutated !== false ||
  result.inventory?.digest !== '26d153af0f3f4649f49db109cef381d63e75ade5f2216d9b124ba5705b29a536'
) {
  throw new Error('Bundled pcp inspect returned an unexpected golden result.');
}

process.stdout.write(`Verified bundled engine ${expectedDigest}.\n`);
