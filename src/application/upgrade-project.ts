import { timingSafeEqual } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { parse, stringify } from 'yaml';

import {
  AdoptionError,
  canonicalJson,
  createMutationPlan,
  sha256,
  type MutationOperation,
} from '../domain/adoption.js';
import { comparePortablePaths, type RepositoryInventory } from '../domain/inspection.js';
import { PCP_VERSION } from '../domain/release.js';
import {
  UpgradeError,
  type UpgradeApplyResult,
  type UpgradePlanMaterial,
  type UpgradePreview,
} from '../domain/upgrade.js';
import { loadCoreTemplateFiles } from '../infrastructure/adoption-assets.js';
import {
  matchingOwnershipClasses,
  type OwnershipPatterns,
} from '../infrastructure/canonical-ownership.js';
import { withContinuityLock } from '../infrastructure/continuity-lock.js';
import {
  inventoryRepository,
  resolveCandidateRoot,
} from '../infrastructure/filesystem-inventory.js';
import { executeFilesystemTransaction } from '../infrastructure/filesystem-transaction.js';
import { SchemaRegistry } from '../infrastructure/schema-validator.js';
import { inspectRepository } from './inspect-repository.js';
import { buildCanonicalStatusView } from './render-canonical-views.js';
import { renderPlatformAdapters } from './render-platform-adapters.js';
import { validateCanonicalLayer } from './validate-canonical-layer.js';
import { validatePlatformAdapters } from './validate-platform-adapters.js';

export interface UpgradeProjectOptions {
  apply?: string;
  fail_after_operation?: number;
}

interface ManifestShape extends Record<string, unknown> {
  protocol: { name: string; version: string };
  persistence: unknown;
  capabilities: unknown;
  ownership: OwnershipPatterns;
  adapter_ids: unknown;
  vcs_policy_path: unknown;
}

