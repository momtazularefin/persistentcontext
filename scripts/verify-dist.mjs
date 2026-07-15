import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

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

const adoptionRoot = await mkdtemp(join(tmpdir(), 'pcp-dist-adoption-'));
try {
  const adoptionCandidate = join(adoptionRoot, 'candidate');
  const adoptionInput = join(adoptionRoot, 'adoption.json');
  await mkdir(adoptionCandidate);
  await writeFile(
    join(adoptionCandidate, 'README.md'),
    '# Sample project\n\nA small software seed with an explicit purpose.\n',
    'utf8',
  );
  const fixtureWrapper = parse(
    await readFile(new URL('tests/fixtures/schemas/adoption-input.yaml', projectRoot), 'utf8'),
  );
  await writeFile(adoptionInput, `${JSON.stringify(fixtureWrapper.valid, null, 2)}\n`, 'utf8');

  const adoptionPreview = spawnSync(
    process.execPath,
    [
      fileURLToPath(skillBundle),
      'adopt',
      '--candidate',
      adoptionCandidate,
      '--input',
      adoptionInput,
      '--json',
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  if (adoptionPreview.status !== 0) {
    throw new Error(
      `Bundled pcp adoption preview failed: ${adoptionPreview.stderr || adoptionPreview.stdout}`,
    );
  }
  const previewResult = JSON.parse(adoptionPreview.stdout);
  if (
    previewResult.classification !== 'A' ||
    previewResult.applicable !== true ||
    previewResult.mutated !== false ||
    !/^[a-f0-9]{64}$/.test(previewResult.plan?.plan_digest ?? '')
  ) {
    throw new Error('Bundled pcp adoption preview returned an unexpected result.');
  }

  const adoptionApply = spawnSync(
    process.execPath,
    [
      fileURLToPath(skillBundle),
      'adopt',
      '--candidate',
      adoptionCandidate,
      '--input',
      adoptionInput,
      '--apply',
      previewResult.plan.plan_digest,
      '--json',
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  if (adoptionApply.status !== 0) {
    throw new Error(
      `Bundled pcp adoption apply failed: ${adoptionApply.stderr || adoptionApply.stdout}`,
    );
  }
  const applyResult = JSON.parse(adoptionApply.stdout);
  if (
    applyResult.classification !== 'A' ||
    applyResult.mutated !== true ||
    applyResult.clean_genesis?.actor_profiles !== 0 ||
    applyResult.clean_genesis?.active_events !== 0 ||
    applyResult.clean_genesis?.archived_events !== 0 ||
    applyResult.recovery_cleaned !== true
  ) {
    throw new Error('Bundled pcp adoption apply returned an unexpected result.');
  }

  const registrationArguments = [
    fileURLToPath(skillBundle),
    'register',
    adoptionCandidate,
    '--client',
    'codex',
    '--machine-label',
    'distribution-machine',
    '--json',
  ];
  const firstRegistration = spawnSync(process.execPath, registrationArguments, {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (firstRegistration.status !== 0) {
    throw new Error(
      `Bundled pcp registration failed: ${firstRegistration.stderr || firstRegistration.stdout}`,
    );
  }
  const firstRegistrationResult = JSON.parse(firstRegistration.stdout);
  if (
    firstRegistrationResult.status !== 'created' ||
    firstRegistrationResult.profile_created !== true ||
    firstRegistrationResult.cache_created !== true ||
    firstRegistrationResult.event_created !== false ||
    firstRegistrationResult.mutated !== true
  ) {
    throw new Error('Bundled pcp first registration returned an unexpected result.');
  }

  const secondRegistration = spawnSync(process.execPath, registrationArguments, {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (secondRegistration.status !== 0) {
    throw new Error(
      `Bundled pcp repeat registration failed: ${secondRegistration.stderr || secondRegistration.stdout}`,
    );
  }
  const secondRegistrationResult = JSON.parse(secondRegistration.stdout);
  if (
    secondRegistrationResult.status !== 'recovered' ||
    secondRegistrationResult.actor_id !== firstRegistrationResult.actor_id ||
    secondRegistrationResult.execution_id === firstRegistrationResult.execution_id ||
    secondRegistrationResult.profile_created !== false ||
    secondRegistrationResult.cache_created !== false ||
    secondRegistrationResult.event_created !== false ||
    secondRegistrationResult.mutated !== false
  ) {
    throw new Error('Bundled pcp repeat registration returned an unexpected result.');
  }
  const registrationEvents = (
    await readdir(join(adoptionCandidate, '.pcp', 'continuity', 'events'))
  ).filter((entry) => entry.endsWith('.yaml'));
  if (registrationEvents.length !== 0) {
    throw new Error('Bundled pcp registration created a continuity event.');
  }

  const managedInspection = spawnSync(
    process.execPath,
    [fileURLToPath(skillBundle), 'inspect', adoptionCandidate, '--json'],
    { encoding: 'utf8', windowsHide: true },
  );
  if (managedInspection.status !== 0 || JSON.parse(managedInspection.stdout).state !== 'managed') {
    throw new Error(
      `Bundled adopted-project inspection failed: ${managedInspection.stderr || managedInspection.stdout}`,
    );
  }
} finally {
  await rm(adoptionRoot, { recursive: true, force: true });
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
