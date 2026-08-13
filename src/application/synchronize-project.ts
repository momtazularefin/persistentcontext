import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';

import { parse, stringify } from 'yaml';

import type { ActorProfile } from '../domain/registration.js';
import type { ContinuityEvent } from '../domain/reconciliation.js';
import { eventPayloadDigest } from '../domain/recording.js';
import {
  SynchronizationError,
  synchronizationDigest,
  type SyncChange,
  type SyncCheckpointState,
  type SyncInput,
  type SyncResult,
  type SynchronizationCheckpoint,
} from '../domain/synchronization.js';
import { ContinuityLockError, withContinuityLock } from '../infrastructure/continuity-lock.js';
import { validateSchema } from '../infrastructure/schema-validator.js';

const ACTIVE_EVENT_DIRECTORY = 'continuity/events';
const ARCHIVE_EVENT_DIRECTORY = 'continuity/archive';
const ACTOR_DIRECTORY = 'continuity/actors';
const CHECKPOINT_DIRECTORY = 'continuity/checkpoints';
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/u;
const ACTOR_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9A-HJKMNP-TV-Z]{10}$/u;
const BASELINE_CONTEXT_PATHS = ['.pcp/00-index.md'];

interface LoadedCheckpoint {
  path: string;
  value: SynchronizationCheckpoint;
  contents: string;
}

interface SyncPreview {
  result: SyncResult;
  checkpoint?: LoadedCheckpoint;
  target_last_event_id: string | null;
}

function layerPath(relativePath: string): string {
  return `.pcp/${relativePath}`;
}

function syncError(code: string, message: string): SynchronizationError {
  return new SynchronizationError(code, message);
}

