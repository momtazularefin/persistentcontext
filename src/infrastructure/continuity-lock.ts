import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const LOCK_WAIT_MS = 30_000;
const STALE_LOCK_MS = 5 * 60_000;

export class ContinuityLockError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ContinuityLockError';
  }
}

function lockDigest(root: string): string {
  const resolved = path.resolve(root);
  const portableRoot = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  return createHash('sha256').update(portableRoot).digest('hex');
}

async function removeStaleLock(lockPath: string): Promise<boolean> {
  try {
    const metadata = await stat(lockPath);
    if (Date.now() - metadata.mtimeMs <= STALE_LOCK_MS) return false;
    const contents = await readFile(lockPath, 'utf8');
    let ownerPid: number | undefined;
    try {
      const value = JSON.parse(contents) as unknown;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const pid = (value as Record<string, unknown>).pid;
        if (typeof pid === 'number' && Number.isSafeInteger(pid) && pid > 0) ownerPid = pid;
      }
    } catch {
      // An old malformed lock can be removed after the stale threshold.
    }
    if (ownerPid !== undefined) {
      try {
        process.kill(ownerPid, 0);
        return false;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return false;
      }
    }
    await unlink(lockPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw error;
  }
}

export async function withContinuityLock<T>(
  projectRoot: string,
  operation: () => Promise<T>,
): Promise<T> {
  const lockRoot = path.join(tmpdir(), 'pcp-continuity-locks');
  await mkdir(lockRoot, { recursive: true });
  const lockPath = path.join(lockRoot, `${lockDigest(projectRoot)}.lock`);
  const token = randomUUID();
  const lockContents = `${JSON.stringify({ token, pid: process.pid, created_at: new Date().toISOString() })}\n`;
  const deadline = Date.now() + LOCK_WAIT_MS;
  let handle;

  while (handle === undefined) {
    try {
      handle = await open(lockPath, 'wx');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (await removeStaleLock(lockPath)) continue;
      if (Date.now() >= deadline) {
        throw new ContinuityLockError('Another continuity operation is still running.');
      }
      await delay(20);
    }
  }

  try {
    await handle.writeFile(lockContents);
    await handle.sync();
    return await operation();
  } finally {
    await handle.close();
    const current = await readFile(lockPath, 'utf8').catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    });
    if (current === lockContents) {
      await unlink(lockPath).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      });
    }
  }
}
