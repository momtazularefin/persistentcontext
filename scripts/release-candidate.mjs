import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = 'release/0.1.0-rc.json';
const enginePaths = [
  'skills/build-pcp/scripts/pcp.mjs',
  'skills/build-pcp/assets/templates/core/.pcp/tools/pcp.mjs',
  'templates/core/.pcp/tools/pcp.mjs',
];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function sourcePaths() {
  const result = spawnSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: projectRoot, encoding: 'buffer', windowsHide: true },
  );
  if (result.status !== 0) {
    throw new Error(`Cannot inventory the candidate source tree: ${result.stderr.toString()}`);
  }
  return result.stdout
    .toString('utf8')
    .split('\0')
    .filter((candidatePath) => candidatePath.length > 0 && candidatePath !== manifestPath)
    .sort((left, right) => left.localeCompare(right));
}

async function buildManifest() {
  const files = [];
  for (const sourcePath of sourcePaths()) {
    const absolutePath = path.join(projectRoot, ...sourcePath.split('/'));
    const [bytes, metadata] = await Promise.all([readFile(absolutePath), lstat(absolutePath)]);
    if (!metadata.isFile())
      throw new Error(`Candidate source is not a regular file: ${sourcePath}`);
    files.push({ path: sourcePath, bytes: bytes.length, sha256: sha256(bytes) });
  }

  const identityBytes = files
    .map((file) => `${file.sha256}  ${file.bytes}  ${file.path}\n`)
    .join('');
  const engines = await Promise.all(
    enginePaths.map(async (enginePath) => ({
      path: enginePath,
      sha256: sha256(await readFile(path.join(projectRoot, ...enginePath.split('/')))),
    })),
  );
  if (new Set(engines.map((engine) => engine.sha256)).size !== 1) {
    throw new Error('Release-candidate engine copies are not byte-identical.');
  }

  const skillFiles = files.filter((file) => file.path.startsWith('skills/build-pcp/'));
  const assetManifestPath = 'skills/build-pcp/assets/pcp-assets.sha256';
  const assetManifest = files.find((file) => file.path === assetManifestPath);
  if (assetManifest === undefined) throw new Error('Packaged skill asset manifest is missing.');

  return {
    schema_version: 1,
    release: '0.1.0',
    stage: 'release-candidate',
    identity: {
      algorithm: 'sha256',
      scope:
        'Git-known working-tree files excluding release/0.1.0-rc.json and ignored build, coverage, dependency, and runtime output.',
      source_tree_digest: sha256(identityBytes),
      file_count: files.length,
      files,
    },
    artifacts: {
      engine: { sha256: engines[0].sha256, copies: enginePaths },
      skill_assets_manifest: { path: assetManifestPath, sha256: assetManifest.sha256 },
      skill_package: {
        path: 'skills/build-pcp',
        file_count: skillFiles.length,
        bytes: skillFiles.reduce((total, file) => total + file.bytes, 0),
      },
    },
    verification: {
      local_command: 'npm ci && npm run verify',
      required_ci_checks: [
        'verify (ubuntu-latest)',
        'verify (windows-latest)',
        'golden (ubuntu-latest)',
        'golden (windows-latest)',
        'test',
      ],
      supported_adapter_ids: [
        'codex',
        'antigravity',
        'claude-code-desktop',
        'github-copilot-vscode',
        'cursor',
      ],
      freeze_rule:
        'Any source change requires an explicit unfreeze, regenerated manifest, full local verification, and a new green CI matrix before dogfood resumes.',
    },
  };
}

const expected = `${JSON.stringify(await buildManifest(), null, 2)}\n`;
const write = process.argv.slice(2);
if (write.length === 1 && write[0] === '--write') {
  await mkdir(path.dirname(path.join(projectRoot, manifestPath)), { recursive: true });
  await writeFile(path.join(projectRoot, manifestPath), expected, 'utf8');
  process.stdout.write(`Wrote ${manifestPath}.\n`);
} else if (write.length === 0) {
  const actual = await readFile(path.join(projectRoot, manifestPath), 'utf8').catch(() => '');
  if (actual !== expected) {
    throw new Error(
      `Release-candidate identity is missing or stale. Review the change, then run npm run freeze:candidate.`,
    );
  }
  const manifest = JSON.parse(actual);
  process.stdout.write(
    `Verified release candidate ${manifest.identity.source_tree_digest} (${manifest.identity.file_count} files).\n`,
  );
} else {
  throw new Error('Usage: release-candidate.mjs [--write]');
}