async function readRegularFile(layerRoot: string, relativePath: string): Promise<string> {
  const target = path.join(layerRoot, ...relativePath.split('/'));
  let metadata;
  try {
    metadata = await lstat(target);
  } catch (error) {
    throw syncError(
      'PCP_SYNC_INVALID_LAYER',
      `Cannot read ${layerPath(relativePath)}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw syncError('PCP_SYNC_INVALID_LAYER', `${layerPath(relativePath)} must be a regular file.`);
  }
  return readFile(target, 'utf8');
}

function parseYaml<T>(
  contents: string,
  relativePath: string,
  schema: 'actor-profile' | 'checkpoint' | 'event',
): T {
  let value: unknown;
  try {
    value = parse(contents) as unknown;
  } catch {
    throw syncError('PCP_SYNC_INVALID_LAYER', `${layerPath(relativePath)} is not valid YAML.`);
  }
  const result = validateSchema(schema, value);
  if (!result.valid) {
    throw syncError(
      'PCP_SYNC_INVALID_LAYER',
      `${layerPath(relativePath)} does not satisfy the installed ${schema} schema.`,
    );
  }
  return value as T;
}

async function loadActor(layerRoot: string, actorId: string): Promise<ActorProfile> {
  if (!ACTOR_ID_PATTERN.test(actorId)) {
    throw syncError('PCP_SYNC_ACTOR_ID_INVALID', 'Actor ID has an invalid format.');
  }
  const relativePath = `${ACTOR_DIRECTORY}/${actorId}.yaml`;
  let contents: string;
  try {
    contents = await readRegularFile(layerRoot, relativePath);
  } catch (error) {
    if (error instanceof SynchronizationError && error.code === 'PCP_SYNC_INVALID_LAYER') {
      throw syncError(
        'PCP_SYNC_ACTOR_NOT_FOUND',
        `Actor ${actorId} is not registered in this project.`,
      );
    }
    throw error;
  }
  const actor = parseYaml<ActorProfile>(contents, relativePath, 'actor-profile');
  if (actor.actor_id !== actorId || actor.actor_type !== 'agent') {
    throw syncError(
      'PCP_SYNC_AGENT_REQUIRED',
      'Synchronization requires a registered agent actor.',
    );
  }
  return actor;
}

function checkpointRelativePath(executionId: string): string {
  return `${CHECKPOINT_DIRECTORY}/${executionId}.yaml`;
}

async function loadCheckpoint(
  layerRoot: string,
  actorId: string,
  executionId: string,
): Promise<LoadedCheckpoint | undefined> {
  if (!ULID_PATTERN.test(executionId)) {
    throw syncError('PCP_SYNC_EXECUTION_ID_INVALID', 'Execution ID must be a 26-character ULID.');
  }
  const relativePath = checkpointRelativePath(executionId);
  const target = path.join(layerRoot, ...relativePath.split('/'));
  let metadata;
  try {
    metadata = await lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw syncError(
      'PCP_SYNC_INVALID_LAYER',
      `Cannot inspect ${layerPath(relativePath)}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw syncError('PCP_SYNC_INVALID_LAYER', `${layerPath(relativePath)} must be a regular file.`);
  }
  const contents = await readFile(target, 'utf8');
  const checkpoint = parseYaml<SynchronizationCheckpoint>(contents, relativePath, 'checkpoint');
  if (
    checkpoint.checkpoint_id !== executionId ||
    checkpoint.execution_id !== executionId ||
    checkpoint.actor_id !== actorId
  ) {
    throw syncError(
      'PCP_SYNC_CHECKPOINT_IDENTITY_MISMATCH',
      'The execution checkpoint belongs to a different actor or execution.',
    );
  }
  return { path: relativePath, value: checkpoint, contents };
}

async function listActiveEventIds(layerRoot: string): Promise<string[]> {
  const relativePath = ACTIVE_EVENT_DIRECTORY;
  const target = path.join(layerRoot, ...relativePath.split('/'));
  let entries;
  try {
    const metadata = await lstat(target);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error('path is not a regular directory');
    }
    entries = await readdir(target, { withFileTypes: true });
  } catch (error) {
    throw syncError(
      'PCP_SYNC_INVALID_LAYER',
      `Cannot inspect ${layerPath(relativePath)}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const ids: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isSymbolicLink()) {
      throw syncError(
        'PCP_SYNC_INVALID_LAYER',
        `Symlinks are not allowed in ${layerPath(relativePath)}.`,
      );
    }
    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.yml')) {
      throw syncError(
        'PCP_SYNC_INVALID_LAYER',
        `${layerPath(`${relativePath}/${entry.name}`)} must use .yaml.`,
      );
    }
    if (!entry.name.endsWith('.yaml')) continue;
    const eventId = entry.name.slice(0, -'.yaml'.length);
    if (!ULID_PATTERN.test(eventId)) {
      throw syncError(
        'PCP_SYNC_INVALID_LAYER',
        `Active event filename must be a ULID: ${entry.name}.`,
      );
    }
    ids.push(eventId);
  }
  return ids;
}

async function archiveHasEvents(layerRoot: string): Promise<boolean> {
  const target = path.join(layerRoot, ...ARCHIVE_EVENT_DIRECTORY.split('/'));
  let entries;
  try {
    const metadata = await lstat(target);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error('path is not a regular directory');
    }
    entries = await readdir(target, { withFileTypes: true });
  } catch (error) {
    throw syncError(
      'PCP_SYNC_INVALID_LAYER',
      `Cannot inspect ${layerPath(ARCHIVE_EVENT_DIRECTORY)}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      throw syncError(
        'PCP_SYNC_INVALID_LAYER',
        `Symlinks are not allowed in ${layerPath(ARCHIVE_EVENT_DIRECTORY)}.`,
      );
    }
    if (!entry.isFile() || !entry.name.endsWith('.yaml')) continue;
    const eventId = entry.name.slice(0, -'.yaml'.length);
    if (!ULID_PATTERN.test(eventId)) {
      throw syncError(
        'PCP_SYNC_INVALID_LAYER',
        `Archived event filename must be a ULID: ${entry.name}.`,
      );
    }
    return true;
  }
  return false;
}

function eventPayload(event: ContinuityEvent): Omit<ContinuityEvent, 'payload_digest'> {
  const payload = { ...event };
  delete (payload as Partial<ContinuityEvent>).payload_digest;
  return payload;
}

async function loadChanges(layerRoot: string, eventIds: readonly string[]): Promise<SyncChange[]> {
  return Promise.all(
    eventIds.map(async (eventId) => {
      const relativePath = `${ACTIVE_EVENT_DIRECTORY}/${eventId}.yaml`;
      const contents = await readRegularFile(layerRoot, relativePath);
      const event = parseYaml<ContinuityEvent>(contents, relativePath, 'event');
      if (
        event.event_id !== eventId ||
        eventPayloadDigest(eventPayload(event)) !== event.payload_digest
      ) {
        throw syncError(
          'PCP_SYNC_EVENT_INTEGRITY_FAILED',
          `Event ${eventId} does not match its filename or payload digest.`,
        );
      }
      return {
        event_id: event.event_id,
        occurred_at: event.occurred_at,
        actor: event.actor,
        recorded_by: event.recorded_by,
        basis: event.basis,
        kind: event.kind,
        summary: event.summary,
        ...(event.rationale === undefined ? {} : { rationale: event.rationale }),
        scopes: [...event.scopes].sort(),
        workstreams: [...event.workstreams].sort(),
        affected_paths: [...event.affected_paths].sort(),
      } satisfies SyncChange;
    }),
  );
}

