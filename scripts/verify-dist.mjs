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

process.stdout.write(`Verified bundled engine ${expectedDigest}.\n`);
