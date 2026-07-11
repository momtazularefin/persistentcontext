import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const projectRoot = new URL('../', import.meta.url);
const outputDirectory = new URL('dist/', projectRoot);

await mkdir(outputDirectory, { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL('src/cli/main.ts', projectRoot))],
  outfile: fileURLToPath(new URL('pcp.mjs', outputDirectory)),
  platform: 'node',
  target: 'node24',
  format: 'esm',
  bundle: true,
  sourcemap: true,
  legalComments: 'external',
  banner: { js: '#!/usr/bin/env node' },
});
