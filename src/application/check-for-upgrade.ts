import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';

import {
  PCP_RELEASE_API_URL,
  PCP_UPDATE_CHANNEL,
  PCP_UPDATE_MANIFEST_PATH,
  PCP_UPDATE_PROVIDER,
  PCP_UPDATE_REPOSITORY,
  pcpCommitApiUrl,
} from '../domain/release.js';
import { UpgradeCheckError, type UpgradeCheckResult } from '../domain/update-check.js';
import { comparePcpVersions, UpgradeError } from '../domain/upgrade.js';
import { resolveCandidateRoot } from '../infrastructure/filesystem-inventory.js';
import { SchemaRegistry } from '../infrastructure/schema-validator.js';
import { inspectRepository } from './inspect-repository.js';

export interface CheckForUpgradeOptions {
  fetcher?: typeof fetch;
}

interface GithubCommit {
  sha: string;
  html_url: string;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function installedVersion(value: unknown): string {
  const version = objectValue(objectValue(value)?.protocol)?.version;
  if (typeof version !== 'string') {
    throw new UpgradeCheckError(
      'PCP_UPGRADE_CHECK_MANIFEST_INVALID',
      'The installed PCP manifest does not declare protocol.version.',
    );
  }
  try {
    comparePcpVersions(version, version);
  } catch (error) {
    if (error instanceof UpgradeError) {
      throw new UpgradeCheckError('PCP_UPGRADE_CHECK_MANIFEST_INVALID', error.message);
    }
    throw error;
  }
  return version;
}

function assertOfficialSource(value: unknown): void {
  const update = objectValue(objectValue(value)?.update);
  if (update === undefined) return;
  if (
    update.provider !== PCP_UPDATE_PROVIDER ||
    update.repository !== PCP_UPDATE_REPOSITORY ||
    update.channel !== PCP_UPDATE_CHANNEL
  ) {
    throw new UpgradeCheckError(
      'PCP_UPGRADE_CHECK_SOURCE_UNSUPPORTED',
      'This engine checks only the canonical PCP GitHub source.',
    );
  }
}

/**
 * Extracts the tag of the newest published release.
 *
 * GitHub's `releases/latest` already excludes drafts and prereleases, but the
 * response is still remote input: the tag is rejected unless it is a plain
 * `vMAJOR.MINOR.PATCH` reference, so a malformed or hostile value can never be
 * spliced into a later request path.
 */
function githubReleaseTag(value: unknown): string {
  const record = objectValue(value);
  if (
    record === undefined ||
    typeof record.tag_name !== 'string' ||
    !/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u.test(
      record.tag_name,
    ) ||
    record.draft === true ||
    record.prerelease === true
  ) {
    throw new UpgradeCheckError(
      'PCP_UPGRADE_CHECK_RESPONSE_INVALID',
      'GitHub returned an invalid latest-release response.',
    );
  }
  return record.tag_name;
}

function githubCommit(value: unknown): GithubCommit {
  const record = objectValue(value);
  if (
    record === undefined ||
    typeof record.sha !== 'string' ||
    typeof record.html_url !== 'string' ||
    !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(record.sha)
  ) {
    throw new UpgradeCheckError(
      'PCP_UPGRADE_CHECK_RESPONSE_INVALID',
      'GitHub returned an invalid canonical-branch commit response.',
    );
  }
  const expectedUrl = `https://github.com/${PCP_UPDATE_REPOSITORY}/commit/${record.sha}`;
  if (record.html_url !== expectedUrl) {
    throw new UpgradeCheckError(
      'PCP_UPGRADE_CHECK_RESPONSE_INVALID',
      'The canonical-branch commit URL does not match the PCP repository and revision.',
    );
  }
  return {
    sha: record.sha,
    html_url: record.html_url,
  };
}

function remoteManifest(value: unknown): string {
  const validation = new SchemaRegistry().validate('pcp-manifest', value);
  if (!validation.valid) {
    throw new UpgradeCheckError(
      'PCP_UPGRADE_CHECK_RESPONSE_INVALID',
      `The canonical GitHub manifest is invalid: ${validation.diagnostics
        .slice(0, 8)
        .map((item) => `${item.path} ${item.message}`)
        .join('; ')}`,
    );
  }
  assertOfficialSource(value);
  return installedVersion(value);
}

export async function checkForUpgrade(
  candidate = '.',
  options: CheckForUpgradeOptions = {},
): Promise<UpgradeCheckResult> {
  const root = await resolveCandidateRoot(candidate);
  const inspection = await inspectRepository(root);
  if (inspection.state !== 'managed') {
    throw new UpgradeCheckError(
      'PCP_UPGRADE_CHECK_NOT_MANAGED',
      `Update discovery requires a managed PCP project; found ${inspection.state}.`,
    );
  }
  let manifest: unknown;
  try {
    manifest = parse(await readFile(path.join(root, '.pcp', 'pcp.yaml'), 'utf8')) as unknown;
  } catch (error) {
    throw new UpgradeCheckError(
      'PCP_UPGRADE_CHECK_MANIFEST_INVALID',
      error instanceof Error ? error.message : String(error),
    );
  }
  const localVersion = installedVersion(manifest);
  assertOfficialSource(manifest);

  const fetcher = options.fetcher ?? fetch;
  const githubJson = async (
    url: string,
    subject: string,
    missingCode: string,
  ): Promise<unknown> => {
    let response: Response;
    try {
      response = await fetcher(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'persistent-context-protocol-update-check',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        redirect: 'error',
        cache: 'no-store',
      });
    } catch (error) {
      throw new UpgradeCheckError(
        'PCP_UPGRADE_CHECK_NETWORK_FAILED',
        `Unable to query the canonical PCP ${subject}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!response.ok) {
      throw new UpgradeCheckError(
        response.status === 404 ? missingCode : 'PCP_UPGRADE_CHECK_NETWORK_FAILED',
        response.status === 404 && missingCode === 'PCP_UPGRADE_CHECK_NO_RELEASE'
          ? `The canonical PCP repository has published no release yet; there is nothing to upgrade to.`
          : `GitHub ${subject} request failed with HTTP ${response.status}.`,
      );
    }
    try {
      return await response.json();
    } catch (error) {
      throw new UpgradeCheckError(
        'PCP_UPGRADE_CHECK_RESPONSE_INVALID',
        `GitHub ${subject} response is not JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const releaseTag = githubReleaseTag(
    await githubJson(PCP_RELEASE_API_URL, 'latest release', 'PCP_UPGRADE_CHECK_NO_RELEASE'),
  );
  const commit = githubCommit(
    await githubJson(
      pcpCommitApiUrl(releaseTag),
      'release revision',
      'PCP_UPGRADE_CHECK_SOURCE_UNAVAILABLE',
    ),
  );
  const sourceManifestUrl = `https://raw.githubusercontent.com/${PCP_UPDATE_REPOSITORY}/${commit.sha}/${PCP_UPDATE_MANIFEST_PATH}`;
  let manifestResponse: Response;
  try {
    manifestResponse = await fetcher(sourceManifestUrl, {
      headers: { 'User-Agent': 'persistent-context-protocol-update-check' },
      redirect: 'error',
      cache: 'no-store',
    });
  } catch (error) {
    throw new UpgradeCheckError(
      'PCP_UPGRADE_CHECK_NETWORK_FAILED',
      `Unable to read the canonical PCP manifest at revision ${commit.sha}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!manifestResponse.ok) {
    throw new UpgradeCheckError(
      manifestResponse.status === 404
        ? 'PCP_UPGRADE_CHECK_SOURCE_UNAVAILABLE'
        : 'PCP_UPGRADE_CHECK_NETWORK_FAILED',
      `GitHub canonical-manifest request failed with HTTP ${manifestResponse.status}.`,
    );
  }
  let remoteManifestValue: unknown;
  try {
    remoteManifestValue = parse(await manifestResponse.text()) as unknown;
  } catch (error) {
    throw new UpgradeCheckError(
      'PCP_UPGRADE_CHECK_RESPONSE_INVALID',
      `The canonical GitHub manifest is not YAML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const availableVersion = remoteManifest(remoteManifestValue);
  const comparison = comparePcpVersions(localVersion, availableVersion);
  const availability =
    comparison < 0 ? 'update-available' : comparison === 0 ? 'current' : 'installed-newer';
  const updateAvailable = availability === 'update-available';
  return {
    schema_version: 1,
    command: 'upgrade-check',
    candidate: '.',
    provider: PCP_UPDATE_PROVIDER,
    repository: PCP_UPDATE_REPOSITORY,
    channel: PCP_UPDATE_CHANNEL,
    source_url: PCP_RELEASE_API_URL,
    source_revision: commit.sha,
    source_revision_url: commit.html_url,
    source_manifest_url: sourceManifestUrl,
    source_bundle_url: `https://github.com/${PCP_UPDATE_REPOSITORY}/archive/${commit.sha}.tar.gz`,
    installed_version: localVersion,
    available_version: availableVersion,
    availability,
    update_available: updateAvailable,
    next_actions: updateAvailable
      ? [
          'Download the immutable source-revision bundle and verify its packaged checksums.',
          "Run that incoming release engine's upgrade preview against this project.",
          'Apply only the fully recomputed approved upgrade digest.',
        ]
      : ['Do not run upgrade apply; the canonical source manifest has no newer PCP version.'],
    mutated: false,
  };
}
