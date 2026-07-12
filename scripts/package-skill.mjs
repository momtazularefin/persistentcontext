import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = new URL('../', import.meta.url);
const bundlePath = new URL('dist/pcp.mjs', projectRoot);
const skillScripts = new URL('skills/build-pcp/scripts/', projectRoot);
const skillBundle = new URL('pcp.mjs', skillScripts);
const skillAssets = new URL('skills/build-pcp/assets/', projectRoot);

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

await mkdir(skillScripts, { recursive: true });
await copyFile(bundlePath, skillBundle);

const bundle = await readFile(skillBundle);
const digest = createHash('sha256').update(bundle).digest('hex');
await writeFile(new URL('pcp.sha256', skillScripts), `${digest}  pcp.mjs\n`, 'utf8');

await rm(skillAssets, { recursive: true, force: true });
await mkdir(skillAssets, { recursive: true });
await Promise.all([
  cp(new URL('schemas/', projectRoot), new URL('schemas/', skillAssets), { recursive: true }),
  cp(new URL('templates/', projectRoot), new URL('templates/', skillAssets), { recursive: true }),
]);

const assetRoot = fileURLToPath(skillAssets);
const assetFiles = await collectFiles(assetRoot);
const assetManifest = [];
for (const file of assetFiles) {
  const assetPath = relative(assetRoot, file).replaceAll('\\', '/');
  const assetDigest = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
  assetManifest.push(`${assetDigest}  ${assetPath}`);
}
await writeFile(new URL('pcp-assets.sha256', skillAssets), `${assetManifest.join('\n')}\n`, 'utf8');
