import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultSkillRoot = fileURLToPath(new URL('../skills/build-pcp/', import.meta.url));
const arguments_ = process.argv.slice(2);
if (
  arguments_.length !== 0 &&
  (arguments_.length !== 2 || arguments_[0] !== '--root' || arguments_[1] === undefined)
) {
  throw new Error('Usage: scan-package-content.mjs [--root <packaged-skill-directory>]');
}
const skillRoot = arguments_.length === 0 ? defaultSkillRoot : resolve(arguments_[1]);
const exactFiles = new Set([
  'SKILL.md',
  'agents/openai.yaml',
  'assets/pcp-assets.sha256',
  'references/adoption.md',
  'references/capabilities.md',
  'references/migration-and-repair.md',
  'references/operation.md',
  'scripts/pcp.mjs',
  'scripts/pcp.sha256',
]);
const assetPrefixes = ['assets/schemas/', 'assets/templates/'];
const forbiddenNames = [
  /^\.env(?:\.|$)/u,
  /(?:credential|private[-_]?key|recovery|history)/iu,
  /\.(?:log|map|pem|pfx|p12|tmp|ts|tsx|zip)$/iu,
];
const maximumFileBytes = 1_250_000;
const maximumPackageBytes = 3_000_000;

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = resolve(directory, entry.name);
    const metadata = await lstat(absolutePath);
    if (metadata.isSymbolicLink()) {
      throw new Error(`Packaged skill contains a symbolic link: ${entry.name}`);
    }
    if (metadata.isDirectory()) files.push(...(await collectFiles(absolutePath)));
    else if (metadata.isFile()) files.push({ absolutePath, size: metadata.size });
    else throw new Error(`Packaged skill contains an unsupported entry: ${entry.name}`);
  }
  return files;
}

const files = await collectFiles(skillRoot);
const packagePaths = files.map(({ absolutePath }) =>
  relative(skillRoot, absolutePath).replaceAll('\\', '/'),
);
const findings = [];
let packageBytes = 0;

for (const [index, packagePath] of packagePaths.entries()) {
  const { size } = files[index];
  packageBytes += size;
  if (
    !exactFiles.has(packagePath) &&
    !assetPrefixes.some((prefix) => packagePath.startsWith(prefix))
  ) {
    findings.push(`${packagePath}: outside the public skill-package allowlist`);
  }
  if (forbiddenNames.some((pattern) => pattern.test(basename(packagePath)))) {
    findings.push(`${packagePath}: forbidden package filename`);
  }
  if (size > maximumFileBytes) {
    findings.push(`${packagePath}: ${size} bytes exceeds the per-file package limit`);
  }
}

for (const requiredPath of exactFiles) {
  if (!packagePaths.includes(requiredPath))
    findings.push(`${requiredPath}: required file is missing`);
}
if (packageBytes > maximumPackageBytes) {
  findings.push(`package size ${packageBytes} bytes exceeds ${maximumPackageBytes} bytes`);
}

const assetFiles = packagePaths
  .filter((packagePath) => assetPrefixes.some((prefix) => packagePath.startsWith(prefix)))
  .map((packagePath) => packagePath.slice('assets/'.length));
const manifestLines = (await readFile(resolve(skillRoot, 'assets', 'pcp-assets.sha256'), 'utf8'))
  .trim()
  .split(/\r?\n/u);
const manifestPaths = [];
for (const line of manifestLines) {
  const match = /^([a-f0-9]{64}) {2}(.+)$/u.exec(line);
  if (match?.[1] === undefined || match[2] === undefined) {
    findings.push(`assets/pcp-assets.sha256: malformed entry ${JSON.stringify(line)}`);
    continue;
  }
  const [, expectedDigest, assetPath] = match;
  manifestPaths.push(assetPath);
  const packagePath = `assets/${assetPath}`;
  const file = files[packagePaths.indexOf(packagePath)];
  if (file === undefined) {
    findings.push(`${packagePath}: listed in the manifest but missing`);
    continue;
  }
  const digest = createHash('sha256')
    .update(await readFile(file.absolutePath))
    .digest('hex');
  if (digest !== expectedDigest) findings.push(`${packagePath}: checksum mismatch`);
}

for (const assetPath of assetFiles) {
  if (!manifestPaths.includes(assetPath))
    findings.push(`assets/${assetPath}: unlisted package asset`);
}
if (new Set(packagePaths).size !== packagePaths.length) {
  findings.push('package contains duplicate normalized paths');
}
if (new Set(manifestPaths).size !== manifestPaths.length) {
  findings.push('asset manifest contains duplicate paths');
}

if (findings.length > 0) {
  throw new Error(`Package-content scan failed:\n${findings.join('\n')}`);
}

process.stdout.write(
  `Package-content scan passed (${packagePaths.length} files, ${packageBytes} bytes).\n`,
);
