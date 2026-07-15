import { timingSafeEqual } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  AdoptionError,
  canonicalJson,
  createMutationPlan,
  sha256,
  type MutationOperation,
} from '../domain/adoption.js';
import { comparePortablePaths, type RepositoryInventory } from '../domain/inspection.js';
import {
  RepairError,
  type RepairApplyResult,
  type RepairPlanMaterial,
  type RepairPreview,
} from '../domain/repair.js';
import {
  inventoryRepository,
  resolveCandidateRoot,
} from '../infrastructure/filesystem-inventory.js';
import { executeFilesystemTransaction } from '../infrastructure/filesystem-transaction.js';
import { inspectRepository } from './inspect-repository.js';
import { renderPlatformAdapters } from './render-platform-adapters.js';
import { validateCanonicalLayer } from './validate-canonical-layer.js';
import { validatePlatformAdapters } from './validate-platform-adapters.js';

export interface RepairProjectOptions {
  apply?: string;
  fail_after_operation?: number;
}

const REPAIRABLE_CODES = new Set(['adapter.digest', 'adapter.target.read']);

function digestMatches(expected: string, supplied: string): boolean {
  if (!/^[a-f0-9]{64}$/u.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
}

function inventoryBoundTimestamp(digest: string): string {
  const window = 50 * 365 * 24 * 60 * 60 * 1000;
  const offset = Number(BigInt(`0x${digest.slice(0, 12)}`) % BigInt(window));
  return new Date(Date.UTC(2020, 0, 1) + offset).toISOString();
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
    const absolute = path.join(root, ...parent.split('/'));
    const metadata = await metadataOrUndefined(absolute);
    if (metadata === undefined) {
      missing.push(parent);
    } else if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new RepairError(
        'PCP_REPAIR_COLLISION',
        `Adapter parent is not a regular directory: ${parent}`,
      );
    }
    parent = portableParent(parent);
  }
  return missing.reverse();
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
        throw new RepairError(
          'PCP_REPAIR_PLAN_INVALID',
          `Repair content is missing for ${operation.path}.`,
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

async function planRepairMaterial(candidate = '.'): Promise<RepairPreview | RepairPlanMaterial> {
  const root = await resolveCandidateRoot(candidate);
  const inspection = await inspectRepository(root);
  if (inspection.state !== 'managed') {
    throw new RepairError(
      'PCP_REPAIR_NOT_MANAGED',
      `Repair requires an installed PCP project; inspection classified this candidate as ${inspection.state}.`,
    );
  }

  const validation = await validateCanonicalLayer(root, { archive_content: 'filenames-only' });
  const blocking = validation.diagnostics.filter((item) => !REPAIRABLE_CODES.has(item.code));
  if (blocking.length > 0) {
    throw new RepairError(
      'PCP_REPAIR_BLOCKED',
      `Repair is limited to generated platform adapters; resolve canonical diagnostics first: ${blocking
        .slice(0, 8)
        .map((item) => `${item.code} ${item.path}`)
        .join('; ')}`,
    );
  }

  const adapters = renderPlatformAdapters();
  const manifests = adapters.map((adapter) => adapter.manifest);
  const operations: Array<Omit<MutationOperation, 'operation_id'>> = [];
  const contentByPath = new Map<string, Buffer>();
  const plannedDirectories = new Set<string>();

  for (const adapter of adapters) {
    const targetPath = adapter.manifest.target_path;
    const absolute = path.join(root, ...targetPath.split('/'));
    const metadata = await metadataOrUndefined(absolute);
    if (metadata === undefined) {
      for (const directory of await missingParents(root, targetPath)) {
        if (!plannedDirectories.has(directory)) {
          plannedDirectories.add(directory);
          operations.push({ action: 'mkdir', path: directory });
        }
      }
      operations.push({
        action: 'write',
        path: targetPath,
        content_digest: adapter.manifest.content_digest,
      });
      contentByPath.set(targetPath, adapter.content);
      continue;
    }
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new RepairError(
        'PCP_REPAIR_COLLISION',
        `Adapter target is not a regular file: ${targetPath}`,
      );
    }
    const current = await readFile(absolute);
    if (sha256(current) === adapter.manifest.content_digest) continue;
    operations.push({
      action: 'replace',
      path: targetPath,
      content_digest: adapter.manifest.content_digest,
      preimage_digest: sha256(current),
    });
    contentByPath.set(targetPath, adapter.content);
  }

  const repairPaths = operations
    .filter((operation) => operation.action === 'write' || operation.action === 'replace')
    .map((operation) => operation.path);
  const base = {
    schema_version: 1 as const,
    command: 'repair' as const,
    candidate: '.' as const,
    repair_paths: repairPaths,
    diagnostics: validation.diagnostics,
    adapters: manifests,
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
      'managed-project',
      'platform-adapters',
      'rollback',
    ],
  });
  const preview = { ...base, applicable: true as const, plan };
  return { inspection, preview, content_by_path: contentByPath };
}

function isRepairPlan(value: RepairPreview | RepairPlanMaterial): value is RepairPlanMaterial {
  return 'preview' in value;
}

export async function repairProject(
  candidate = '.',
  options: RepairProjectOptions = {},
): Promise<RepairPreview | RepairApplyResult> {
  const planned = await planRepairMaterial(candidate);
  if (!isRepairPlan(planned)) {
    if (options.apply !== undefined) {
      throw new RepairError('PCP_REPAIR_NOT_APPLICABLE', 'No adapter repair is required.');
    }
    return planned;
  }
  if (options.apply === undefined) return planned.preview;
  if (!digestMatches(planned.preview.plan.plan_digest, options.apply)) {
    throw new RepairError(
      'PCP_PLAN_DIGEST_MISMATCH',
      'The approved digest does not match the fully recomputed current repair plan.',
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
            throw new RepairError(
              'PCP_SOURCE_CHANGED',
              'Project content changed while the repair transaction was running.',
              true,
            );
          }
        },
        validate_live: async () => {
          const canonical = await validateCanonicalLayer(root, {
            archive_content: 'filenames-only',
          });
          if (!canonical.valid) {
            throw new RepairError(
              'PCP_REPAIR_LIVE_INVALID',
              `Repaired project failed canonical validation: ${canonical.diagnostics
                .slice(0, 8)
                .map((item) => `${item.code} ${item.path}`)
                .join('; ')}`,
              true,
            );
          }
          const adapterValidation = await validatePlatformAdapters(root, planned.preview.adapters);
          if (!adapterValidation.valid) {
            throw new RepairError(
              'PCP_REPAIR_LIVE_INVALID',
              `Repaired adapters failed validation: ${adapterValidation.diagnostics
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
      command: 'repair',
      candidate: '.',
      plan_digest: planned.preview.plan.plan_digest,
      repaired_paths: planned.preview.repair_paths,
      applied_operations: transaction.applied_operations,
      validation: { valid: true, checked_files: checkedFiles, checked_adapters: checkedAdapters },
      recovery_cleaned: transaction.recovery_cleaned,
      mutated: true,
    };
  } catch (error) {
    if (error instanceof RepairError) throw error;
    if (error instanceof AdoptionError) {
      throw new RepairError(error.code, error.message, error.mutated, error.recoveryRoot);
    }
    throw error;
  }
}
