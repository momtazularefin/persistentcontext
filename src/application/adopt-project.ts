import { timingSafeEqual } from 'node:crypto';

import {
  ADOPTION_SCHEMA_VERSION,
  AdoptionError,
  canonicalJson,
  type AdoptionApplyResult,
  type MutationPlan,
  type AdoptionPreview,
} from '../domain/adoption.js';
import type { RepositoryInventory } from '../domain/inspection.js';
import {
  inventoryRepository,
  resolveCandidateRoot,
} from '../infrastructure/filesystem-inventory.js';
import { executeFilesystemTransaction } from '../infrastructure/filesystem-transaction.js';
import { isPlanMaterial, planAdoption } from './plan-adoption.js';
import { validateCanonicalLayer } from './validate-canonical-layer.js';

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
): Promise<void> {
  if (
    plan.operations.some(
      (operation) => operation.action !== 'mkdir' && operation.action !== 'write',
    )
  ) {
    throw new AdoptionError(
      'PCP_ADOPTION_PLAN_UNSAFE',
      'State A/B adoption may contain only new-directory and new-file operations.',
      true,
    );
  }
  const createdDirectories = new Set(
    plan.operations
      .filter((operation) => operation.action === 'mkdir')
      .map((operation) => operation.path),
  );
  const createdFiles = new Set(
    plan.operations
      .filter((operation) => operation.action === 'write')
      .map((operation) => operation.path),
  );
  const current = await inventoryRepository(root);
  const withoutAdoption: RepositoryInventory = {
    ...current,
    directories: current.directories.filter((item) => !createdDirectories.has(item)),
    files: current.files.filter((item) => !createdFiles.has(item.path)),
  };
  if (
    canonicalJson(comparableInventory(withoutAdoption)) !==
    canonicalJson(comparableInventory(original))
  ) {
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
        `The ${planned.classification} candidate is not ready for an applicable State A/B plan.`,
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
        verifyAdoptionSourceStability(root, planned.inspection.inventory, planned.preview.plan),
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
