import { createHash, randomUUID } from 'node:crypto';
import {
  lstat,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { parse, parseDocument, stringify } from 'yaml';

import { validateCanonicalLayer } from './validate-canonical-layer.js';
import { validateCanonicalSemantics, type CanonicalRecord } from '../domain/canonical-semantics.js';
import type { CanonicalValidationReport } from '../domain/canonical-validation.js';
import type { ContinuityEvent, WorkstreamState } from '../domain/reconciliation.js';
import {
  eventPayloadDigest,
  nextEventId,
  RecordingError,
  type RecordEventInput,
  type RecordEventResult,
} from '../domain/recording.js';
import type { ActorProfile } from '../domain/registration.js';
import { ContinuityLockError, withContinuityLock } from '../infrastructure/continuity-lock.js';
import { validateSchema } from '../infrastructure/schema-validator.js';

const ACTIVE_EVENT_DIRECTORY = '.pcp/continuity/events';
const ARCHIVE_EVENT_DIRECTORY = '.pcp/continuity/archive';
const ACTOR_DIRECTORY = '.pcp/continuity/actors';
const WORKSTREAM_PATH = '.pcp/state/workstreams.yaml';
const ACTIVE_EVENT_LIMIT = 64;
const ARCHIVE_BATCH_SIZE = 32;
const MAXIMUM_EVENT_INPUT_BYTES = 64 * 1024;

interface EventFile {
  event_id: string;
  absolute_path: string;
  contents: Buffer;
  digest: string;
  event: ContinuityEvent;
}

export interface RecordEventOptions {
  fail_after_operation?: number;
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function digest(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function rootDigest(root: string): string {
  const resolved = path.resolve(root);
  return digest(process.platform === 'win32' ? resolved.toLowerCase() : resolved);
}

function validationSummary(report: CanonicalValidationReport): string {
  return report.diagnostics
    .slice(0, 4)
    .map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`)
    .join('; ');
}

async function assertValidOperationalLayer(root: string): Promise<void> {
  const report = await validateCanonicalLayer(root, { archive_content: 'filenames-only' });
  if (report.valid) return;
  const detail = validationSummary(report);
  throw new RecordingError(
    'PCP_RECORD_INVALID_LAYER',
    `Event recording requires a valid installed PCP layer${detail.length === 0 ? '.' : `: ${detail}`}`,
  );
}

function inputFailure(message: string): RecordingError {
  return new RecordingError('PCP_RECORD_INPUT_INVALID', message);
}

async function loadEventInput(inputPath: string, projectRoot: string): Promise<RecordEventInput> {
  const resolvedInput = path.resolve(inputPath);
  if (isInside(projectRoot, resolvedInput)) {
    throw new RecordingError(
      'PCP_RECORD_INPUT_INSIDE_PROJECT',
      'Store transient event input outside the managed project so it cannot become duplicate project state.',
    );
  }

  let metadata;
  try {
    metadata = await lstat(resolvedInput);
  } catch (error) {
    throw new RecordingError(
      'PCP_RECORD_INPUT_UNREADABLE',
      `Cannot read event input: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size > MAXIMUM_EVENT_INPUT_BYTES
  ) {
    throw new RecordingError(
      'PCP_RECORD_INPUT_UNSAFE',
      'Event input must be a regular non-symlink file no larger than 64 KiB.',
    );
  }
  try {
    const [physicalInput, physicalProjectRoot] = await Promise.all([
      realpath(resolvedInput),
      realpath(projectRoot),
    ]);
    if (isInside(physicalProjectRoot, physicalInput)) {
      throw new RecordingError(
        'PCP_RECORD_INPUT_INSIDE_PROJECT',
        'Store transient event input outside the managed project so it cannot become duplicate project state.',
      );
    }
  } catch (error) {
    if (error instanceof RecordingError) throw error;
    throw new RecordingError(
      'PCP_RECORD_INPUT_UNREADABLE',
      `Cannot resolve event input safely: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const contents = await readFile(resolvedInput, 'utf8').catch((error: unknown) => {
    throw new RecordingError(
      'PCP_RECORD_INPUT_UNREADABLE',
      `Cannot read event input: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  const document = parseDocument(contents, {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw inputFailure(
      `Event input is not valid YAML: ${document.errors.map((error) => error.message).join('; ')}`,
    );
  }
  let value: unknown;
  try {
    value = document.toJS({ mapAsMap: false, maxAliasCount: 50 }) as unknown;
  } catch (error) {
    throw inputFailure(
      `Event input cannot be decoded safely: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const validation = validateSchema('event-input', value);
  if (!validation.valid) {
    const detail = validation.diagnostics
      .slice(0, 8)
      .map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`)
      .join('; ');
    throw inputFailure(`Event input fails its release schema: ${detail}`);
  }
  return value as RecordEventInput;
}

async function listYamlNames(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function loadActiveEvents(root: string): Promise<EventFile[]> {
  const directory = path.join(root, ...ACTIVE_EVENT_DIRECTORY.split('/'));
  const names = await listYamlNames(directory);
  const events: EventFile[] = [];
  for (const name of names) {
    const absolutePath = path.join(directory, name);
    const contents = await readFile(absolutePath);
    events.push({
      event_id: name.slice(0, -'.yaml'.length),
      absolute_path: absolutePath,
      contents,
      digest: digest(contents),
      event: parse(contents.toString('utf8')) as ContinuityEvent,
    });
  }
  return events;
}

async function loadArchiveIds(root: string): Promise<string[]> {
  const directory = path.join(root, ...ARCHIVE_EVENT_DIRECTORY.split('/'));
  return (await listYamlNames(directory)).map((name) => name.slice(0, -'.yaml'.length));
}

async function loadSemanticRecords(root: string): Promise<{
  actors: CanonicalRecord[];
  workstreams: CanonicalRecord;
}> {
  const actorRoot = path.join(root, ...ACTOR_DIRECTORY.split('/'));
  const actorNames = await listYamlNames(actorRoot);
  const actors = await Promise.all(
    actorNames.map(async (name): Promise<CanonicalRecord> => ({
      path: `continuity/actors/${name}`,
      value: parse(await readFile(path.join(actorRoot, name), 'utf8')) as ActorProfile,
    })),
  );
  return {
    actors,
    workstreams: {
      path: 'state/workstreams.yaml',
      value: parse(await readFile(path.join(root, ...WORKSTREAM_PATH.split('/')), 'utf8')) as {
        schema_version: 1;
        workstreams: WorkstreamState[];
      },
    },
  };
}

function normalizeEventInput(input: RecordEventInput, eventId: string): ContinuityEvent {
  const payload = {
    schema_version: 1,
    event_id: eventId,
    occurred_at: input.occurred_at ?? new Date().toISOString(),
    actor: input.actor,
    recorded_by: input.recorded_by,
    basis: input.basis,
    ...(input.change_key === undefined ? {} : { change_key: input.change_key.trim() }),
    kind: input.kind,
    scopes: [...input.scopes].sort((left, right) => left.localeCompare(right)),
    workstreams: [...input.workstreams].sort((left, right) => left.localeCompare(right)),
    summary: input.summary.trim(),
    ...(input.rationale === undefined ? {} : { rationale: input.rationale.trim() }),
    affected_paths: [...input.affected_paths].sort((left, right) => left.localeCompare(right)),
  } satisfies Omit<ContinuityEvent, 'payload_digest'>;
  return { ...payload, payload_digest: eventPayloadDigest(payload) };
}

function assertEventSemantics(
  event: ContinuityEvent,
  records: Awaited<ReturnType<typeof loadSemanticRecords>>,
): void {
  const diagnostics = validateCanonicalSemantics({
    workstreams: records.workstreams,
    actors: records.actors,
    events: [{ path: `continuity/events/${event.event_id}.yaml`, value: event }],
    checkpoints: [],
  });
  if (diagnostics.length === 0) return;
  const detail = diagnostics
    .slice(0, 6)
    .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
    .join('; ');
  throw new RecordingError(
    'PCP_RECORD_ATTRIBUTION_INVALID',
    `Event attribution or workstream references are invalid: ${detail}`,
  );
}

async function appendWal(
  walPath: string,
  sequence: number,
  action: 'archive' | 'record',
  eventId: string,
  status: 'prepared' | 'applied' | 'rolled-back',
): Promise<void> {
  const handle = await open(walPath, 'a');
  try {
    await handle.writeFile(`${JSON.stringify({ sequence, action, event_id: eventId, status })}\n`);
    await handle.sync();
  } finally {
    await handle.close();
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

function injectedFailure(sequence: number, options: RecordEventOptions): void {
  if (options.fail_after_operation === sequence) {
    throw new RecordingError(
      'PCP_FAULT_INJECTED',
      `Injected event-recording failure after operation ${sequence}.`,
      true,
    );
  }
}

async function verifyRollback(
  root: string,
  expectedActive: readonly EventFile[],
  expectedArchiveIds: readonly string[],
): Promise<string[]> {
  const failures: string[] = [];
  try {
    const active = await loadActiveEvents(root);
    const actual = active.map((event) => `${event.event_id}:${event.digest}`);
    const expected = expectedActive.map((event) => `${event.event_id}:${event.digest}`);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push('active event identities or contents differ from the preimage');
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
  try {
    const archiveIds = await loadArchiveIds(root);
    if (JSON.stringify(archiveIds) !== JSON.stringify(expectedArchiveIds)) {
      failures.push('archive event identities differ from the preimage');
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
  return failures;
}

async function executeEventTransaction(
  root: string,
  event: ContinuityEvent,
  activeEvents: readonly EventFile[],
  archiveIds: readonly string[],
  options: RecordEventOptions,
): Promise<RecordEventResult> {
  const rotation =
    activeEvents.length === ACTIVE_EVENT_LIMIT ? activeEvents.slice(0, ARCHIVE_BATCH_SIZE) : [];
  const archiveIdSet = new Set(archiveIds);
  const archiveCollision = rotation.find((event) => archiveIdSet.has(event.event_id));
  if (archiveCollision !== undefined) {
    throw new RecordingError(
      'PCP_RECORD_ARCHIVE_COLLISION',
      `Cannot rotate ${archiveCollision.event_id} because that identity already exists in the archive.`,
    );
  }

  const eventRoot = path.join(root, ...ACTIVE_EVENT_DIRECTORY.split('/'));
  const archiveRoot = path.join(root, ...ARCHIVE_EVENT_DIRECTORY.split('/'));
  const eventPath = path.join(eventRoot, `${event.event_id}.yaml`);
  const temporaryEventPath = path.join(eventRoot, `.${event.event_id}.${randomUUID()}.tmp`);
  const moved: EventFile[] = [];
  let eventInstalled = false;
  let operation = 0;
  let recoveryRoot: string | undefined;
  let walPath: string | undefined;

  try {
    recoveryRoot = await mkdtemp(
      path.join(tmpdir(), `pcp-event-transaction-${rootDigest(root).slice(0, 12)}-`),
    );
    walPath = path.join(recoveryRoot, 'operations.jsonl');
    await writeFile(walPath, '', { flag: 'wx' });
    await writeDurableFile(temporaryEventPath, stringify(event));

    for (const source of rotation) {
      operation += 1;
      await appendWal(walPath, operation, 'archive', source.event_id, 'prepared');
      await rename(source.absolute_path, path.join(archiveRoot, `${source.event_id}.yaml`));
      moved.push(source);
      await appendWal(walPath, operation, 'archive', source.event_id, 'applied');
      injectedFailure(operation, options);
    }

    operation += 1;
    await appendWal(walPath, operation, 'record', event.event_id, 'prepared');
    await rename(temporaryEventPath, eventPath);
    eventInstalled = true;
    await appendWal(walPath, operation, 'record', event.event_id, 'applied');
    injectedFailure(operation, options);

    const live = await validateCanonicalLayer(root, { archive_content: 'filenames-only' });
    if (!live.valid) {
      throw new RecordingError(
        'PCP_RECORD_LIVE_INVALID',
        `Recorded continuity state is invalid: ${validationSummary(live)}`,
        true,
      );
    }
    operation += 1;
    injectedFailure(operation, options);

    await rm(recoveryRoot, { recursive: true, force: false });
    return {
      schema_version: 1,
      command: 'record',
      status: 'recorded',
      event_id: event.event_id,
      event_path: `${ACTIVE_EVENT_DIRECTORY}/${event.event_id}.yaml`,
      payload_digest: event.payload_digest,
      occurred_at: event.occurred_at,
      summary: event.summary,
      active_events: activeEvents.length - rotation.length + 1,
      archived_events_moved: rotation.length,
      event_created: true,
      mutated: true,
    };
  } catch (error) {
    const rollbackFailures: string[] = [];
    if (eventInstalled) {
      try {
        await unlink(eventPath);
        if (walPath !== undefined) {
          await appendWal(
            walPath,
            rotation.length + 1,
            'record',
            event.event_id,
            'rolled-back',
          ).catch(() => undefined);
        }
      } catch (rollbackError) {
        if ((rollbackError as NodeJS.ErrnoException).code !== 'ENOENT') {
          rollbackFailures.push(
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          );
        }
      }
    }
    await unlink(temporaryEventPath).catch((rollbackError: unknown) => {
      if ((rollbackError as NodeJS.ErrnoException).code !== 'ENOENT') {
        rollbackFailures.push(
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        );
      }
    });
    for (const source of [...moved].reverse()) {
      try {
        await rename(path.join(archiveRoot, `${source.event_id}.yaml`), source.absolute_path);
        if (walPath !== undefined) {
          await appendWal(
            walPath,
            rotation.indexOf(source) + 1,
            'archive',
            source.event_id,
            'rolled-back',
          ).catch(() => undefined);
        }
      } catch (rollbackError) {
        rollbackFailures.push(
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        );
      }
    }
    rollbackFailures.push(...(await verifyRollback(root, activeEvents, archiveIds)));

    if (rollbackFailures.length > 0) {
      throw new RecordingError(
        'PCP_RECORD_ROLLBACK_FAILED',
        `Event recording failed (${error instanceof Error ? error.message : String(error)}) and exact rollback could not be verified: ${rollbackFailures.join('; ')}`,
        true,
        recoveryRoot === undefined ? [] : [recoveryRoot],
      );
    }
    if (recoveryRoot !== undefined) {
      try {
        await rm(recoveryRoot, { recursive: true, force: true });
      } catch (cleanupError) {
        throw new RecordingError(
          'PCP_RECORD_RECOVERY_CLEANUP_FAILED',
          `Event recording failed and project state was restored, but recovery data could not be removed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
          false,
          [recoveryRoot],
        );
      }
    }
    if (error instanceof RecordingError) {
      throw new RecordingError(error.code, error.message, false, error.recovery_paths);
    }
    throw new RecordingError(
      'PCP_RECORD_TRANSACTION_FAILED',
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function recordEventUnderLock(
  root: string,
  input: RecordEventInput,
  options: RecordEventOptions,
): Promise<RecordEventResult> {
  await assertValidOperationalLayer(root);
  const [activeEvents, archiveIds, semanticRecords] = await Promise.all([
    loadActiveEvents(root),
    loadArchiveIds(root),
    loadSemanticRecords(root),
  ]);
  if (activeEvents.length > ACTIVE_EVENT_LIMIT) {
    throw new RecordingError(
      'PCP_RECORD_ACTIVE_LIMIT_EXCEEDED',
      `Active continuity history already exceeds ${ACTIVE_EVENT_LIMIT}; repair it before recording.`,
    );
  }
  if (input.change_key !== undefined) {
    const normalizedKey = input.change_key.trim();
    const duplicate = activeEvents.find((item) => item.event.change_key === normalizedKey);
    if (duplicate !== undefined) {
      throw new RecordingError(
        'PCP_RECORD_DUPLICATE_CHANGE',
        `Active event ${duplicate.event_id} already records change key ${normalizedKey}.`,
      );
    }
  }

  const event = normalizeEventInput(
    input,
    nextEventId([...activeEvents.map((item) => item.event_id), ...archiveIds]),
  );
  const schema = validateSchema('event', event);
  if (!schema.valid) {
    throw new RecordingError(
      'PCP_RECORD_EVENT_INVALID',
      'The normalized event failed its canonical release schema.',
    );
  }
  assertEventSemantics(event, semanticRecords);
  return executeEventTransaction(root, event, activeEvents, archiveIds, options);
}

export async function recordEvent(
  projectRoot: string,
  inputPath: string,
  options: RecordEventOptions = {},
): Promise<RecordEventResult> {
  const root = path.resolve(projectRoot);
  try {
    const input = await loadEventInput(inputPath, root);
    return await withContinuityLock(root, () => recordEventUnderLock(root, input, options));
  } catch (error) {
    if (error instanceof ContinuityLockError) {
      throw new RecordingError(
        'PCP_RECORD_LOCKED',
        'Another actor registration or continuity operation is still running for this project.',
      );
    }
    if (error instanceof RecordingError) throw error;
    throw new RecordingError(
      'PCP_RECORD_FAILED',
      error instanceof Error ? error.message : String(error),
    );
  }
}
