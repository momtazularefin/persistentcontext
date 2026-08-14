import { timingSafeEqual } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import {
  canonicalJson,
  createMutationPlan,
  sha256,
  AdoptionError,
  type MutationOperation,
} from '../domain/adoption.js';
import type { RepositoryInventory } from '../domain/inspection.js';
import {
  PurgeHistoryError,
  type PurgeHistoryApplyResult,
  type PurgeHistoryPlanMaterial,
  type PurgeHistoryPreview,
  type PurgedHistoryCounts,
} from '../domain/purge-history.js';
import { withContinuityLock } from '../infrastructure/continuity-lock.js';
import {
  inventoryRepository,
  resolveCandidateRoot,
} from '../infrastructure/filesystem-inventory.js';
import { executeFilesystemTransaction } from '../infrastructure/filesystem-transaction.js';
import { inspectRepository } from './inspect-repository.js';
import { validateCanonicalLayer } from './validate-canonical-layer.js';

export interface PurgeHistoryOptions {
  apply?: string;
  fail_after_operation?: number;
}

const WARNING =
  'This permanently removes PCP actor identities, continuity events, archived events, checkpoints, and local actor identity caches. It does not rewrite Git history.';

function digestMatches(expected: string, supplied: string): boolean {
  if (!/^[a-f0-9]{64}$/u.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
}

function emptyCounts(): PurgedHistoryCounts {
  return {
    actor_profiles: 0,
    active_events: 0,
    archived_events: 0,
    checkpoints: 0,
    identity_caches: 0,
  };
}

async function collectRegularFiles(
  root: string,
  relativeDirectory: string,
  requiredDirectory: boolean,
): Promise<string[]> {
  const directory = path.join(root, ...relativeDirectory.split('/'));
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (!requiredDirectory && (error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    const target = path.join(directory, entry.name);
    const metadata = await lstat(target);
    if (metadata.isSymbolicLink()) {
      throw new PurgeHistoryError(
        'PCP_PURGE_HISTORY_PATH_UNSAFE',
        `History purge does not follow symbolic links: ${relativePath}`,
      );
    }
    if (metadata.isDirectory()) {
      files.push(...(await collectRegularFiles(root, relativePath, true)));
    } else if (metadata.isFile()) {
      files.push(relativePath);
    } else {
      throw new PurgeHistoryError(
        'PCP_PURGE_HISTORY_PATH_UNSAFE',
        `History purge supports only regular files: ${relativePath}`,
      );
    }
  }
  return files;
}

function historyCategory(portablePath: string): keyof PurgedHistoryCounts | undefined {
  if (/^\.pcp\/continuity\/actors\/[^/]+\.yaml$/u.test(portablePath)) {
    return 'actor_profiles';
  }
  if (/^\.pcp\/continuity\/events\/[^/]+\.yaml$/u.test(portablePath)) {
    return 'active_events';
  }
  if (/^\.pcp\/continuity\/archive\/[^/]+\.yaml$/u.test(portablePath)) {
    return 'archived_events';
  }
  if (/^\.pcp\/continuity\/checkpoints\/[^/]+\.yaml$/u.test(portablePath)) {
    return 'checkpoints';
  }
  if (portablePath.startsWith('.pcp/runtime/actors/')) return 'identity_caches';
  return undefined;
}

async function purgeTargets(root: string): Promise<{
  paths: string[];
  counts: PurgedHistoryCounts;
}> {
  const candidates = (
    await Promise.all([
      collectRegularFiles(root, '.pcp/continuity/actors', true),
      collectRegularFiles(root, '.pcp/continuity/events', true),
      collectRegularFiles(root, '.pcp/continuity/archive', true),
      collectRegularFiles(root, '.pcp/continuity/checkpoints', true),
      collectRegularFiles(root, '.pcp/runtime/actors', false),
    ])
  ).flat();
  const counts = emptyCounts();
  const paths: string[] = [];
  for (const candidate of candidates.sort((left, right) => left.localeCompare(right))) {
    if (candidate.endsWith('/00-index.md')) continue;
    const category = historyCategory(candidate);
    if (category === undefined) {
      throw new PurgeHistoryError(
        'PCP_PURGE_HISTORY_UNEXPECTED_FILE',
        `Refusing to purge an unrecognized file from a history location: ${candidate}`,
      );
    }
    counts[category] += 1;
    paths.push(candidate);
  }
  return { paths, counts };
}

function expectedInventory(
  original: RepositoryInventory,
  operations: readonly MutationOperation[],
): object {
  const removed = new Set(
    operations
      .filter((operation) => operation.action === 'remove')
      .map((operation) => operation.path),
  );
  return {
    directories: original.directories,
    files: original.files.filter((file) => !removed.has(file.path)),
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

async function planPurgeHistory(
  candidate: string,
): Promise<PurgeHistoryPreview | PurgeHistoryPlanMaterial> {
  const root = await resolveCandidateRoot(candidate);
  const inspection = await inspectRepository(root);
  if (inspection.state !== 'managed') {
    throw new PurgeHistoryError(
      'PCP_PURGE_HISTORY_NOT_MANAGED',
      `History purge requires a managed PCP project; found ${inspection.state}.`,
    );
  }
  const validation = await validateCanonicalLayer(root, { archive_content: 'filenames-only' });
  if (!validation.valid) {
    throw new PurgeHistoryError(
      'PCP_PURGE_HISTORY_SOURCE_INVALID',
      `Validate or repair the current layer before purging history: ${validation.diagnostics
        .slice(0, 8)
        .map((item) => `${item.code} ${item.path}`)
        .join('; ')}`,
    );
  }
  const { paths, counts } = await purgeTargets(root);
  const base = {
    schema_version: 1 as const,
    command: 'purge-history' as const,
    candidate: '.' as const,
    purge_paths: paths,
    counts,
    warning: WARNING,
    event_created: false as const,
    mutated: false as const,
  };
  if (paths.length === 0) return { ...base, applicable: false };
  const operations: Array<Omit<MutationOperation, 'operation_id'>> = [];
  for (const portablePath of paths) {
    operations.push({
      action: 'remove',
      path: portablePath,
      preimage_digest: sha256(await readFile(path.join(root, ...portablePath.split('/')))),
    });
  }
  const plan = createMutationPlan({
    inventory: inspection.inventory,
    classification: 'managed',
    operations,
    validations: ['clean-genesis', 'history-targets-empty', 'rollback'],
  });
  const preview = { ...base, applicable: true as const, plan };
  return { preview };
}

function isPurgePlan(
  value: PurgeHistoryPreview | PurgeHistoryPlanMaterial,
): value is PurgeHistoryPlanMaterial {
  return 'preview' in value;
}

export async function purgeHistory(
  candidate = '.',
  options: PurgeHistoryOptions = {},
): Promise<PurgeHistoryPreview | PurgeHistoryApplyResult> {
  const planned = await planPurgeHistory(candidate);
  if (!isPurgePlan(planned)) {
    if (options.apply !== undefined) {
      throw new PurgeHistoryError(
        'PCP_PURGE_HISTORY_NOT_APPLICABLE',
        'PCP actor and continuity history is already empty.',
      );
    }
    return planned;
  }
  if (options.apply === undefined) return planned.preview;
  if (!digestMatches(planned.preview.plan.plan_digest, options.apply)) {
    throw new PurgeHistoryError(
      'PCP_PLAN_DIGEST_MISMATCH',
      'The approved digest does not match the fully recomputed current history-purge plan.',
    );
  }

  const root = await resolveCandidateRoot(candidate);
  const initialInventory = await inventoryRepository(root);
  const expected = expectedInventory(initialInventory, planned.preview.plan.operations);
  let checkedFiles = 0;
  try {
    return await withContinuityLock(root, async () => {
      const transaction = await executeFilesystemTransaction(
        root,
        planned.preview.plan,
        new Map(),
        {
          ...(options.fail_after_operation === undefined
            ? {}
            : { fail_after_operation: options.fail_after_operation }),
          verify_source_stability: async () => {
            const current = await inventoryRepository(root);
            if (canonicalJson(comparableInventory(current)) !== canonicalJson(expected)) {
              throw new PurgeHistoryError(
                'PCP_SOURCE_CHANGED',
                'Project content changed while the history-purge transaction was running.',
                true,
              );
            }
          },
          validate_live: async () => {
            const canonical = await validateCanonicalLayer(root, {
              archive_content: 'filenames-only',
              clean_genesis: true,
            });
            if (!canonical.valid) {
              throw new PurgeHistoryError(
                'PCP_PURGE_HISTORY_LIVE_INVALID',
                `Purged project failed clean-genesis validation: ${canonical.diagnostics
                  .slice(0, 8)
                  .map((item) => `${item.code} ${item.path}`)
                  .join('; ')}`,
                true,
              );
            }
            const remaining = await purgeTargets(root);
            if (remaining.paths.length !== 0) {
              throw new PurgeHistoryError(
                'PCP_PURGE_HISTORY_LIVE_INVALID',
                'One or more actor, event, archive, checkpoint, or identity-cache files remain.',
                true,
              );
            }
            checkedFiles = canonical.checked_files;
          },
        },
      );
      return {
        schema_version: 1,
        command: 'purge-history',
        candidate: '.',
        status: 'purged',
        plan_digest: planned.preview.plan.plan_digest,
        purged_paths: planned.preview.purge_paths,
        counts: planned.preview.counts,
        applied_operations: transaction.applied_operations,
        validation: { valid: true, checked_files: checkedFiles },
        recovery_cleaned: transaction.recovery_cleaned,
        identity_reset: true,
        next_action: 'Register a fresh project actor identity before the next project operation.',
        event_created: false,
        mutated: true,
      } satisfies PurgeHistoryApplyResult;
    });
  } catch (error) {
    if (error instanceof PurgeHistoryError) throw error;
    if (error instanceof AdoptionError) {
      throw new PurgeHistoryError(error.code, error.message, error.mutated, error.recoveryRoot);
    }
    throw error;
  }
}
