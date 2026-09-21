import { readFile } from 'node:fs/promises';

import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

import { PCP_NAME, PCP_RELEASE_STAGE, PCP_VERSION } from '../../src/domain/release.js';

const projectRoot = new URL('../../', import.meta.url);

describe('release identity', () => {
  it('uses the locked public identity', () => {
    expect(PCP_NAME).toBe('Persistent Context Protocol');
    expect(PCP_RELEASE_STAGE).toBe('deterministic-identity');
    expect(PCP_VERSION).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u);
  });

  it('carries one version through every copy that claims it', async () => {
    // The version is written into the package, the engine constant, and the
    // manifest each installation receives. Nothing at runtime reconciles them,
    // and `upgrade` compares the engine constant against the manifest it ships,
    // so a bump that misses one copy makes the engine refuse its own assets.
    const [packageMetadata, manifest] = await Promise.all([
      readFile(new URL('package.json', projectRoot), 'utf8').then(
        (contents) => JSON.parse(contents) as { version: string },
      ),
      readFile(new URL('templates/core/.pcp/pcp.yaml', projectRoot), 'utf8').then(
        (contents) => parse(contents) as { protocol: { version: string } },
      ),
    ]);

    expect(packageMetadata.version).toBe(PCP_VERSION);
    expect(manifest.protocol.version).toBe(PCP_VERSION);

    // npm tolerates a stale root version in the lockfile, so nothing else would
    // notice; the lockfile said 0.2.0 through the whole 0.3.0 release.
    const lock = JSON.parse(await readFile(new URL('package-lock.json', projectRoot), 'utf8')) as {
      version: string;
      packages: Record<string, { version?: string }>;
    };
    expect(lock.version).toBe(PCP_VERSION);
    expect(lock.packages['']?.version).toBe(PCP_VERSION);
  });
});
