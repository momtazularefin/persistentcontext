import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse, stringify } from 'yaml';

import { checkForUpgrade } from '../../src/application/check-for-upgrade.js';
import { PCP_UPDATE_API_URL } from '../../src/domain/release.js';
import { comparePcpVersions } from '../../src/domain/upgrade.js';

const coreTemplate = fileURLToPath(new URL('../../templates/core/.pcp/', import.meta.url));
const temporaryRoots: string[] = [];
const sourceRevision = '0123456789abcdef0123456789abcdef01234567';
const sourceRevisionUrl =
  'https://github.com/momtazularefin/persistentcontext/commit/0123456789abcdef0123456789abcdef01234567';

async function managedProject(version: string, legacy = false): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'pcp-update-check-'));
  temporaryRoots.push(root);
  await cp(coreTemplate, path.join(root, '.pcp'), { recursive: true });
  await mkdir(path.join(root, 'docs'));
  const manifestPath = path.join(root, '.pcp', 'pcp.yaml');
  const manifest = parse(await readFile(manifestPath, 'utf8')) as {
    protocol: { version: string };
    update?: unknown;
  };
  manifest.protocol.version = version;
  if (legacy) delete manifest.update;
  await writeFile(manifestPath, stringify(manifest), 'utf8');
  return root;
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

function commit(): Response {
  return new Response(
    JSON.stringify({
      sha: sourceRevision,
      html_url: sourceRevisionUrl,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

async function sourceFetcher(version: string) {
  const manifest = parse(await readFile(path.join(coreTemplate, 'pcp.yaml'), 'utf8')) as {
    protocol: { version: string };
  };
  manifest.protocol.version = version;
  return vi.fn<typeof fetch>((input) =>
    Promise.resolve(
      requestUrl(input) === PCP_UPDATE_API_URL
        ? commit()
        : new Response(stringify(manifest), { status: 200 }),
    ),
  );
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('canonical PCP source update discovery', () => {
  it.each([
    ['0.1.0', '0.2.0', 'update-available', true],
    ['0.2.0', '0.2.0', 'current', false],
    ['0.3.0', '0.2.0', 'installed-newer', false],
    ['0.2.0-beta.1', '0.2.0', 'update-available', true],
  ] as const)(
    'compares installed %s with canonical source %s as %s',
    async (installed, available, availability, updateAvailable) => {
      const root = await managedProject(installed);
      const fetcher = await sourceFetcher(available);
      const result = await checkForUpgrade(root, { fetcher });

      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(fetcher.mock.calls[0]?.[0]).toBe(PCP_UPDATE_API_URL);
      expect(result).toMatchObject({
        command: 'upgrade-check',
        repository: 'momtazularefin/persistentcontext',
        channel: 'main',
        source_revision: sourceRevision,
        installed_version: installed,
        available_version: available,
        availability,
        update_available: updateAvailable,
        mutated: false,
      });
      expect(result.source_bundle_url).toBe(
        `https://github.com/momtazularefin/persistentcontext/archive/${sourceRevision}.tar.gz`,
      );
      expect(result.source_manifest_url).toContain(
        `/${sourceRevision}/templates/core/.pcp/pcp.yaml`,
      );
    },
  );

  it('fails closed for unavailable or malformed remote source state', async () => {
    const root = await managedProject('0.1.0');
    await expect(
      checkForUpgrade(root, {
        fetcher: () => Promise.resolve(new Response('', { status: 404 })),
      }),
    ).rejects.toMatchObject({ code: 'PCP_UPGRADE_CHECK_SOURCE_UNAVAILABLE' });
    await expect(
      checkForUpgrade(root, {
        fetcher: () =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                sha: 'not-a-commit',
                html_url: 'https://github.com/momtazularefin/persistentcontext/commit/not-a-commit',
              }),
              { status: 200 },
            ),
          ),
      }),
    ).rejects.toMatchObject({ code: 'PCP_UPGRADE_CHECK_RESPONSE_INVALID' });
    const invalidManifestFetcher = vi.fn<typeof fetch>((input) =>
      Promise.resolve(
        requestUrl(input) === PCP_UPDATE_API_URL
          ? commit()
          : new Response('protocol:\n  version: invalid\n', { status: 200 }),
      ),
    );
    await expect(checkForUpgrade(root, { fetcher: invalidManifestFetcher })).rejects.toMatchObject({
      code: 'PCP_UPGRADE_CHECK_RESPONSE_INVALID',
    });
  });

  it('checks a legacy 0.1 installation that predates update-source metadata', async () => {
    const root = await managedProject('0.1.0', true);
    const fetcher = await sourceFetcher('0.2.0');
    await expect(checkForUpgrade(root, { fetcher })).resolves.toMatchObject({
      installed_version: '0.1.0',
      available_version: '0.2.0',
      update_available: true,
    });
  });

  it('rejects a locally configured source that is not the canonical PCP repository', async () => {
    const root = await managedProject('0.1.0');
    const manifestPath = path.join(root, '.pcp', 'pcp.yaml');
    const manifest = parse(await readFile(manifestPath, 'utf8')) as {
      update: { repository: string };
    };
    manifest.update.repository = 'example/fork';
    await writeFile(manifestPath, stringify(manifest), 'utf8');
    const fetcher = await sourceFetcher('0.2.0');
    await expect(checkForUpgrade(root, { fetcher })).rejects.toMatchObject({
      code: 'PCP_UPGRADE_CHECK_SOURCE_UNSUPPORTED',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('uses semantic-version precedence rather than lexical comparison', () => {
    expect(comparePcpVersions('1.0.0-alpha.2', '1.0.0-alpha.10')).toBeLessThan(0);
    expect(comparePcpVersions('1.0.0-rc.1', '1.0.0')).toBeLessThan(0);
    expect(comparePcpVersions('1.0.0+build.1', '1.0.0+build.2')).toBe(0);
  });
});