function checkpointState(
  checkpoint: LoadedCheckpoint | undefined,
  activeFloor: string | null,
  newestActive: string | null,
  hasArchivedEvents: boolean,
): SyncCheckpointState {
  if (checkpoint === undefined) return 'missing';
  const last = checkpoint.value.last_event_id;
  if (
    activeFloor !== null &&
    ((last === null && hasArchivedEvents) || (last !== null && last < activeFloor))
  ) {
    return 'behind-active-floor';
  }
  return last === newestActive ? 'current' : 'changes-pending';
}

function uniquePaths(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

async function previewSync(layerRoot: string, input: SyncInput): Promise<SyncPreview> {
  await loadActor(layerRoot, input.actor_id);
  const [checkpoint, eventIds] = await Promise.all([
    loadCheckpoint(layerRoot, input.actor_id, input.execution_id),
    listActiveEventIds(layerRoot),
  ]);
  const activeFloor = eventIds[0] ?? null;
  const newestActive = eventIds.at(-1) ?? null;
  const hasArchivedEvents =
    checkpoint !== undefined && activeFloor !== null && checkpoint.value.last_event_id === null
      ? await archiveHasEvents(layerRoot)
      : false;
  const state = checkpointState(checkpoint, activeFloor, newestActive, hasArchivedEvents);
  const baselineRequired = state === 'missing' || state === 'behind-active-floor';
  const baselineReason =
    state === 'missing'
      ? 'first-execution-baseline'
      : state === 'behind-active-floor'
        ? 'checkpoint-before-active-floor'
        : null;
  const checkpointLast = checkpoint?.value.last_event_id ?? null;
  const newerIds = baselineRequired
    ? eventIds
    : eventIds.filter((eventId) => checkpointLast === null || eventId > checkpointLast);
  const changes = await loadChanges(layerRoot, newerIds);
  const baselinePaths = baselineRequired ? BASELINE_CONTEXT_PATHS : [];
  const requiredContextPaths = uniquePaths([
    ...baselinePaths,
    ...changes.flatMap((change) => change.affected_paths),
  ]);
  const acknowledgementRequired = baselineRequired || changes.length > 0;
  const digestPayload = {
    schema_version: 1,
    actor_id: input.actor_id,
    execution_id: input.execution_id,
    checkpoint:
      checkpoint === undefined
        ? null
        : {
            last_event_id: checkpoint.value.last_event_id,
            reconciled_at: checkpoint.value.reconciled_at,
          },
    checkpoint_state: state,
    active_floor_event_id: activeFloor,
    newest_active_event_id: newestActive,
    baseline: {
      required: baselineRequired,
      reason: baselineReason,
      context_paths: baselinePaths,
    },
    changes,
  };
  return {
    result: {
      schema_version: 1,
      command: 'sync',
      mode: 'preview',
      actor_id: input.actor_id,
      execution_id: input.execution_id,
      checkpoint: {
        state,
        previous_state: null,
        checkpoint_id: input.execution_id,
        checkpoint_path: layerPath(checkpointRelativePath(input.execution_id)),
        last_event_id: checkpoint?.value.last_event_id ?? null,
        active_floor_event_id: activeFloor,
        newest_active_event_id: newestActive,
      },
      baseline: {
        required: baselineRequired,
        reason: baselineReason,
        context_paths: baselinePaths,
      },
      changes,
      required_context_paths: requiredContextPaths,
      sync_digest: synchronizationDigest(digestPayload),
      acknowledgement: { required: acknowledgementRequired, accepted: false },
      event_created: false,
      mutated: false,
    },
    ...(checkpoint === undefined ? {} : { checkpoint }),
    target_last_event_id: newestActive,
  };
}

async function fileContentsOrUndefined(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function writeDurableFile(file: string, contents: string): Promise<void> {
  const handle = await open(file, 'wx');
  try {
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeCheckpoint(
  layerRoot: string,
  checkpoint: SynchronizationCheckpoint,
  existing: LoadedCheckpoint | undefined,
): Promise<void> {
  const validation = validateSchema('checkpoint', checkpoint);
  if (!validation.valid) {
    throw syncError('PCP_SYNC_CHECKPOINT_INVALID', 'Generated sync checkpoint is invalid.');
  }
  const relativePath = checkpointRelativePath(checkpoint.execution_id);
  const directory = path.join(layerRoot, ...CHECKPOINT_DIRECTORY.split('/'));
  const target = path.join(layerRoot, ...relativePath.split('/'));
  await mkdir(directory, { recursive: true });
  const current = await fileContentsOrUndefined(target);
  if (existing === undefined ? current !== undefined : current !== existing.contents) {
    throw syncError(
      'PCP_SYNC_SOURCE_CHANGED',
      'Execution checkpoint changed before acknowledgement.',
    );
  }

  const contents = stringify(checkpoint);
  const temporary = path.join(directory, `.${checkpoint.execution_id}.${randomUUID()}.tmp`);
  const previous = `${temporary}.previous`;
  await writeDurableFile(temporary, contents);
  let previousHeld = false;
  let replacementInstalled = false;
  try {
    if (existing === undefined) {
      await rename(temporary, target);
      return;
    }
    try {
      await rename(temporary, target);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST' && code !== 'EPERM') throw error;
    }
    await rename(target, previous);
    previousHeld = true;
    await rename(temporary, target);
    replacementInstalled = true;
    await unlink(previous);
    previousHeld = false;
  } catch (error) {
    const rollbackFailures: unknown[] = [];
    if (replacementInstalled) {
      await unlink(target).catch((rollbackError: unknown) => rollbackFailures.push(rollbackError));
    }
    if (previousHeld) {
      await rename(previous, target).catch((rollbackError: unknown) =>
        rollbackFailures.push(rollbackError),
      );
    }
    if (rollbackFailures.length > 0) {
      throw new SynchronizationError(
        'PCP_SYNC_ROLLBACK_FAILED',
        `Sync acknowledgement failed (${error instanceof Error ? error.message : String(error)}) and rollback failed.`,
        true,
      );
    }
    throw error;
  } finally {
    await unlink(temporary).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    });
  }
}

async function synchronizeLocked(root: string, input: SyncInput): Promise<SyncResult> {
  const layerRoot = path.join(root, '.pcp');
  const preview = await previewSync(layerRoot, input);
  if (input.acknowledge === undefined) return preview.result;
  if (input.acknowledge !== preview.result.sync_digest) {
    throw syncError(
      'PCP_SYNC_DIGEST_MISMATCH',
      'Synchronization changed or the acknowledgement digest is incorrect; review a fresh sync result.',
    );
  }
  if (!preview.result.acknowledgement.required) {
    return {
      ...preview.result,
      mode: 'acknowledge',
      checkpoint: {
        ...preview.result.checkpoint,
        previous_state: preview.result.checkpoint.state,
      },
      acknowledgement: { required: false, accepted: true },
    };
  }
  const checkpoint: SynchronizationCheckpoint = {
    schema_version: 1,
    checkpoint_id: input.execution_id,
    actor_id: input.actor_id,
    execution_id: input.execution_id,
    last_event_id: preview.target_last_event_id,
    reconciled_at: new Date().toISOString(),
  };
  await writeCheckpoint(layerRoot, checkpoint, preview.checkpoint);
  return {
    ...preview.result,
    mode: 'acknowledge',
    checkpoint: {
      ...preview.result.checkpoint,
      state: 'current',
      previous_state: preview.result.checkpoint.state,
      last_event_id: checkpoint.last_event_id,
    },
    acknowledgement: { required: true, accepted: true },
    mutated: true,
  };
}

export async function synchronizeProject(
  projectRoot: string,
  input: SyncInput,
): Promise<SyncResult> {
  const root = path.resolve(projectRoot);
  try {
    return await withContinuityLock(root, () => synchronizeLocked(root, input));
  } catch (error) {
    if (error instanceof ContinuityLockError) {
      throw syncError(
        'PCP_SYNC_LOCKED',
        'Another continuity operation is running for this project.',
      );
    }
    if (error instanceof SynchronizationError) throw error;
    throw syncError('PCP_SYNC_FAILED', error instanceof Error ? error.message : String(error));
  }
}
