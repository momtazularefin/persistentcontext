import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = new URL('../', import.meta.url);
const distBundle = new URL('dist/pcp.mjs', projectRoot);
const skillBundle = new URL('skills/build-pcp/scripts/pcp.mjs', projectRoot);
const checksumPath = new URL('skills/build-pcp/scripts/pcp.sha256', projectRoot);
const assetRoot = new URL('skills/build-pcp/assets/', projectRoot);
const assetManifestPath = new URL('pcp-assets.sha256', assetRoot);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const target = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(target)));
    if (entry.isFile()) files.push(target);
  }
  return files;
}

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

const sourceRoots = [
  ['schemas', fileURLToPath(new URL('schemas/', projectRoot))],
  ['templates', fileURLToPath(new URL('templates/', projectRoot))],
];
const expectedAssets = [];
for (const [prefix, sourceRoot] of sourceRoots) {
  for (const sourceFile of await collectFiles(sourceRoot)) {
    const sourcePath = relative(sourceRoot, sourceFile).replaceAll('\\', '/');
    const assetPath = `${prefix}/${sourcePath}`;
    const sourceBytes = await readFile(sourceFile);
    const assetBytes = await readFile(new URL(assetPath, assetRoot));
    if (!sourceBytes.equals(assetBytes)) {
      throw new Error(`Skill asset differs from source: ${assetPath}`);
    }
    expectedAssets.push(`${createHash('sha256').update(sourceBytes).digest('hex')}  ${assetPath}`);
  }
}
expectedAssets.sort((left, right) => left.localeCompare(right));
const assetManifest = (await readFile(assetManifestPath, 'utf8'))
  .trim()
  .split(/\r?\n/u)
  .sort((left, right) => left.localeCompare(right));
if (JSON.stringify(assetManifest) !== JSON.stringify(expectedAssets)) {
  throw new Error('Skill asset checksum manifest is stale or incomplete.');
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

const canonicalFixture = fileURLToPath(new URL('templates/core/', assetRoot));
const validation = spawnSync(
  process.execPath,
  [fileURLToPath(skillBundle), 'validate', canonicalFixture, '--clean-genesis', '--json'],
  { encoding: 'utf8', windowsHide: true },
);
if (validation.status !== 0) {
  throw new Error(`Bundled pcp validate failed: ${validation.stderr || validation.stdout}`);
}
const validationResult = JSON.parse(validation.stdout);
if (validationResult.valid !== true || validationResult.mutated !== false) {
  throw new Error('Bundled pcp validate returned an unexpected canonical result.');
}

const rendering = spawnSync(
  process.execPath,
  [fileURLToPath(skillBundle), 'render', canonicalFixture, '--check', '--json'],
  { encoding: 'utf8', windowsHide: true },
);
if (rendering.status !== 0) {
  throw new Error(`Bundled pcp render --check failed: ${rendering.stderr || rendering.stdout}`);
}
const renderingResult = JSON.parse(rendering.stdout);
if (
  renderingResult.valid !== true ||
  renderingResult.mode !== 'check' ||
  renderingResult.mutated !== false
) {
  throw new Error('Bundled pcp render --check returned an unexpected canonical result.');
}

process.stdout.write(`Verified bundled engine ${expectedDigest}.\n`);
