import { createHash, randomBytes } from 'node:crypto';
import {
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  readlink,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { inspectRepository } from '../../src/application/inspect-repository.js';
import type { InspectionError } from '../../src/domain/inspection.js';

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'pcp-inventory-'));
  temporaryRoots.push(root);
  return root;
}

async function rawTreeDigest(root: string): Promise<string> {
  const records: string[] = [];

  async function visit(directory: string, relativeDirectory: string): Promise<void> {
    const entries = await readdir(directory);
    entries.sort();
    for (const name of entries) {
      const absolute = path.join(directory, name);
      const relative = relativeDirectory === '' ? name : `${relativeDirectory}/${name}`;
      const metadata = await lstat(absolute);
      if (metadata.isSymbolicLink()) {
        records.push(JSON.stringify(['symlink', relative, await readlink(absolute)]));
      } else if (metadata.isDirectory()) {
        records.push(JSON.stringify(['directory', relative]));
        await visit(absolute, relative);
      } else {
        const digest = createHash('sha256')
          .update(await readFile(absolute))
          .digest('hex');
        records.push(JSON.stringify(['file', relative, digest]));
      }
    }
  }

  await visit(root, '');
  return createHash('sha256').update(records.join('\n')).digest('hex');
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('repository inventory safety', () => {
  it('honors gitignore, generated paths, and nested repository boundaries', async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, 'src'), { recursive: true });
    await mkdir(path.join(root, 'ignored-dir'), { recursive: true });
    await mkdir(path.join(root, 'node_modules', 'sample'), { recursive: true });
    await mkdir(path.join(root, 'nested-repository', '.git'), { recursive: true });
    await writeFile(path.join(root, '.gitignore'), 'ignored.txt\nignored-dir/\n', 'utf8');
    await writeFile(path.join(root, 'src', '.gitignore'), 'generated.ts\n', 'utf8');
    await writeFile(path.join(root, 'ignored.txt'), 'ignored', 'utf8');
    await writeFile(path.join(root, 'ignored-dir', 'hidden.ts'), 'ignored', 'utf8');
    await writeFile(path.join(root, 'node_modules', 'sample', 'index.js'), 'ignored', 'utf8');
    await writeFile(path.join(root, 'nested-repository', 'main.go'), 'ignored', 'utf8');
    await writeFile(path.join(root, 'src', 'index.ts'), 'export const ready = true;\n', 'utf8');
    await writeFile(path.join(root, 'src', 'generated.ts'), 'ignored', 'utf8');

    const result = await inspectRepository(root);
    expect(result.inventory.files.map((file) => file.path)).toEqual([
      '.gitignore',
      'src/.gitignore',
      'src/index.ts',
    ]);
    expect(result.inventory.nestedRepositories).toEqual(['nested-repository']);
    expect(result.inventory.exclusions).toEqual(
      expect.arrayContaining([
        { path: 'ignored-dir', reason: 'gitignore' },
        { path: 'ignored.txt', reason: 'gitignore' },
        { path: 'nested-repository', reason: 'nested-repository' },
        { path: 'node_modules', reason: 'generated-or-vendor' },
        { path: 'src/generated.ts', reason: 'gitignore' },
      ]),
    );
  });

  it('fingerprints but never follows an external directory junction or symlink', async () => {
    const root = await temporaryRoot();
    const external = await temporaryRoot();
    await writeFile(path.join(external, 'outside.txt'), 'outside boundary', 'utf8');
    await symlink(
      external,
      path.join(root, 'external-link'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    const result = await inspectRepository(root);
    expect(result.inventory.files).toEqual([]);
    expect(result.inventory.symlinks).toContainEqual(
      expect.objectContaining({
        path: 'external-link',
        target: '<absolute>',
        boundary: 'external',
      }),
    );
    expect(result.ambiguities).toContainEqual(
      expect.objectContaining({ code: 'unsafe-symlink-boundary', paths: ['external-link'] }),
    );
  });

  it('does not mutate any candidate entry during inspection', async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, 'docs'), { recursive: true });
    await writeFile(path.join(root, 'README.md'), '# Stable\n', 'utf8');
    await writeFile(path.join(root, 'docs', 'note.md'), 'Keep this exact content.\n', 'utf8');
    const before = await rawTreeDigest(root);

    const result = await inspectRepository(root);
    const after = await rawTreeDigest(root);

    expect(result.mutated).toBe(false);
    expect(after).toBe(before);
  });

  it('includes empty directories in the inventory digest', async () => {
    const root = await temporaryRoot();
    const before = await inspectRepository(root);
    await mkdir(path.join(root, 'empty-directory'));
    const after = await inspectRepository(root);

    expect(before.inventory.directories).toEqual(['.']);
    expect(after.inventory.directories).toEqual(['.', 'empty-directory']);
    expect(after.inventory.digest).not.toBe(before.inventory.digest);
  });

  it('streams a large binary fingerprint without semantic classification', async () => {
    const root = await temporaryRoot();
    const contents = randomBytes(1_100_000);
    await writeFile(path.join(root, 'archive.bin'), contents);

    const result = await inspectRepository(root);
    expect(result.inventory.files[0]).toMatchObject({
      path: 'archive.bin',
      size: contents.length,
      sha256: createHash('sha256').update(contents).digest('hex'),
    });
    expect(result.state).toBe('B');
  });

  it('rejects a file as a candidate root with a structured error', async () => {
    const root = await temporaryRoot();
    const file = path.join(root, 'not-a-directory.txt');
    await writeFile(file, 'content', 'utf8');

    await expect(inspectRepository(file)).rejects.toEqual(
      expect.objectContaining<Partial<InspectionError>>({ code: 'PCP_CANDIDATE_NOT_DIRECTORY' }),
    );
  });
});
