import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const projectRoot = new URL('../', import.meta.url);
const distributionEngine = new URL('dist/pcp.mjs', projectRoot);
const installedTools = new URL('templates/core/.pcp/tools/', projectRoot);
const installedEngine = new URL('pcp.mjs', installedTools);
const installedChecksum = new URL('pcp.sha256', installedTools);

await mkdir(installedTools, { recursive: true });
await copyFile(distributionEngine, installedEngine);
const bytes = await readFile(installedEngine);
const digest = createHash('sha256').update(bytes).digest('hex');
await writeFile(installedChecksum, `${digest}  pcp.mjs\n`, 'utf8');

process.stdout.write(`Synchronized installed PCP engine ${digest}.\n`);
