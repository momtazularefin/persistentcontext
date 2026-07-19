import { timingSafeEqual } from 'node:crypto';

import {
  ADOPTION_SCHEMA_VERSION,
  AdoptionError,
  canonicalJson,
  type AdoptionApplyResult,
  type MutationPlan,
  type AdoptionPreview,
} from '../domain/adoption.js';
import {
  comparePortablePaths,
  type FileFingerprint,
  type RepositoryInventory,
} from '../domain/inspection.js';
import {
  inventoryRepository,
  resolveCandidateRoot,
} from '../infrastructure/filesystem-inventory.js';
import { executeFilesystemTransaction } from '../infrastructure/filesystem-transaction.js';
import { inspectRepository } from './inspect-repository.js';
import { isPlanMaterial, planAdoption } from './plan-adoption.js';
import { validateCanonicalLayer } from './validate-canonical-layer.js';
import { validatePlatformAdapters } from './validate-platform-adapters.js';

export interface AdoptProjectOptions {
  input?: string;
  apply?: string;
  fail_after_operation?: number;
}

function digestMatches(expected: string, supplied: string): boolean {
  if (!/^[a-f0-9]{64}$/u.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
}

function comparableInventory(inventory: RepositoryInventory): object {
  return {
    directories: inventory.directories,
    files: inventory.files,
    symlinks: inventory.symlinks,
    nested_repositories: inventory.nestedRepositories,
  };
}

async function verifyAdoptionSourceStability(
  root: string,
  original: RepositoryInventory,
  plan: MutationPlan,
  contentByPath: ReadonlyMap<string, Buffer>,
  persistence: 'tracked' | 'local',
): Promise<void> {
  const allowedActions =
    plan.classification === 'C'
      ? new Set(['mkdir', 'write', 'replace', 'remove', 'move', 'rmdir'])
      : new Set(['mkdir', 'write']);
  if (plan.operations.some((operation) => !allowedActions.has(operation.action))) {
    throw new AdoptionError(
      'PCP_ADOPTION_PLAN_UNSAFE',
      plan.classification === 'C'
        ? 'State C adoption may contain only approved directory creation, file creation, replacement, removal, relocation, and empty-directory cleanup operations.'
        : 'State A/B adoption may contain only new-directory and new-file operations.',
      true,
    );
  }

  const expectedDirectories = new Set(original.directories);
  const expectedFiles = new Map(
    original.files.map((file) => [file.path, { ...file }] satisfies [string, FileFingerprint]),
  );
  const hiddenByLocalPersistence = (candidatePath: string): boolean =>
    persistence === 'local' && (candidatePath === '.pcp' || candidatePath.startsWith('.pcp/'));

  for (const operation of plan.operations) {
    if (hiddenByLocalPersistence(operation.path)) continue;
    switch (operation.action) {
      case 'mkdir':
        expectedDirectories.add(operation.path);
        break;
      case 'write':
      case 'replace': {
        const content = contentByPath.get(operation.path);
        if (content === undefined || operation.content_digest === undefined) {
          throw new AdoptionError(
            'PCP_ADOPTION_PLAN_CONTENT_MISMATCH',
            `The approved operation is missing expected content: ${operation.path}`,
            true,
          );
        }
        expectedFiles.set(operation.path, {
          path: operation.path,
          size: content.length,
          sha256: operation.content_digest,
        });
        break;
      }
      case 'remove':
        expectedFiles.delete(operation.path);
        break;
      case 'move': {
        if (operation.source_path === undefined) {
          throw new AdoptionError(
            'PCP_ADOPTION_PLAN_UNSAFE',
            `Move operation is missing its reviewed source: ${operation.path}`,
            true,
          );
        }
        const source = expectedFiles.get(operation.source_path);
        if (source === undefined || source.sha256 !== operation.preimage_digest) {
          throw new AdoptionError(
            'PCP_ADOPTION_PLAN_UNSAFE',
            `Move operation does not match its reviewed source preimage: ${operation.source_path}`,
            true,
          );
        }
        expectedFiles.delete(operation.source_path);
        expectedFiles.set(operation.path, { ...source, path: operation.path });
        break;
      }
      case 'rmdir':
        expectedDirectories.delete(operation.path);
        break;
    }
  }

  const expected = {
    directories: [...expectedDirectories].sort(comparePortablePaths),
    files: [...expectedFiles.values()].sort((left, right) =>
      comparePortablePaths(left.path, right.path),
    ),
    symlinks: original.symlinks,
    nested_repositories: original.nestedRepositories,
  };
  const current = await inventoryRepository(root);
  if (canonicalJson(comparableInventory(current)) !== canonicalJson(expected)) {
    throw new AdoptionError(
      'PCP_SOURCE_CHANGED',
      'Candidate-owned source changed while the adoption transaction was running.',
      true,
    );
  }
}

export async function adoptProject(
  candidate = '.',
  options: AdoptProjectOptions = {},
): Promise<AdoptionPreview | AdoptionApplyResult> {
  if (options.apply !== undefined && options.input === undefined) {
    throw new AdoptionError(
      'PCP_ADOPTION_INPUT_REQUIRED',
      'Applying adoption requires the same external semantic input used to create the preview.',
    );
  }

  const planned = await planAdoption(candidate, options.input);
  if (!isPlanMaterial(planned)) {
    if (options.apply !== undefined) {
      throw new AdoptionError(
        'PCP_ADOPTION_NOT_APPLICABLE',
        `The ${planned.classification} candidate is not ready for an applicable adoption plan.`,
      );
    }
    return planned;
  }
  if (options.apply === undefined) return planned.preview;
  if (!digestMatches(planned.preview.plan.plan_digest, options.apply)) {
    throw new AdoptionError(
      'PCP_PLAN_DIGEST_MISMATCH',
      'The approved digest does not match the fully recomputed current adoption plan.',
    );
  }

  const root = await resolveCandidateRoot(candidate);
  let checkedFiles = 0;
  const transaction = await executeFilesystemTransaction(
    root,
    planned.preview.plan,
    planned.content_by_path,
    {
      ...(options.fail_after_operation === undefined
        ? {}
        : { fail_after_operation: options.fail_after_operation }),
      verify_source_stability: async () =>
        verifyAdoptionSourceStability(
          root,
          planned.inspection.inventory,
          planned.preview.plan,
          planned.content_by_path,
          planned.input.persistence,
        ),
      validate_live: async () => {
        const validation = await validateCanonicalLayer(root, { clean_genesis: true });
        if (!validation.valid) {
          throw new AdoptionError(
            'PCP_ADOPTION_LIVE_INVALID',
            `Applied canonical layer failed validation: ${validation.diagnostics
              .slice(0, 8)
              .map((item) => `${item.path}: ${item.message}`)
              .join('; ')}`,
            true,
          );
        }
        checkedFiles = validation.checked_files;

        const adapters = planned.preview.adapters ?? [];
        if (adapters.length === 0) {
          throw new AdoptionError(
            'PCP_ADOPTION_LIVE_INVALID',
            `State ${planned.preview.classification} apply did not retain its generated platform-adapter contract.`,
            true,
          );
        }
        const adapterValidation = await validatePlatformAdapters(root, adapters);
        if (!adapterValidation.valid) {
          throw new AdoptionError(
            'PCP_ADOPTION_LIVE_INVALID',
            `Applied platform adapters failed validation: ${adapterValidation.diagnostics
              .slice(0, 8)
              .map((item) => `${item.path}: ${item.message}`)
              .join('; ')}`,
            true,
          );
        }
        if (planned.input.persistence === 'tracked') {
          const finalInspection = await inspectRepository(root);
          if (finalInspection.state !== 'managed') {
            throw new AdoptionError(
              'PCP_ADOPTION_LIVE_INVALID',
              `Applied tracked project classified as ${finalInspection.state}, not managed.`,
              true,
            );
          }
        }
      },
    },
  );

  return {
    schema_version: ADOPTION_SCHEMA_VERSION,
    command: 'adopt',
    candidate: '.',
    classification: planned.preview.classification,
    plan_digest: planned.preview.plan.plan_digest,
    applied_operations: transaction.applied_operations,
    validation: { valid: true, checked_files: checkedFiles },
    clean_genesis: { actor_profiles: 0, active_events: 0, archived_events: 0 },
    recovery_cleaned: transaction.recovery_cleaned,
    mutated: true,
  };
}
