import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  AdoptionError,
  createMutationPlan,
  sha256,
  type MutationPlan,
} from '../../src/domain/adoption.js';
import { executeFilesystemTransaction } from '../../src/infrastructure/filesystem-transaction.js';
import { inventoryRepository } from '../../src/infrastructure/filesystem-inventory.js';

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'pcp-filesystem-transaction-'));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function transactionFixture(): Promise<{
  root: string;
  plan: MutationPlan;
  content: ReadonlyMap<string, Buffer>;
  inventoryDigest: string;
}> {
  const root = await temporaryRoot();
  const replaceBefore = Buffer.from('replace-before\n');
  const removeBefore = Buffer.from('remove-before\n');
  const moveBefore = Buffer.from('move-before\n');
  await writeFile(path.join(root, 'replace.txt'), replaceBefore);
  await writeFile(path.join(root, 'remove.txt'), removeBefore);
  await writeFile(path.join(root, 'move.txt'), moveBefore);
  await mkdir(path.join(root, 'obsolete'));
  const inventory = await inventoryRepository(root);
  const content = new Map<string, Buffer>([
    ['new/new.txt', Buffer.from('created\n')],
    ['replace.txt', Buffer.from('replace-after\n')],
  ]);
  const plan = createMutationPlan({
    classification: 'B',
    inventory,
    operations: [
      { action: 'mkdir', path: 'new' },
      { action: 'write', path: 'new/new.txt', content_digest: sha256(content.get('new/new.txt')!) },
      {
        action: 'replace',
        path: 'replace.txt',
        content_digest: sha256(content.get('replace.txt')!),
        preimage_digest: sha256(replaceBefore),
      },
      { action: 'remove', path: 'remove.txt', preimage_digest: sha256(removeBefore) },
      {
        action: 'move',
        path: 'moved.txt',
        source_path: 'move.txt',
        preimage_digest: sha256(moveBefore),
      },
      { action: 'rmdir', path: 'obsolete' },
    ],
    validations: ['exact-preimages', 'rollback'],
  });
  return { root, plan, content, inventoryDigest: inventory.digest };
}

describe('write-ahead filesystem transaction', () => {
  it('restores every mutation action and retains auditable recovery material after failure', async () => {
    const fixture = await transactionFixture();

    for (
      let failurePoint = 1;
      failurePoint <= fixture.plan.operations.length + 1;
      failurePoint += 1
    ) {
      let caught: unknown;
      try {
        await executeFilesystemTransaction(fixture.root, fixture.plan, fixture.content, {
          fail_after_operation: failurePoint,
          validate_live: () => Promise.resolve(),
        });
      } catch (error) {
        caught = error;
      }
      expect(caught, `failure point ${failurePoint}`).toMatchObject({
        code: 'PCP_FAULT_INJECTED',
        mutated: false,
      });
      const recoveryRoot = (caught as AdoptionError).recoveryRoot;
      expect(recoveryRoot).toBeTypeOf('string');
      if (recoveryRoot !== undefined) {
        const wal = await readFile(path.join(recoveryRoot, 'operations.jsonl'), 'utf8');
        expect(wal).toContain('"status":"prepared"');
        expect(wal).toContain('"status":"rolled-back"');
        if (failurePoint >= 3) {
          expect(
            await readFile(
              path.join(recoveryRoot, 'preimages', fixture.plan.operations[2]!.operation_id),
              'utf8',
            ),
          ).toBe('replace-before\n');
        }
        await rm(recoveryRoot, { recursive: true, force: true });
      }

      expect((await inventoryRepository(fixture.root)).digest).toBe(fixture.inventoryDigest);
      expect(await readFile(path.join(fixture.root, 'replace.txt'), 'utf8')).toBe(
        'replace-before\n',
      );
      expect(await readFile(path.join(fixture.root, 'remove.txt'), 'utf8')).toBe('remove-before\n');
      expect(await readFile(path.join(fixture.root, 'move.txt'), 'utf8')).toBe('move-before\n');
      expect(await readdir(path.join(fixture.root, 'obsolete'))).toEqual([]);
    }
  });

  it('applies file and directory mutations then removes recovery state', async () => {
    const fixture = await transactionFixture();
    const result = await executeFilesystemTransaction(fixture.root, fixture.plan, fixture.content, {
      validate_live: async () => {
        expect(await readFile(path.join(fixture.root, 'new', 'new.txt'), 'utf8')).toBe('created\n');
        expect(await readFile(path.join(fixture.root, 'replace.txt'), 'utf8')).toBe(
          'replace-after\n',
        );
      },
    });

    expect(result).toEqual({ applied_operations: 6, recovery_cleaned: true });
    await expect(readFile(path.join(fixture.root, 'remove.txt'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(readFile(path.join(fixture.root, 'move.txt'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await readFile(path.join(fixture.root, 'moved.txt'), 'utf8')).toBe('move-before\n');
    await expect(readdir(path.join(fixture.root, 'obsolete'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rolls back when live validation changes an applied file after its first hash check', async () => {
    const fixture = await transactionFixture();
    let caught: unknown;

    try {
      await executeFilesystemTransaction(fixture.root, fixture.plan, fixture.content, {
        validate_live: async () => {
          await writeFile(path.join(fixture.root, 'replace.txt'), 'changed-during-validation\n');
        },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AdoptionError);
    expect(caught).toMatchObject({ code: 'PCP_ADOPTION_LIVE_MISMATCH', mutated: false });
    const recoveryRoot = (caught as AdoptionError).recoveryRoot;
    expect(recoveryRoot).toBeTypeOf('string');
    if (recoveryRoot !== undefined) {
      await rm(recoveryRoot, { recursive: true, force: true });
    }
    expect((await inventoryRepository(fixture.root)).digest).toBe(fixture.inventoryDigest);
    expect(await readFile(path.join(fixture.root, 'replace.txt'), 'utf8')).toBe('replace-before\n');
    expect(await readFile(path.join(fixture.root, 'remove.txt'), 'utf8')).toBe('remove-before\n');
    expect(await readFile(path.join(fixture.root, 'move.txt'), 'utf8')).toBe('move-before\n');
    expect(await readdir(path.join(fixture.root, 'obsolete'))).toEqual([]);
  });

  it('restores the move preimage when live validation changes the relocation target', async () => {
    const fixture = await transactionFixture();
    let caught: unknown;

    try {
      await executeFilesystemTransaction(fixture.root, fixture.plan, fixture.content, {
        validate_live: async () => {
          await writeFile(path.join(fixture.root, 'moved.txt'), 'changed-during-validation\n');
        },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ code: 'PCP_ADOPTION_LIVE_MISMATCH', mutated: false });
    const recoveryRoot = (caught as AdoptionError).recoveryRoot;
    expect(recoveryRoot).toBeTypeOf('string');
    if (recoveryRoot !== undefined) {
      await rm(recoveryRoot, { recursive: true, force: true });
    }
    expect((await inventoryRepository(fixture.root)).digest).toBe(fixture.inventoryDigest);
    expect(await readFile(path.join(fixture.root, 'move.txt'), 'utf8')).toBe('move-before\n');
    await expect(readFile(path.join(fixture.root, 'moved.txt'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
