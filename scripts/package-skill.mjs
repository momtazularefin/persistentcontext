import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const projectRoot = new URL('../', import.meta.url);
const bundlePath = new URL('dist/pcp.mjs', projectRoot);
const skillScripts = new URL('skills/build-pcp/scripts/', projectRoot);
const skillBundle = new URL('pcp.mjs', skillScripts);

await mkdir(skillScripts, { recursive: true });
await copyFile(bundlePath, skillBundle);

const bundle = await readFile(skillBundle);
const digest = createHash('sha256').update(bundle).digest('hex');
await writeFile(new URL('pcp.sha256', skillScripts), `${digest}  pcp.mjs\n`, 'utf8');
