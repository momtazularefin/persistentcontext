import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse, stringify } from 'yaml';

const projectRoot = new URL('../', import.meta.url);
const distBundle = new URL('dist/pcp.mjs', projectRoot);
const skillBundle = new URL('skills/build-pcp/scripts/pcp.mjs', projectRoot);
const checksumPath = new URL('skills/build-pcp/scripts/pcp.sha256', projectRoot);
const templateEnginePath = new URL('templates/core/.pcp/tools/pcp.mjs', projectRoot);
const templateChecksumPath = new URL('templates/core/.pcp/tools/pcp.sha256', projectRoot);
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

const [dist, skill, checksum, templateEngine, templateChecksum] = await Promise.all([
  readFile(distBundle),
  readFile(skillBundle),
  readFile(checksumPath, 'utf8'),
  readFile(templateEnginePath),
  readFile(templateChecksumPath, 'utf8'),
]);

if (!dist.equals(skill)) {
  throw new Error('Skill engine differs from dist/pcp.mjs.');
}
if (!dist.equals(templateEngine)) {
  throw new Error('Installed template engine differs from dist/pcp.mjs.');
}

const expectedDigest = createHash('sha256').update(dist).digest('hex');
if (checksum.trim() !== `${expectedDigest}  pcp.mjs`) {
  throw new Error('Skill engine checksum is stale.');
}
if (templateChecksum !== `${expectedDigest}  pcp.mjs\n`) {
  throw new Error('Installed template engine checksum is stale.');
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
  fixtureWrapper.valid.capabilities = ['walkthroughs', 'spec-driven-projects', 'scratch-space'];
  fixtureWrapper.valid.documentation.documents.push(
    {
      path: 'README.md',
      project_id: fixtureWrapper.valid.project.project_id,
      category: 'reference',
      status: 'living',
      summary: 'Introduces the sample project.',
      related_paths: [],
    },
    {
      path: 'scratch/README.md',
      project_id: fixtureWrapper.valid.project.project_id,
      category: 'reference',
      status: 'static',
      summary: 'Explains the optional noncanonical scratch workspace.',
      related_paths: [],
    },
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
    previewResult.adapters?.length !== 5 ||
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

  const installedManifest = parse(
    await readFile(join(adoptionCandidate, '.pcp', 'pcp.yaml'), 'utf8'),
  );
  const expectedCapabilities = ['scratch-space', 'spec-driven-projects', 'walkthroughs'];
  if (JSON.stringify(installedManifest.capabilities) !== JSON.stringify(expectedCapabilities)) {
    throw new Error('Bundled pcp adoption did not normalize selected capabilities.');
  }
  await Promise.all(
    [
      '.pcp/protocol/80-spec-driven-delivery.md',
      '.pcp/protocol/100-scratch-space.md',
      '.pcp/protocol/110-walkthrough-creation.md',
      '.pcp/templates/30-project-spec.md',
      '.pcp/templates/50-walkthrough.md',
      'scratch/README.md',
    ].map((capabilityPath) => readFile(join(adoptionCandidate, capabilityPath))),
  );

  const installedEnginePath = join(adoptionCandidate, '.pcp', 'tools', 'pcp.mjs');
  const installedChecksumPath = join(adoptionCandidate, '.pcp', 'tools', 'pcp.sha256');
  const [installedEngineBytes, installedChecksum] = await Promise.all([
    readFile(installedEnginePath),
    readFile(installedChecksumPath, 'utf8'),
  ]);
  if (!installedEngineBytes.equals(dist) || installedChecksum !== `${expectedDigest}  pcp.mjs\n`) {
    throw new Error('Bundled adoption did not install the exact checked engine.');
  }
  const installedVersion = spawnSync(process.execPath, [installedEnginePath, '--version'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (installedVersion.status !== 0 || installedVersion.stdout.trim() !== '0.2.0') {
    throw new Error(
      `Installed PCP engine did not execute independently: ${installedVersion.stderr || installedVersion.stdout}`,
    );
  }

  const expectedAdapterPaths = [
    'AGENTS.md',
    '.agents/rules/pcp.md',
    'CLAUDE.md',
    '.github/copilot-instructions.md',
    '.cursor/rules/pcp.mdc',
  ];
  if (
    JSON.stringify(previewResult.adapters.map((adapter) => adapter.target_path)) !==
    JSON.stringify(expectedAdapterPaths)
  ) {
    throw new Error('Bundled pcp adoption preview returned an unexpected adapter contract.');
  }
  await Promise.all(
    expectedAdapterPaths.map(async (adapterPath) => {
      const content = await readFile(join(adoptionCandidate, adapterPath), 'utf8');
      if (
        !content.includes('.pcp/00-index.md') ||
        !content.includes('For every user request') ||
        !content.includes('sync . --actor-id <actor-id> --execution-id <execution-id>')
      ) {
        throw new Error(`Bundled pcp adoption wrote an invalid adapter: ${adapterPath}`);
      }
    }),
  );

  const registrationArguments = [
    fileURLToPath(skillBundle),
    'register',
    adoptionCandidate,
    '--client',
    'codex',
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

  const workstreamValidation = spawnSync(
    process.execPath,
    [fileURLToPath(skillBundle), 'workstream', 'validate', adoptionCandidate, '--json'],
    { encoding: 'utf8', windowsHide: true },
  );
  if (workstreamValidation.status !== 0) {
    throw new Error(
      `Bundled pcp workstream validation failed: ${workstreamValidation.stderr || workstreamValidation.stdout}`,
    );
  }
  const workstreamValidationResult = JSON.parse(workstreamValidation.stdout);
  if (
    workstreamValidationResult.status !== 'valid' ||
    workstreamValidationResult.workstream_count !== 0 ||
    workstreamValidationResult.event_created !== false ||
    workstreamValidationResult.mutated !== false ||
    !/^[a-f0-9]{64}$/.test(workstreamValidationResult.registry_digest ?? '')
  ) {
    throw new Error('Bundled pcp workstream validation returned an unexpected result.');
  }

  const workstreamInput = join(adoptionRoot, 'workstream.json');
  await writeFile(
    workstreamInput,
    `${JSON.stringify(
      {
        schema_version: 1,
        operation: 'create',
        expected_registry_digest: workstreamValidationResult.registry_digest,
        actor: { type: 'agent', id: firstRegistrationResult.actor_id },
        recorded_by: { type: 'agent', id: firstRegistrationResult.actor_id },
        basis: 'self',
        summary: 'Created the distribution verification workstream.',
        workstream: {
          workstream_id: 'distribution-verification',
          name: 'Distribution verification',
          kind: 'concurrent',
          status: 'active',
          paths: ['dist', 'skills/build-pcp'],
          areas: ['distribution'],
          completion: { criteria: ['Bundled lifecycle passes.'], evidence: [] },
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  const workstreamCreation = spawnSync(
    process.execPath,
    [
      fileURLToPath(skillBundle),
      'workstream',
      'create',
      adoptionCandidate,
      '--input',
      workstreamInput,
      '--json',
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  if (workstreamCreation.status !== 0) {
    throw new Error(
      `Bundled pcp workstream creation failed: ${workstreamCreation.stderr || workstreamCreation.stdout}`,
    );
  }
  const workstreamCreationResult = JSON.parse(workstreamCreation.stdout);
  if (
    workstreamCreationResult.status !== 'created' ||
    workstreamCreationResult.event_created !== true ||
    workstreamCreationResult.mutated !== true ||
    workstreamCreationResult.recovery_retained !== false ||
    !/^[a-f0-9]{64}$/.test(workstreamCreationResult.registry_digest_after ?? '') ||
    !/^[a-f0-9]{64}$/.test(workstreamCreationResult.event_payload_digest ?? '')
  ) {
    throw new Error('Bundled pcp workstream creation returned an unexpected result.');
  }

  await writeFile(
    workstreamInput,
    `${JSON.stringify(
      {
        schema_version: 1,
        operation: 'complete',
        expected_registry_digest: workstreamCreationResult.registry_digest_after,
        actor: { type: 'agent', id: firstRegistrationResult.actor_id },
        recorded_by: { type: 'agent', id: firstRegistrationResult.actor_id },
        basis: 'self',
        summary: 'Completed the distribution verification workstream.',
        workstream_id: 'distribution-verification',
        evidence: [
          {
            criterion: 'Bundled lifecycle passes.',
            proof: 'The bundled create and complete commands returned accepted results.',
          },
        ],
        announcement: 'Distribution verification is complete.',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  const workstreamCompletion = spawnSync(
    process.execPath,
    [
      fileURLToPath(skillBundle),
      'workstream',
      'complete',
      adoptionCandidate,
      '--input',
      workstreamInput,
      '--json',
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  if (workstreamCompletion.status !== 0) {
    throw new Error(
      `Bundled pcp workstream completion failed: ${workstreamCompletion.stderr || workstreamCompletion.stdout}`,
    );
  }
  const workstreamCompletionResult = JSON.parse(workstreamCompletion.stdout);
  if (
    workstreamCompletionResult.status !== 'completed' ||
    workstreamCompletionResult.announcement !== 'Distribution verification is complete.' ||
    workstreamCompletionResult.event_created !== true ||
    workstreamCompletionResult.mutated !== true ||
    !/^[a-f0-9]{64}$/.test(workstreamCompletionResult.event_payload_digest ?? '')
  ) {
    throw new Error('Bundled pcp workstream completion returned an unexpected result.');
  }

  const eventInput = join(adoptionRoot, 'event.json');
  await writeFile(
    eventInput,
    `${JSON.stringify(
      {
        schema_version: 1,
        actor: { type: 'agent', id: firstRegistrationResult.actor_id },
        recorded_by: { type: 'agent', id: firstRegistrationResult.actor_id },
        basis: 'self',
        kind: 'code',
        scopes: ['distribution'],
        workstreams: [],
        summary: 'Verified immutable event recording in the packaged engine.',
        affected_paths: ['README.md'],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  const recording = spawnSync(
    process.execPath,
    [fileURLToPath(skillBundle), 'record', adoptionCandidate, '--input', eventInput, '--json'],
    { encoding: 'utf8', windowsHide: true },
  );
  if (recording.status !== 0) {
    throw new Error(`Bundled pcp recording failed: ${recording.stderr || recording.stdout}`);
  }
  const recordingResult = JSON.parse(recording.stdout);
  if (
    recordingResult.status !== 'recorded' ||
    recordingResult.event_created !== true ||
    recordingResult.mutated !== true ||
    recordingResult.active_events !== 3 ||
    recordingResult.archived_events_moved !== 0 ||
    !/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(recordingResult.event_id ?? '') ||
    !/^[a-f0-9]{64}$/.test(recordingResult.payload_digest ?? '')
  ) {
    throw new Error('Bundled pcp record returned an unexpected result.');
  }
  const recordedEvents = (
    await readdir(join(adoptionCandidate, '.pcp', 'continuity', 'events'))
  ).filter((entry) => entry.endsWith('.yaml'));
  if (recordedEvents.length !== 3) {
    throw new Error('Bundled workstream and record commands did not create three events.');
  }

  const syncArguments = [
    fileURLToPath(skillBundle),
    'sync',
    adoptionCandidate,
    '--actor-id',
    firstRegistrationResult.actor_id,
    '--execution-id',
    firstRegistrationResult.execution_id,
    '--json',
  ];
  const syncPreview = spawnSync(process.execPath, syncArguments, {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (syncPreview.status !== 0) {
    throw new Error(`Bundled pcp sync preview failed: ${syncPreview.stderr || syncPreview.stdout}`);
  }
  const syncPreviewResult = JSON.parse(syncPreview.stdout);
  if (
    syncPreviewResult.mode !== 'preview' ||
    syncPreviewResult.checkpoint?.state !== 'missing' ||
    syncPreviewResult.baseline?.required !== true ||
    syncPreviewResult.changes?.length !== 3 ||
    syncPreviewResult.acknowledgement?.required !== true ||
    syncPreviewResult.event_created !== false ||
    syncPreviewResult.mutated !== false ||
    !/^[a-f0-9]{64}$/.test(syncPreviewResult.sync_digest ?? '')
  ) {
    throw new Error('Bundled pcp sync preview returned an unexpected result.');
  }

  const syncAcknowledgement = spawnSync(
    process.execPath,
    [...syncArguments.slice(0, -1), '--acknowledge', syncPreviewResult.sync_digest, '--json'],
    { encoding: 'utf8', windowsHide: true },
  );
  if (syncAcknowledgement.status !== 0) {
    throw new Error(
      `Bundled pcp sync acknowledgement failed: ${syncAcknowledgement.stderr || syncAcknowledgement.stdout}`,
    );
  }
  const syncAcknowledgementResult = JSON.parse(syncAcknowledgement.stdout);
  if (
    syncAcknowledgementResult.mode !== 'acknowledge' ||
    syncAcknowledgementResult.checkpoint?.state !== 'current' ||
    syncAcknowledgementResult.acknowledgement?.accepted !== true ||
    syncAcknowledgementResult.event_created !== false ||
    syncAcknowledgementResult.mutated !== true
  ) {
    throw new Error('Bundled pcp sync acknowledgement returned an unexpected result.');
  }

  const currentSync = spawnSync(process.execPath, syncArguments, {
    encoding: 'utf8',
    windowsHide: true,
  });
  const currentSyncResult = currentSync.status === 0 ? JSON.parse(currentSync.stdout) : undefined;
  if (
    currentSyncResult?.checkpoint?.state !== 'current' ||
    currentSyncResult?.acknowledgement?.required !== false ||
    currentSyncResult?.mutated !== false
  ) {
    throw new Error(`Bundled pcp repeat sync failed: ${currentSync.stderr || currentSync.stdout}`);
  }
  const syncCheckpoints = (
    await readdir(join(adoptionCandidate, '.pcp', 'continuity', 'checkpoints'))
  ).filter((entry) => entry.endsWith('.yaml'));
  const syncEvents = (
    await readdir(join(adoptionCandidate, '.pcp', 'continuity', 'events'))
  ).filter((entry) => entry.endsWith('.yaml'));
  if (syncCheckpoints.length !== 1 || syncEvents.length !== 3) {
    throw new Error('Bundled pcp sync did not preserve checkpoint-only acknowledgement.');
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

  await writeFile(join(adoptionCandidate, 'AGENTS.md'), '# Drifted generated adapter\n', 'utf8');
  const repairPreview = spawnSync(
    process.execPath,
    [fileURLToPath(skillBundle), 'repair', adoptionCandidate, '--json'],
    { encoding: 'utf8', windowsHide: true },
  );
  const repairPreviewResult =
    repairPreview.status === 0 ? JSON.parse(repairPreview.stdout) : undefined;
  if (
    repairPreviewResult?.applicable !== true ||
    repairPreviewResult?.repair_paths?.[0] !== 'AGENTS.md' ||
    !/^[a-f0-9]{64}$/.test(repairPreviewResult?.plan?.plan_digest ?? '') ||
    repairPreviewResult?.mutated !== false
  ) {
    throw new Error(
      `Bundled pcp repair preview failed: ${repairPreview.stderr || repairPreview.stdout}`,
    );
  }
  const repairApply = spawnSync(
    process.execPath,
    [
      fileURLToPath(skillBundle),
      'repair',
      adoptionCandidate,
      '--apply',
      repairPreviewResult.plan.plan_digest,
      '--json',
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  const repairApplyResult = repairApply.status === 0 ? JSON.parse(repairApply.stdout) : undefined;
  if (
    repairApplyResult?.mutated !== true ||
    repairApplyResult?.validation?.checked_adapters !== 5 ||
    repairApplyResult?.recovery_cleaned !== true
  ) {
    throw new Error(`Bundled pcp repair apply failed: ${repairApply.stderr || repairApply.stdout}`);
  }

  const managedManifestPath = join(adoptionCandidate, '.pcp', 'pcp.yaml');
  const olderManifest = parse(await readFile(managedManifestPath, 'utf8'));
  olderManifest.protocol.version = '0.0.9';
  await writeFile(managedManifestPath, stringify(olderManifest), 'utf8');
  const upgradePreview = spawnSync(
    process.execPath,
    [fileURLToPath(skillBundle), 'upgrade', adoptionCandidate, '--json'],
    { encoding: 'utf8', windowsHide: true },
  );
  const upgradePreviewResult =
    upgradePreview.status === 0 ? JSON.parse(upgradePreview.stdout) : undefined;
  if (
    upgradePreviewResult?.from_version !== '0.0.9' ||
    upgradePreviewResult?.to_version !== '0.2.0' ||
    upgradePreviewResult?.applicable !== true ||
    upgradePreviewResult?.agent_migration?.required !== true ||
    upgradePreviewResult?.history_purge?.prompt_after_completion !== true ||
    !Array.isArray(upgradePreviewResult?.release_owned_paths) ||
    upgradePreviewResult?.mechanical_migration_paths?.length !== 0 ||
    !/^[a-f0-9]{64}$/.test(upgradePreviewResult?.plan?.plan_digest ?? '') ||
    upgradePreviewResult?.mutated !== false
  ) {
    throw new Error(
      `Bundled pcp upgrade preview failed: ${upgradePreview.stderr || upgradePreview.stdout}`,
    );
  }
  const upgradeApply = spawnSync(
    process.execPath,
    [
      fileURLToPath(skillBundle),
      'upgrade',
      adoptionCandidate,
      '--apply',
      upgradePreviewResult.plan.plan_digest,
      '--json',
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  const upgradeApplyResult =
    upgradeApply.status === 0 ? JSON.parse(upgradeApply.stdout) : undefined;
  if (
    upgradeApplyResult?.mutated !== true ||
    upgradeApplyResult?.validation?.checked_adapters !== 5 ||
    upgradeApplyResult?.recovery_cleaned !== true
  ) {
    throw new Error(
      `Bundled pcp upgrade apply failed: ${upgradeApply.stderr || upgradeApply.stdout}`,
    );
  }

  const purgePreview = spawnSync(
    process.execPath,
    [fileURLToPath(skillBundle), 'purge-history', adoptionCandidate, '--json'],
    { encoding: 'utf8', windowsHide: true },
  );
  const purgePreviewResult =
    purgePreview.status === 0 ? JSON.parse(purgePreview.stdout) : undefined;
  if (
    purgePreviewResult?.applicable !== true ||
    !(purgePreviewResult?.counts?.actor_profiles >= 1) ||
    purgePreviewResult?.counts?.active_events !== 3 ||
    purgePreviewResult?.counts?.checkpoints !== 1 ||
    purgePreviewResult?.event_created !== false ||
    !/^[a-f0-9]{64}$/.test(purgePreviewResult?.plan?.plan_digest ?? '') ||
    purgePreviewResult?.mutated !== false
  ) {
    throw new Error(
      `Bundled pcp history-purge preview failed: ${purgePreview.stderr || purgePreview.stdout}`,
    );
  }
  const purgeApply = spawnSync(
    process.execPath,
    [
      fileURLToPath(skillBundle),
      'purge-history',
      adoptionCandidate,
      '--apply',
      purgePreviewResult.plan.plan_digest,
      '--json',
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  const purgeApplyResult = purgeApply.status === 0 ? JSON.parse(purgeApply.stdout) : undefined;
  if (
    purgeApplyResult?.status !== 'purged' ||
    purgeApplyResult?.identity_reset !== true ||
    purgeApplyResult?.event_created !== false ||
    purgeApplyResult?.validation?.valid !== true ||
    purgeApplyResult?.recovery_cleaned !== true ||
    purgeApplyResult?.mutated !== true
  ) {
    throw new Error(
      `Bundled pcp history-purge apply failed: ${purgeApply.stderr || purgeApply.stdout}`,
    );
  }
  for (const historyDirectory of ['actors', 'events', 'archive', 'checkpoints']) {
    const remaining = (
      await readdir(join(adoptionCandidate, '.pcp', 'continuity', historyDirectory))
    ).filter((entry) => entry.endsWith('.yaml'));
    if (remaining.length !== 0) {
      throw new Error(`Bundled pcp history purge left ${historyDirectory} records.`);
    }
  }
} finally {
  await rm(adoptionRoot, { recursive: true, force: true });
}

const canonicalRoot = await mkdtemp(join(tmpdir(), 'pcp-dist-canonical-'));
try {
  const canonicalTemplate = fileURLToPath(new URL('templates/core/', assetRoot));
  await cp(canonicalTemplate, canonicalRoot, { recursive: true });
  await mkdir(join(canonicalRoot, 'docs'));
  const validation = spawnSync(
    process.execPath,
    [fileURLToPath(skillBundle), 'validate', canonicalRoot, '--clean-genesis', '--json'],
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
    [fileURLToPath(skillBundle), 'render', canonicalRoot, '--check', '--json'],
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
} finally {
  await rm(canonicalRoot, { recursive: true, force: true });
}

process.stdout.write(`Verified bundled engine ${expectedDigest}.\n`);