function digestMatches(expected: string, supplied: string): boolean {
  if (!/^[a-f0-9]{64}$/u.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
}

function inventoryBoundTimestamp(digest: string): string {
  const window = 50 * 365 * 24 * 60 * 60 * 1000;
  const offset = Number(BigInt(`0x${digest.slice(0, 12)}`) % BigInt(window));
  return new Date(Date.UTC(2020, 0, 1) + offset).toISOString();
}

function semverParts(value: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.exec(value);
  if (match === null)
    throw new UpgradeError('PCP_UPGRADE_VERSION_INVALID', `Invalid version: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersions(left: string, right: string): number {
  const leftParts = semverParts(left);
  const rightParts = semverParts(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function manifest(value: unknown, source: string): ManifestShape {
  const result = new SchemaRegistry().validate('pcp-manifest', value);
  if (!result.valid) {
    throw new UpgradeError(
      'PCP_UPGRADE_MANIFEST_INVALID',
      `${source} manifest is invalid: ${result.diagnostics
        .slice(0, 8)
        .map((item) => `${item.path} ${item.message}`)
        .join('; ')}`,
    );
  }
  return value as ManifestShape;
}

function yamlBuffer(value: unknown): Buffer {
  return Buffer.from(stringify(value, { lineWidth: 0, sortMapEntries: true }), 'utf8');
}

async function metadataOrUndefined(
  target: string,
): Promise<Awaited<ReturnType<typeof lstat>> | undefined> {
  try {
    return await lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

function portableParent(portablePath: string): string | undefined {
  const parent = path.posix.dirname(portablePath);
  return parent === '.' ? undefined : parent;
}

async function missingParents(root: string, portablePath: string): Promise<string[]> {
  const missing: string[] = [];
  let parent = portableParent(portablePath);
  while (parent !== undefined) {
    const metadata = await metadataOrUndefined(path.join(root, ...parent.split('/')));
    if (metadata === undefined) missing.push(parent);
    else if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new UpgradeError('PCP_UPGRADE_COLLISION', `Upgrade parent is unsafe: ${parent}`);
    }
    parent = portableParent(parent);
  }
  return missing.reverse();
}

async function collectLayerFiles(
  directory: string,
  layerRoot: string,
  result: Array<{ path: string; digest: string }>,
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => comparePortablePaths(left.name, right.name));
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    const metadata = await lstat(target);
    const relative = path.relative(layerRoot, target).split(path.sep).join('/');
    if (metadata.isSymbolicLink()) {
      throw new UpgradeError(
        'PCP_UPGRADE_SYMLINK',
        `Canonical symlink is unsupported: ${relative}`,
      );
    }
    if (metadata.isDirectory()) await collectLayerFiles(target, layerRoot, result);
    else if (metadata.isFile())
      result.push({ path: `.pcp/${relative}`, digest: sha256(await readFile(target)) });
  }
}

async function preservationSnapshot(
  root: string,
  inventory: RepositoryInventory,
  targetedPaths: ReadonlySet<string>,
  liveOwnership: OwnershipPatterns,
): Promise<Map<string, string>> {
  const preserved = new Map<string, string>();
  for (const file of inventory.files) {
    if (!targetedPaths.has(file.path)) preserved.set(file.path, file.sha256);
  }
  const layerFiles: Array<{ path: string; digest: string }> = [];
  await collectLayerFiles(path.join(root, '.pcp'), path.join(root, '.pcp'), layerFiles);
  for (const file of layerFiles) {
    const relative = file.path.slice('.pcp/'.length);
    const classes = matchingOwnershipClasses(relative, liveOwnership);
    if (classes.includes('project') || classes.includes('runtime')) {
      preserved.set(file.path, file.digest);
    }
  }
  return new Map([...preserved].sort(([left], [right]) => comparePortablePaths(left, right)));
}

function preservationDigest(preserved: ReadonlyMap<string, string>): string {
  return sha256(
    canonicalJson([...preserved].map(([filePath, digest]) => ({ path: filePath, digest }))),
  );
}

async function verifyPreserved(
  root: string,
  preserved: ReadonlyMap<string, string>,
): Promise<void> {
  for (const [portablePath, digest] of preserved) {
    const target = path.join(root, ...portablePath.split('/'));
    const metadata = await metadataOrUndefined(target);
    if (metadata === undefined || !metadata.isFile() || metadata.isSymbolicLink()) {
      throw new UpgradeError(
        'PCP_UPGRADE_PRESERVATION_FAILED',
        `Preserved file changed type or disappeared: ${portablePath}`,
        true,
      );
    }
    if (sha256(await readFile(target)) !== digest) {
      throw new UpgradeError(
        'PCP_UPGRADE_PRESERVATION_FAILED',
        `Preserved file changed: ${portablePath}`,
        true,
      );
    }
  }
}

function expectedInventory(
  original: RepositoryInventory,
  operations: readonly MutationOperation[],
  contentByPath: ReadonlyMap<string, Buffer>,
): object {
  const directories = new Set(original.directories);
  const files = new Map(original.files.map((file) => [file.path, { ...file }]));
  for (const operation of operations) {
    if (operation.action === 'mkdir') directories.add(operation.path);
    if (operation.action === 'write' || operation.action === 'replace') {
      const content = contentByPath.get(operation.path);
      if (content === undefined || operation.content_digest === undefined) {
        throw new UpgradeError(
          'PCP_UPGRADE_PLAN_INVALID',
          `Upgrade content is missing for ${operation.path}.`,
          true,
        );
      }
      files.set(operation.path, {
        path: operation.path,
        size: content.length,
        sha256: operation.content_digest,
      });
    }
  }
  return {
    directories: [...directories].sort(comparePortablePaths),
    files: [...files.values()].sort((left, right) => comparePortablePaths(left.path, right.path)),
    symlinks: original.symlinks,
    nested_repositories: original.nestedRepositories,
  };
}

function comparableInventory(inventory: RepositoryInventory): object {
  return {
    directories: inventory.directories,
    files: inventory.files,
    symlinks: inventory.symlinks,
    nested_repositories: inventory.nestedRepositories,
  };
}

async function planUpgradeMaterial(candidate = '.'): Promise<UpgradePreview | UpgradePlanMaterial> {
  const root = await resolveCandidateRoot(candidate);
  const inspection = await inspectRepository(root);
  if (inspection.state !== 'managed') {
    throw new UpgradeError(
      'PCP_UPGRADE_NOT_MANAGED',
      `Upgrade requires a managed PCP project; found ${inspection.state}.`,
    );
  }
  const currentValidation = await validateCanonicalLayer(root, {
    archive_content: 'filenames-only',
  });
  if (!currentValidation.valid) {
    throw new UpgradeError(
      'PCP_UPGRADE_SOURCE_INVALID',
      `Validate or repair the current layer before upgrade: ${currentValidation.diagnostics
        .slice(0, 8)
        .map((item) => `${item.code} ${item.path}`)
        .join('; ')}`,
    );
  }

  const liveManifest = manifest(
    parse(await readFile(path.join(root, '.pcp', 'pcp.yaml'), 'utf8')),
    'Installed',
  );
  const template = new Map(await loadCoreTemplateFiles());
  const templateManifestBytes = template.get('.pcp/pcp.yaml');
  if (templateManifestBytes === undefined) {
    throw new UpgradeError('PCP_UPGRADE_ASSETS_MISSING', 'Release manifest asset is missing.');
  }
  const releaseManifest = manifest(parse(templateManifestBytes.toString('utf8')), 'Release');
  const fromVersion = liveManifest.protocol.version;
  const toVersion = releaseManifest.protocol.version;
  if (toVersion !== PCP_VERSION) {
    throw new UpgradeError(
      'PCP_UPGRADE_ASSETS_MISMATCH',
      `Release assets are ${toVersion}, but the engine is ${PCP_VERSION}.`,
    );
  }
  if (compareVersions(fromVersion, toVersion) > 0) {
    throw new UpgradeError(
      'PCP_UPGRADE_DOWNGRADE_FORBIDDEN',
      `Installed PCP ${fromVersion} is newer than engine ${toVersion}.`,
    );
  }

  const adapters = renderPlatformAdapters();
  const mergedManifest: Record<string, unknown> = {
    ...releaseManifest,
    persistence: liveManifest.persistence,
    capabilities: liveManifest.capabilities,
    adapter_ids: adapters.map((adapter) => adapter.manifest.adapter_id),
    vcs_policy_path: liveManifest.vcs_policy_path,
  };
  manifest(mergedManifest, 'Merged');

  const desired = new Map<string, Buffer>();
  for (const [portablePath, content] of template) {
    const relative = portablePath.startsWith('.pcp/')
      ? portablePath.slice('.pcp/'.length)
      : portablePath;
    if (matchingOwnershipClasses(relative, releaseManifest.ownership).includes('protocol')) {
      desired.set(portablePath, content);
    }
  }
  desired.set('.pcp/pcp.yaml', yamlBuffer(mergedManifest));
  const view = await buildCanonicalStatusView(root);
  if (!view.valid || view.content === undefined) {
    throw new UpgradeError(
      'PCP_UPGRADE_RENDER_BLOCKED',
      `Cannot build generated status view: ${view.diagnostics.map((item) => item.message).join('; ')}`,
    );
  }
  desired.set('.pcp/views/10-status.generated.md', Buffer.from(view.content, 'utf8'));
  for (const adapter of adapters) desired.set(adapter.manifest.target_path, adapter.content);

  const contentByPath = new Map<string, Buffer>();
  const operations: Array<Omit<MutationOperation, 'operation_id'>> = [];
  const plannedDirectories = new Set<string>();
  for (const [portablePath, content] of desired) {
    const absolute = path.join(root, ...portablePath.split('/'));
    const metadata = await metadataOrUndefined(absolute);
    if (metadata === undefined) {
      for (const directory of await missingParents(root, portablePath)) {
        if (!plannedDirectories.has(directory)) {
          plannedDirectories.add(directory);
          operations.push({ action: 'mkdir', path: directory });
        }
      }
      operations.push({ action: 'write', path: portablePath, content_digest: sha256(content) });
      contentByPath.set(portablePath, content);
      continue;
    }
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new UpgradeError(
        'PCP_UPGRADE_COLLISION',
        `Upgrade target is not a regular file: ${portablePath}`,
      );
    }
    if (portablePath.startsWith('.pcp/')) {
      const relative = portablePath.slice('.pcp/'.length);
      const classes = matchingOwnershipClasses(relative, liveManifest.ownership);
      if (classes.includes('project') || classes.includes('runtime')) {
        throw new UpgradeError(
          'PCP_UPGRADE_OWNERSHIP_COLLISION',
          `Release target is currently project/runtime-owned: ${portablePath}`,
        );
      }
    }
    const current = await readFile(absolute);
    if (current.equals(content)) continue;
    operations.push({
      action: 'replace',
      path: portablePath,
      content_digest: sha256(content),
      preimage_digest: sha256(current),
    });
    contentByPath.set(portablePath, content);
  }

  const targetPaths = new Set(
    operations.filter((item) => item.action !== 'mkdir').map((item) => item.path),
  );
  const preserved = await preservationSnapshot(
    root,
    inspection.inventory,
    targetPaths,
    liveManifest.ownership,
  );
  const digest = preservationDigest(preserved);
  const upgradePaths = [...targetPaths];
  const base = {
    schema_version: 1 as const,
    command: 'upgrade' as const,
    candidate: '.' as const,
    from_version: fromVersion,
    to_version: toVersion,
    upgrade_paths: upgradePaths,
    preserved_files: preserved.size,
    preservation_digest: digest,
    adapters: adapters.map((adapter) => adapter.manifest),
    mutated: false as const,
  };
  if (operations.length === 0) return { ...base, applicable: false };
  const plan = createMutationPlan({
    inventory: inspection.inventory,
    generatedAt: inventoryBoundTimestamp(inspection.inventory.digest),
    classification: 'managed',
    operations,
    validations: [
      'canonical-layer',
      'desired-hashes',
      'ownership-preservation',
      'platform-adapters',
      'rollback',
    ],
  });
  const planValidation = new SchemaRegistry().validate('mutation-plan', plan);
  if (!planValidation.valid) {
    throw new UpgradeError(
      'PCP_UPGRADE_PLAN_INVALID',
      planValidation.diagnostics.map((item) => item.message).join('; '),
    );
  }
  const preview = { ...base, applicable: true as const, plan };
  return { inspection, preview, content_by_path: contentByPath, preserved };
}

function isUpgradePlan(value: UpgradePreview | UpgradePlanMaterial): value is UpgradePlanMaterial {
  return 'preview' in value;
}

export async function upgradeProject(
  candidate = '.',
  options: UpgradeProjectOptions = {},
): Promise<UpgradePreview | UpgradeApplyResult> {
  const planned = await planUpgradeMaterial(candidate);
  if (!isUpgradePlan(planned)) {
    if (options.apply !== undefined)
      throw new UpgradeError('PCP_UPGRADE_NOT_APPLICABLE', 'No upgrade is required.');
    return planned;
  }
  if (options.apply === undefined) return planned.preview;
  if (!digestMatches(planned.preview.plan.plan_digest, options.apply)) {
    throw new UpgradeError(
      'PCP_PLAN_DIGEST_MISMATCH',
      'The approved digest does not match the fully recomputed current upgrade plan.',
    );
  }

  const root = await resolveCandidateRoot(candidate);
  const expected = expectedInventory(
    planned.inspection.inventory,
    planned.preview.plan.operations,
    planned.content_by_path,
  );
  let checkedFiles = 0;
  let checkedAdapters = 0;
  try {
    return await withContinuityLock(root, async () => {
      const transaction = await executeFilesystemTransaction(
        root,
        planned.preview.plan,
        planned.content_by_path,
        {
          ...(options.fail_after_operation === undefined
            ? {}
            : { fail_after_operation: options.fail_after_operation }),
          verify_source_stability: async () => {
            const current = await inventoryRepository(root);
            if (canonicalJson(comparableInventory(current)) !== canonicalJson(expected)) {
              throw new UpgradeError(
                'PCP_SOURCE_CHANGED',
                'Project content changed while the upgrade transaction was running.',
                true,
              );
            }
            await verifyPreserved(root, planned.preserved);
          },
          validate_live: async () => {
            const canonical = await validateCanonicalLayer(root, {
              archive_content: 'filenames-only',
            });
            if (!canonical.valid) {
              throw new UpgradeError(
                'PCP_UPGRADE_LIVE_INVALID',
                `Upgraded project failed validation: ${canonical.diagnostics
                  .slice(0, 8)
                  .map((item) => `${item.code} ${item.path}`)
                  .join('; ')}`,
                true,
              );
            }
            const adapterValidation = await validatePlatformAdapters(
              root,
              planned.preview.adapters,
            );
            if (!adapterValidation.valid) {
              throw new UpgradeError(
                'PCP_UPGRADE_LIVE_INVALID',
                `Upgraded adapters failed validation: ${adapterValidation.diagnostics
                  .slice(0, 8)
                  .map((item) => `${item.code} ${item.path}`)
                  .join('; ')}`,
                true,
              );
            }
            checkedFiles = canonical.checked_files;
            checkedAdapters = adapterValidation.checked_adapters;
          },
        },
      );
      return {
        schema_version: 1,
        command: 'upgrade',
        candidate: '.',
        from_version: planned.preview.from_version,
        to_version: planned.preview.to_version,
        plan_digest: planned.preview.plan.plan_digest,
        upgraded_paths: planned.preview.upgrade_paths,
        preserved_files: planned.preview.preserved_files,
        preservation_digest: planned.preview.preservation_digest,
        applied_operations: transaction.applied_operations,
        validation: { valid: true, checked_files: checkedFiles, checked_adapters: checkedAdapters },
        recovery_cleaned: transaction.recovery_cleaned,
        mutated: true,
      } satisfies UpgradeApplyResult;
    });
  } catch (error) {
    if (error instanceof UpgradeError) throw error;
    if (error instanceof AdoptionError)
      throw new UpgradeError(error.code, error.message, error.mutated, error.recoveryRoot);
    throw error;
  }
}
