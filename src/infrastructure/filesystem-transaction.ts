import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rename,
  rm,
  rmdir,
  statfs,
  unlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  AdoptionError,
  sha256,
  type MutationOperation,
  type MutationPlan,
} from '../domain/adoption.js';
import { inventoryRepository } from './filesystem-inventory.js';

interface FilePreimage {
  backupPath: string;
  mode: number;
  atime: Date;
  mtime: Date;
}

interface AppliedOperation {
  operation: MutationOperation;
  preimage?: FilePreimage;
}

export interface TransactionOptions {
  fail_after_operation?: number;
  verify_source_stability?: () => Promise<void>;
  validate_live: () => Promise<void>;
}

export interface TransactionResult {
  applied_operations: number;
  recovery_cleaned: true;
}

function rootHash(root: string): string {
  const resolved = path.resolve(root);
  return createHash('sha256')
    .update(process.platform === 'win32' ? resolved.toLowerCase() : resolved)
    .digest('hex');
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function resolveApprovedPath(root: string, portablePath: string): string {
  const normalized = path.posix.normalize(portablePath);
  if (
    portablePath === '.' ||
    normalized !== portablePath ||
    portablePath.startsWith('/') ||
    portablePath.includes('\\')
  ) {
    throw new AdoptionError('PCP_ADOPTION_PATH_UNSAFE', `Unsafe transaction path: ${portablePath}`);
  }
  const resolved = path.resolve(root, ...portablePath.split('/'));
  if (!isInside(root, resolved) || resolved === path.resolve(root)) {
    throw new AdoptionError(
      'PCP_ADOPTION_PATH_UNSAFE',
      `Path escapes the candidate: ${portablePath}`,
    );
  }
  return resolved;
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

async function assertNoSymlinkAncestor(root: string, target: string): Promise<void> {
  let current = path.dirname(target);
  while (current !== root) {
    const metadata = await metadataOrUndefined(current);
    if (metadata?.isSymbolicLink() === true) {
      throw new AdoptionError(
        'PCP_ADOPTION_PATH_BOUNDARY',
        `A transaction target acquired a symbolic-link ancestor: ${path.relative(root, target)}`,
      );
    }
    current = path.dirname(current);
  }
}

async function appendWal(
  walPath: string,
  sequence: number,
  operation: MutationOperation,
  status: 'prepared' | 'applied' | 'rolled-back',
  preimage?: FilePreimage,
): Promise<void> {
  const record = {
    sequence,
    operation_id: operation.operation_id,
    action: operation.action,
    path: operation.path,
    source_path: operation.source_path,
    status,
    preimage: preimage === undefined ? undefined : `preimages/${operation.operation_id}`,
  };
  const handle = await open(walPath, 'a');
  try {
    await handle.writeFile(`${JSON.stringify(record)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncFile(target: string): Promise<void> {
  const handle = await open(target, 'r+');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function captureFilePreimage(
  target: string,
  operation: MutationOperation,
  preimageRoot: string,
): Promise<FilePreimage> {
  const metadata = await lstat(target);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new AdoptionError(
      'PCP_ADOPTION_PREIMAGE_UNSUPPORTED',
      `This release can mutate only regular-file preimages: ${operation.path}`,
    );
  }
  const bytes = await readFile(target);
  if (operation.preimage_digest !== sha256(bytes)) {
    throw new AdoptionError(
      'PCP_SOURCE_CHANGED',
      `Preimage digest changed before transaction: ${operation.path}`,
    );
  }
  const backupPath = path.join(preimageRoot, operation.operation_id);
  await copyFile(target, backupPath, constants.COPYFILE_EXCL);
  await syncFile(backupPath);
  return {
    backupPath,
    mode: metadata.mode,
    atime: metadata.atime,
    mtime: metadata.mtime,
  };
}

async function restoreFilePreimage(target: string, preimage: FilePreimage): Promise<void> {
  const existing = await metadataOrUndefined(target);
  if (existing !== undefined) {
    if (!existing.isFile() || existing.isSymbolicLink()) {
      throw new Error(`Rollback target changed type: ${target}`);
    }
    await unlink(target);
  }
  await copyFile(preimage.backupPath, target, constants.COPYFILE_EXCL);
  await chmod(target, preimage.mode);
  await utimes(target, preimage.atime, preimage.mtime);
}

async function durableTemporaryFile(
  target: string,
  stagedPath: string,
  operation: MutationOperation,
): Promise<string> {
  const temporaryPath = path.join(
    path.dirname(target),
    `.${path.basename(target)}.pcp-${operation.operation_id}.tmp`,
  );
  const handle = await open(temporaryPath, 'wx');
  try {
    await handle.writeFile(await readFile(stagedPath));
    await handle.sync();
    return temporaryPath;
  } catch (error) {
    await handle.close();
    await unlink(temporaryPath).catch((cleanupError: unknown) => {
      if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT') throw cleanupError;
    });
    throw error;
  } finally {
    if ((await metadataOrUndefined(temporaryPath)) !== undefined) {
      await handle.close().catch(() => undefined);
    }
  }
}

async function atomicWrite(
  target: string,
  stagedPath: string,
  operation: MutationOperation,
  replaceExisting: boolean,
): Promise<void> {
  const temporaryPath = await durableTemporaryFile(target, stagedPath, operation);
  try {
    if (!replaceExisting && (await metadataOrUndefined(target)) !== undefined) {
      throw new AdoptionError(
        'PCP_SOURCE_CHANGED',
        `A planned write target appeared before apply: ${operation.path}`,
      );
    }
    try {
      await rename(temporaryPath, target);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!replaceExisting || (code !== 'EEXIST' && code !== 'EPERM')) throw error;

      const heldPath = `${temporaryPath}.previous`;
      await rename(target, heldPath);
      try {
        await rename(temporaryPath, target);
        await unlink(heldPath);
      } catch (replacementError) {
        if ((await metadataOrUndefined(target)) !== undefined) await unlink(target);
        await rename(heldPath, target);
        throw replacementError;
      }
    }
  } finally {
    if ((await metadataOrUndefined(temporaryPath)) !== undefined) await unlink(temporaryPath);
  }
}

async function stageContent(
  plan: MutationPlan,
  contentByPath: ReadonlyMap<string, Buffer>,
  stagingRoot: string,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const contentOperations = plan.operations.filter(
    (operation) => operation.action === 'write' || operation.action === 'replace',
  );
  if (contentOperations.length !== contentByPath.size) {
    throw new AdoptionError(
      'PCP_ADOPTION_PLAN_CONTENT_MISMATCH',
      'The approved plan and staged content do not cover the same paths.',
    );
  }
  for (const operation of contentOperations) {
    const content = contentByPath.get(operation.path);
    if (content === undefined || operation.content_digest !== sha256(content)) {
      throw new AdoptionError(
        'PCP_ADOPTION_PLAN_CONTENT_MISMATCH',
        `Staged content does not match the approved digest: ${operation.path}`,
      );
    }
    const target = path.join(stagingRoot, operation.operation_id);
    await writeFile(target, content, { flag: 'wx' });
    result.set(operation.operation_id, target);
  }
  return result;
}

async function checkSpace(
  root: string,
  plan: MutationPlan,
  content: ReadonlyMap<string, Buffer>,
): Promise<void> {
  const required =
    [...content.values()].reduce((total, bytes) => total + bytes.length, 0) * 3 +
    plan.operations.length * 4096;
  const filesystem = await statfs(root);
  const available = Number(filesystem.bavail) * Number(filesystem.bsize);
  if (Number.isFinite(available) && available < required) {
    throw new AdoptionError(
      'PCP_ADOPTION_SPACE_INSUFFICIENT',
      `The candidate filesystem does not have the ${required} bytes required for staged apply and recovery.`,
    );
  }
}

async function applyOperation(
  root: string,
  operation: MutationOperation,
  stagedContent: ReadonlyMap<string, string>,
  preimageRoot: string,
): Promise<AppliedOperation> {
  const target = resolveApprovedPath(root, operation.path);
  await assertNoSymlinkAncestor(root, target);
  let preimage: FilePreimage | undefined;

  if (operation.action === 'replace' || operation.action === 'remove') {
    preimage = await captureFilePreimage(target, operation, preimageRoot);
  } else if (operation.action === 'move') {
    if (operation.source_path === undefined)
      throw new Error('Move operation is missing source_path.');
    preimage = await captureFilePreimage(
      resolveApprovedPath(root, operation.source_path),
      operation,
      preimageRoot,
    );
  }

  switch (operation.action) {
    case 'mkdir':
      await mkdir(target);
      break;
    case 'write': {
      const stagedPath = stagedContent.get(operation.operation_id);
      if (stagedPath === undefined) throw new Error(`Missing staged content: ${operation.path}`);
      await atomicWrite(target, stagedPath, operation, false);
      break;
    }
    case 'replace': {
      const stagedPath = stagedContent.get(operation.operation_id);
      if (stagedPath === undefined) throw new Error(`Missing staged content: ${operation.path}`);
      await atomicWrite(target, stagedPath, operation, true);
      break;
    }
    case 'remove':
      await unlink(target);
      break;
    case 'move': {
      if (operation.source_path === undefined)
        throw new Error('Move operation is missing source_path.');
      const source = resolveApprovedPath(root, operation.source_path);
      await assertNoSymlinkAncestor(root, source);
      const sourceMetadata = await lstat(source);
      if (!sourceMetadata.isFile() || sourceMetadata.isSymbolicLink()) {
        throw new AdoptionError(
          'PCP_ADOPTION_PREIMAGE_UNSUPPORTED',
          `This release can move only regular files: ${operation.source_path}`,
        );
      }
      if (operation.preimage_digest !== sha256(await readFile(source))) {
        throw new AdoptionError(
          'PCP_SOURCE_CHANGED',
          `Move source changed before transaction: ${operation.source_path}`,
        );
      }
      if ((await metadataOrUndefined(target)) !== undefined) {
        throw new AdoptionError(
          'PCP_ADOPTION_PATH_COLLISION',
          `A move target already exists: ${operation.path}`,
        );
      }
      await rename(source, target);
      break;
    }
  }

  return preimage === undefined ? { operation } : { operation, preimage };
}

async function rollbackOperation(root: string, applied: AppliedOperation): Promise<void> {
  const { operation, preimage } = applied;
  const target = resolveApprovedPath(root, operation.path);
  switch (operation.action) {
    case 'mkdir':
      await rmdir(target);
      break;
    case 'write':
      await unlink(target);
      break;
    case 'replace':
    case 'remove':
      if (preimage === undefined) throw new Error(`Missing rollback preimage: ${operation.path}`);
      await restoreFilePreimage(target, preimage);
      break;
    case 'move': {
      if (operation.source_path === undefined)
        throw new Error('Move operation is missing source_path.');
      const source = resolveApprovedPath(root, operation.source_path);
      if ((await metadataOrUndefined(target)) !== undefined) {
        await rename(target, source);
      } else if ((await metadataOrUndefined(source)) === undefined && preimage !== undefined) {
        await restoreFilePreimage(source, preimage);
      }
      break;
    }
  }
}

async function verifyDesiredContent(root: string, plan: MutationPlan): Promise<void> {
  for (const operation of plan.operations) {
    const target = resolveApprovedPath(root, operation.path);
    if (operation.action === 'write' || operation.action === 'replace') {
      const bytes = await readFile(target);
      if (operation.content_digest !== sha256(bytes)) {
        throw new AdoptionError(
          'PCP_ADOPTION_LIVE_MISMATCH',
          `Applied content differs from the approved plan: ${operation.path}`,
          true,
        );
      }
    } else if (operation.action === 'remove' && (await metadataOrUndefined(target)) !== undefined) {
      throw new AdoptionError(
        'PCP_ADOPTION_LIVE_MISMATCH',
        `A removed target still exists: ${operation.path}`,
        true,
      );
    } else if (operation.action === 'move') {
      const source =
        operation.source_path === undefined
          ? undefined
          : resolveApprovedPath(root, operation.source_path);
      if (
        source === undefined ||
        (await metadataOrUndefined(source)) !== undefined ||
        (await metadataOrUndefined(target)) === undefined
      ) {
        throw new AdoptionError(
          'PCP_ADOPTION_LIVE_MISMATCH',
          `A move does not match the approved source and target state: ${operation.path}`,
          true,
        );
      }
    }
  }
}

async function acquireLock(root: string): Promise<{ path: string; close: () => Promise<void> }> {
  const lockRoot = path.join(tmpdir(), 'pcp-project-locks');
  await mkdir(lockRoot, { recursive: true });
  const lockPath = path.join(lockRoot, `${rootHash(root)}.lock`);
  let handle;
  try {
    handle = await open(lockPath, 'wx');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new AdoptionError(
        'PCP_ADOPTION_LOCKED',
        'Another PCP structural transaction already holds the project lock.',
      );
    }
    throw error;
  }
  await handle.writeFile(
    `${JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() })}\n`,
  );
  await handle.sync();
  return {
    path: lockPath,
    close: async () => {
      await handle.close();
      await unlink(lockPath).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      });
    },
  };
}

export async function executeFilesystemTransaction(
  root: string,
  plan: MutationPlan,
  contentByPath: ReadonlyMap<string, Buffer>,
  options: TransactionOptions,
): Promise<TransactionResult> {
  const resolvedRoot = path.resolve(root);
  const lock = await acquireLock(resolvedRoot);
  let recoveryRoot: string | undefined;
  const applied: AppliedOperation[] = [];
  let mutationStarted = false;

  try {
    const currentInventory = await inventoryRepository(resolvedRoot);
    if (currentInventory.digest !== plan.candidate_inventory_digest) {
      throw new AdoptionError(
        'PCP_SOURCE_CHANGED',
        'Candidate inventory changed after the approved adoption preview.',
      );
    }
    await checkSpace(resolvedRoot, plan, contentByPath);

    recoveryRoot = await mkdtemp(
      path.join(tmpdir(), `pcp-transaction-${rootHash(root).slice(0, 12)}-`),
    );
    const stagingRoot = path.join(recoveryRoot, 'staging');
    const preimageRoot = path.join(recoveryRoot, 'preimages');
    const walPath = path.join(recoveryRoot, 'operations.jsonl');
    await mkdir(stagingRoot);
    await mkdir(preimageRoot);
    await writeFile(walPath, '', { flag: 'wx' });
    const stagedContent = await stageContent(plan, contentByPath, stagingRoot);

    for (const [index, operation] of plan.operations.entries()) {
      const sequence = index + 1;
      await appendWal(walPath, sequence, operation, 'prepared');
      mutationStarted = true;
      const completed = await applyOperation(resolvedRoot, operation, stagedContent, preimageRoot);
      applied.push(completed);
      await appendWal(walPath, sequence, operation, 'applied', completed.preimage);
      if (options.fail_after_operation === sequence) {
        throw new AdoptionError(
          'PCP_FAULT_INJECTED',
          `Injected failure after operation ${sequence}.`,
          true,
        );
      }
    }

    if (options.fail_after_operation === plan.operations.length + 1) {
      throw new AdoptionError(
        'PCP_FAULT_INJECTED',
        'Injected failure at the post-apply validation boundary.',
        true,
      );
    }

    await verifyDesiredContent(resolvedRoot, plan);
    await options.verify_source_stability?.();
    await options.validate_live();
    await options.verify_source_stability?.();
    await rm(recoveryRoot, { recursive: true, force: false });
    recoveryRoot = undefined;
    return { applied_operations: applied.length, recovery_cleaned: true };
  } catch (error) {
    if (mutationStarted) {
      const rollbackErrors: string[] = [];
      for (const [reverseIndex, completed] of [...applied].reverse().entries()) {
        try {
          await rollbackOperation(resolvedRoot, completed);
          if (recoveryRoot !== undefined) {
            const walPath = path.join(recoveryRoot, 'operations.jsonl');
            await appendWal(
              walPath,
              applied.length - reverseIndex,
              completed.operation,
              'rolled-back',
              completed.preimage,
            );
          }
        } catch (rollbackError) {
          rollbackErrors.push(
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          );
        }
      }
      const restored = await inventoryRepository(resolvedRoot);
      if (restored.digest !== plan.candidate_inventory_digest) {
        const remaining = [
          ...restored.directories.filter((item) => item !== '.'),
          ...restored.files.map((item) => item.path),
          ...restored.symlinks.map((item) => item.path),
        ];
        rollbackErrors.push(
          `The restored candidate inventory digest does not match the preimage; remaining paths: ${remaining.join(', ') || 'none'}.`,
        );
      }
      if (rollbackErrors.length > 0) {
        const originalMessage = error instanceof Error ? error.message : String(error);
        throw new AdoptionError(
          'PCP_ROLLBACK_VERIFICATION_FAILED',
          `Adoption failed (${originalMessage}) and exact rollback could not be verified: ${rollbackErrors.join('; ')}`,
          true,
          recoveryRoot,
        );
      }
    } else if (recoveryRoot !== undefined) {
      await rm(recoveryRoot, { recursive: true, force: true });
      recoveryRoot = undefined;
    }

    const original =
      error instanceof AdoptionError
        ? error
        : new AdoptionError(
            'PCP_ADOPTION_TRANSACTION_FAILED',
            error instanceof Error ? error.message : String(error),
          );
    throw new AdoptionError(original.code, original.message, false, recoveryRoot);
  } finally {
    await lock.close();
  }
}
