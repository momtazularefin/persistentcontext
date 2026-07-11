import { readdir, readFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const ignoredDirectories = new Set(['.git', 'coverage', 'node_modules']);
const ignoredFiles = new Set(['scripts/scan-private-data.mjs']);
const binaryExtensions = new Set([
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.pdf',
  '.png',
  '.webp',
  '.zip',
]);

const privatePatterns = [
  ['career', 'hub'].join(''),
  ['pr', 'critiq'].join(''),
  ['retrie', 'vault'].join(''),
  ['shobdo', 'align'].join(''),
  ['tiger', 'it'].join(''),
  ['verdict', 'mesh'].join(''),
  ['codex', '-lenovo'].join(''),
  ['antigravity', '-lenovo'].join(''),
  ['google', 'drive\\data\\rise'].join(''),
].map((value) => value.toLowerCase());

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

const findings = [];
for (const path of await collectFiles(root)) {
  const projectPath = relative(root, path).replaceAll('\\', '/');
  if (ignoredFiles.has(projectPath) || binaryExtensions.has(extname(path).toLowerCase())) {
    continue;
  }

  const bytes = await readFile(path);
  if (bytes.includes(0)) {
    continue;
  }

  const content = bytes.toString('utf8').toLowerCase();
  for (const pattern of privatePatterns) {
    if (content.includes(pattern)) {
      findings.push(`${projectPath}: contains private pattern ${pattern}`);
    }
  }

  if (/[a-z]:\\(?:users|googledrive|data)\\/iu.test(content)) {
    findings.push(`${projectPath}: contains a concrete Windows machine path`);
  }
  if (/file:\/\/\/[a-z]:/iu.test(content)) {
    findings.push(`${projectPath}: contains an absolute file URI`);
  }
}

if (findings.length > 0) {
  throw new Error(`Private-data scan failed:\n${findings.join('\n')}`);
}

process.stdout.write('Private-data scan passed.\n');
