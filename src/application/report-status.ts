import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';

import { ulid } from 'ulid';
import { parseDocument, stringify } from 'yaml';

import { validateCanonicalSemantics, type CanonicalRecord } from '../domain/canonical-semantics.js';
import {
  baselineContextPaths,
  checkpointIdentity,
  classifyEventRelevance,
  reconciliationDigest,
  ReconciliationError,
  resolveReconciliationSelection,
  type ContinuityEvent,
  type ReconciliationCheckpoint,
  type ReconciliationSelection,
  type RelevanceReason,
  type WorkstreamState,
} from '../domain/reconciliation.js';
import type { ActorProfile } from '../domain/registration.js';
import type { SchemaName } from '../domain/schema-catalog.js';
import { ContinuityLockError, withContinuityLock } from '../infrastructure/continuity-lock.js';
import { validateSchema } from '../infrastructure/schema-validator.js';

const ACTOR_DIRECTORY = 'continuity/actors';
const ACTIVE_EVENT_DIRECTORY = 'continuity/events';
const ARCHIVE_EVENT_DIRECTORY = 'continuity/archive';
const CHECKPOINT_DIRECTORY = 'continuity/checkpoints';
const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/u;

interface PcpManifest {
  schema_version: 1;
  continuity: {
    active_event_limit: number;
  };
}

interface WorkstreamRegistry {
  schema_version: 1;
  workstreams: WorkstreamState[];
}

interface LoadedYaml<T> extends CanonicalRecord {
  value: T;
  contents: string;
}

interface OperationalContinuityState {
  manifest: PcpManifest;
  actors: Array<LoadedYaml<ActorProfile>>;
  workstreams: WorkstreamState[];
  active_events: Array<LoadedYaml<ContinuityEvent>>;
  archive_event_ids: string[];
  checkpoints: Array<LoadedYaml<ReconciliationCheckpoint>>;
}

export interface StatusInput {
  actor_id: string;
  workstream_id?: string;
  scopes?: readonly string[];
  paths?: readonly string[];
  acknowledge?: string;
}

export interface StatusChange {
  event_id: string;
  occurred_at: string;
  kind: ContinuityEvent['kind'];
  summary: string;
  scopes: string[];
  workstreams: string[];
  affected_paths: string[];
  relevance_reasons: RelevanceReason[];
}

export type CheckpointState = 'missing' | 'behind-active-floor' | 'changes-pending' | 'current';

export interface StatusResult {
  schema_version: 1;
  command: 'status';
  mode: 'preview' | 'acknowledge';
  actor_id: string;
  selection: ReconciliationSelection;
  checkpoint: {
    state: CheckpointState;
    previous_state: CheckpointState | null;
    checkpoint_id: string | null;
    checkpoint_path: string | null;
    last_event_id: string | null;
    active_floor_event_id: string | null;
    newest_active_event_id: string | null;
  };
  baseline: {
    required: boolean;
    reason: 'first-scope-baseline' | 'checkpoint-before-active-floor' | null;
    context_paths: string[];
  };
  relevant_changes: StatusChange[];
  out_of_scope_changes: StatusChange[];
  required_context_paths: string[];
  status_digest: string;
  acknowledgement: {
    required: boolean;
    accepted: boolean;
  };
  event_created: false;
  mutated: boolean;
}

interface StatusPreview {
  result: StatusResult;
  checkpoint?: LoadedYaml<ReconciliationCheckpoint>;
  target_last_event_id: string | null;
}

function statusError(code: string, message: string): ReconciliationError {
  return new ReconciliationError(code, message);
}

function layerPath(relativePath: string): string {
  return `.pcp/${relativePath}`;
}

async function assertNoSymlinkFromLayer(layerRoot: string, target: string): Promise<void> {
  let current = target;
  while (true) {
    const metadata = await lstat(current);
    if (metadata.isSymbolicLink()) throw new Error('path has a symbolic-link boundary');
    if (current === layerRoot) return;
    current = path.dirname(current);
  }
}

function parseYaml(contents: string, relativePath: string): unknown {
  const document = parseDocument(contents, { prettyErrors: false, uniqueKeys: true });
  if (document.errors.length > 0) {
    throw statusError(
      'PCP_STATUS_INVALID_LAYER',
      `${layerPath(relativePath)} is not valid YAML: ${document.errors[0]?.message ?? 'parse failure'}`,
    );
  }
  try {
    return document.toJS({ maxAliasCount: 50 }) as unknown;
  } catch (error) {
    throw statusError(
      'PCP_STATUS_INVALID_LAYER',
      `${layerPath(relativePath)} cannot be decoded safely: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function readSchemaFile<T>(
  layerRoot: string,
  relativePath: string,
  schema: SchemaName,
): Promise<LoadedYaml<T>> {
  const absolutePath = path.join(layerRoot, ...relativePath.split('/'));
  let contents: string;
  try {
    await assertNoSymlinkFromLayer(layerRoot, absolutePath);
    const metadata = await lstat(absolutePath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error('path is not a regular file');
    }
    contents = await readFile(absolutePath, 'utf8');
  } catch (error) {
    throw statusError(
      'PCP_STATUS_INVALID_LAYER',
      `Cannot read required PCP state ${layerPath(relativePath)}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const value = parseYaml(contents, relativePath);
  const result = validateSchema(schema, value);
  if (!result.valid) {
    const detail = result.diagnostics
      .slice(0, 3)
      .map((diagnostic) => `${diagnostic.path} ${diagnostic.message}`)
      .join('; ');
    throw statusError(
      'PCP_STATUS_INVALID_LAYER',
      `${layerPath(relativePath)} fails the ${schema} schema: ${detail}`,
    );
  }
  return { path: relativePath, value: value as T, contents };
}

async function readSchemaDirectory<T>(
  layerRoot: string,
  relativeDirectory: string,
  schema: SchemaName,
): Promise<Array<LoadedYaml<T>>> {
  const absoluteDirectory = path.join(layerRoot, ...relativeDirectory.split('/'));
  let entries;
  try {
    await assertNoSymlinkFromLayer(layerRoot, absoluteDirectory);
    const metadata = await lstat(absoluteDirectory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error('path is not a regular directory');
    }
    entries = await readdir(absoluteDirectory, { withFileTypes: true });
  } catch (error) {
    throw statusError(
      'PCP_STATUS_INVALID_LAYER',
      `Cannot read required PCP directory ${layerPath(relativeDirectory)}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const records: Array<LoadedYaml<T>> = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isSymbolicLink()) {
      throw statusError(
        'PCP_STATUS_INVALID_LAYER',
        `Symlinks are not allowed in ${layerPath(relativeDirectory)}.`,
      );
    }
    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.yml')) {
      throw statusError(
        'PCP_STATUS_INVALID_LAYER',
        `${layerPath(`${relativeDirectory}/${entry.name}`)} must use the canonical .yaml suffix.`,
      );
    }
    if (!entry.name.endsWith('.yaml')) continue;
    records.push(await readSchemaFile<T>(layerRoot, `${relativeDirectory}/${entry.name}`, schema));
  }
  return records;
}

async function listArchiveEventIds(layerRoot: string): Promise<string[]> {
  const absoluteDirectory = path.join(layerRoot, ...ARCHIVE_EVENT_DIRECTORY.split('/'));
  let entries;
  try {
    await assertNoSymlinkFromLayer(layerRoot, absoluteDirectory);
    const metadata = await lstat(absoluteDirectory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error('path is not a regular directory');
    }
    entries = await readdir(absoluteDirectory, { withFileTypes: true });
  } catch (error) {
    throw statusError(
      'PCP_STATUS_INVALID_LAYER',
      `Cannot inspect ${layerPath(ARCHIVE_EVENT_DIRECTORY)}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const ids: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isSymbolicLink()) {
      throw statusError(
        'PCP_STATUS_INVALID_LAYER',
        `Symlinks are not allowed in ${layerPath(ARCHIVE_EVENT_DIRECTORY)}.`,
      );
    }
    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.yml')) {
      throw statusError(
        'PCP_STATUS_INVALID_LAYER',
        `${layerPath(`${ARCHIVE_EVENT_DIRECTORY}/${entry.name}`)} must use the canonical .yaml suffix.`,
      );
    }
    if (!entry.name.endsWith('.yaml')) continue;
    const eventId = entry.name.slice(0, -'.yaml'.length);
    if (!ULID_PATTERN.test(eventId)) {
      throw statusError(
        'PCP_STATUS_INVALID_LAYER',
        `Archived event filename must be a ULID: ${layerPath(`${ARCHIVE_EVENT_DIRECTORY}/${entry.name}`)}.`,
      );
    }
    ids.push(eventId);
  }
  return ids;
}

function semanticFailure(records: {
  project: CanonicalRecord;
  project_registry: CanonicalRecord;
  workstreams: CanonicalRecord;
  vcs_policy: CanonicalRecord;
  actors: CanonicalRecord[];
  events: CanonicalRecord[];
  checkpoints: CanonicalRecord[];
}): void {
  const diagnostics = validateCanonicalSemantics(records);
  if (diagnostics.length === 0) return;
  if (diagnostics.some((diagnostic) => diagnostic.code === 'checkpoint.duplicate-scope')) {
    throw statusError(
      'PCP_STATUS_CHECKPOINT_AMBIGUOUS',
      'Multiple checkpoints claim the same actor and scoped reconciliation identity.',
    );
  }
  const detail = diagnostics
    .slice(0, 3)
    .map((diagnostic) => `${layerPath(diagnostic.path)}: ${diagnostic.message}`)
    .join('; ');
  throw statusError('PCP_STATUS_INVALID_LAYER', `PCP continuity state is inconsistent: ${detail}`);
}

async function loadOperationalContinuityState(root: string): Promise<OperationalContinuityState> {
  const layerRoot = path.join(root, '.pcp');
  const [
    manifest,
    project,
    projectRegistry,
    workstreamRegistry,
    vcsPolicy,
    actors,
    activeEvents,
    checkpoints,
    archiveEventIds,
  ] = await Promise.all([
    readSchemaFile<PcpManifest>(layerRoot, 'pcp.yaml', 'pcp-manifest'),
    readSchemaFile<unknown>(layerRoot, 'state/project.yaml', 'project'),
    readSchemaFile<unknown>(layerRoot, 'state/projects.yaml', 'project-registry'),
    readSchemaFile<WorkstreamRegistry>(layerRoot, 'state/workstreams.yaml', 'workstreams'),
    readSchemaFile<unknown>(layerRoot, 'state/vcs-policy.yaml', 'vcs-policy'),
    readSchemaDirectory<ActorProfile>(layerRoot, ACTOR_DIRECTORY, 'actor-profile'),
    readSchemaDirectory<ContinuityEvent>(layerRoot, ACTIVE_EVENT_DIRECTORY, 'event'),
    readSchemaDirectory<ReconciliationCheckpoint>(layerRoot, CHECKPOINT_DIRECTORY, 'checkpoint'),
    listArchiveEventIds(layerRoot),
  ]);

  const archiveStubs: CanonicalRecord[] = archiveEventIds.map((eventId) => ({
    path: `${ARCHIVE_EVENT_DIRECTORY}/${eventId}.yaml`,
    value: { event_id: eventId },
  }));
  semanticFailure({
    project,
    project_registry: projectRegistry,
    workstreams: workstreamRegistry,
    vcs_policy: vcsPolicy,
    actors,
    events: [...activeEvents, ...archiveStubs],
    checkpoints,
  });
  if (activeEvents.length > manifest.value.continuity.active_event_limit) {
    throw statusError(
      'PCP_STATUS_INVALID_LAYER',
      `Active event count ${activeEvents.length} exceeds the configured limit ${manifest.value.continuity.active_event_limit}.`,
    );
  }

  return {
    manifest: manifest.value,
    actors,
    workstreams: workstreamRegistry.value.workstreams,
    active_events: activeEvents.sort((left, right) =>
      left.value.event_id.localeCompare(right.value.event_id),
    ),
    archive_event_ids: archiveEventIds.sort((left, right) => left.localeCompare(right)),
    checkpoints,
  };
}

function change(event: ContinuityEvent, relevanceReasons: RelevanceReason[]): StatusChange {
  return {
    event_id: event.event_id,
    occurred_at: event.occurred_at,
    kind: event.kind,
    summary: event.summary,
    scopes: [...event.scopes].sort(),
    workstreams: [...event.workstreams].sort(),
    affected_paths: [...event.affected_paths].sort(),
    relevance_reasons: relevanceReasons,
  };
}

function uniquePaths(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function findCheckpoint(
  state: OperationalContinuityState,
  actorId: string,
  selection: ReconciliationSelection,
): LoadedYaml<ReconciliationCheckpoint> | undefined {
  const identity = checkpointIdentity({
    actor_id: actorId,
    workstream_id: selection.workstream_id,
    scopes: selection.scopes,
    paths: selection.paths,
    dependencies: selection.dependencies,
  });
  const matches = state.checkpoints.filter(
    (checkpoint) => checkpointIdentity(checkpoint.value) === identity,
  );
  if (matches.length > 1) {
    throw statusError(
      'PCP_STATUS_CHECKPOINT_AMBIGUOUS',
      'Multiple checkpoints claim the same actor and scoped reconciliation identity.',
    );
  }
  return matches[0];
}

function initialCheckpointState(
  checkpoint: LoadedYaml<ReconciliationCheckpoint> | undefined,
  activeFloor: string | null,
  hasArchivedEvents: boolean,
  newerEventCount: number,
): CheckpointState {
  if (checkpoint === undefined) return 'missing';
  if (
    activeFloor !== null &&
    ((checkpoint.value.last_event_id === null && hasArchivedEvents) ||
      (checkpoint.value.last_event_id !== null && checkpoint.value.last_event_id < activeFloor))
  ) {
    return 'behind-active-floor';
  }
  return newerEventCount > 0 ? 'changes-pending' : 'current';
}

function previewStatus(state: OperationalContinuityState, input: StatusInput): StatusPreview {
  const actorMatches = state.actors.filter((record) => record.value.actor_id === input.actor_id);
  if (actorMatches.length === 0) {
    throw statusError(
      'PCP_STATUS_ACTOR_NOT_FOUND',
      `Actor ${input.actor_id || '<empty>'} is not registered in this project.`,
    );
  }
  const actor = actorMatches[0] as LoadedYaml<ActorProfile>;
  if (actor.value.actor_type !== 'agent') {
    throw statusError(
      'PCP_STATUS_AGENT_REQUIRED',
      'Scoped checkpoints are available to agents only.',
    );
  }

  const selection = resolveReconciliationSelection(state.workstreams, {
    ...(input.workstream_id === undefined ? {} : { workstream_id: input.workstream_id }),
    ...(input.scopes === undefined ? {} : { scopes: input.scopes }),
    ...(input.paths === undefined ? {} : { paths: input.paths }),
  });
  const checkpoint = findCheckpoint(state, input.actor_id, selection);
  const activeFloor = state.active_events[0]?.value.event_id ?? null;
  const newestActive = state.active_events.at(-1)?.value.event_id ?? null;
  const checkpointLast = checkpoint?.value.last_event_id ?? null;
  const beforeFloor =
    checkpoint !== undefined &&
    activeFloor !== null &&
    ((checkpointLast === null && state.archive_event_ids.length > 0) ||
      (checkpointLast !== null && checkpointLast < activeFloor));
  const newerEvents = state.active_events
    .map((record) => record.value)
    .filter(
      (event) =>
        checkpoint === undefined ||
        beforeFloor ||
        checkpointLast === null ||
        event.event_id > checkpointLast,
    );
  const checkpointState = initialCheckpointState(
    checkpoint,
    activeFloor,
    state.archive_event_ids.length > 0,
    newerEvents.length,
  );
  const baselineRequired =
    checkpointState === 'missing' || checkpointState === 'behind-active-floor';
  const baselineReason =
    checkpointState === 'missing'
      ? 'first-scope-baseline'
      : checkpointState === 'behind-active-floor'
        ? 'checkpoint-before-active-floor'
        : null;
  const relevantChanges: StatusChange[] = [];
  const outOfScopeChanges: StatusChange[] = [];

  for (const event of newerEvents) {
    const classification = classifyEventRelevance(event, selection);
    const item = change(event, classification.reasons);
    (classification.relevant ? relevantChanges : outOfScopeChanges).push(item);
  }

  const baselinePaths = baselineRequired ? baselineContextPaths(selection) : [];
  const requiredContextPaths = uniquePaths([
    ...baselinePaths,
    ...relevantChanges.flatMap((item) => item.affected_paths),
  ]);
  const acknowledgementRequired = baselineRequired || newerEvents.length > 0;
  const digestPayload = {
    schema_version: 1,
    actor_id: input.actor_id,
    selection,
    checkpoint:
      checkpoint === undefined
        ? null
        : {
            checkpoint_id: checkpoint.value.checkpoint_id,
            last_event_id: checkpoint.value.last_event_id,
            reconciled_at: checkpoint.value.reconciled_at,
          },
    checkpoint_state: checkpointState,
    active_floor_event_id: activeFloor,
    newest_active_event_id: newestActive,
    baseline: {
      required: baselineRequired,
      reason: baselineReason,
      context_paths: baselinePaths,
    },
    relevant_changes: relevantChanges,
    out_of_scope_changes: outOfScopeChanges,
  };

  return {
    result: {
      schema_version: 1,
      command: 'status',
      mode: 'preview',
      actor_id: input.actor_id,
      selection,
      checkpoint: {
        state: checkpointState,
        previous_state: null,
        checkpoint_id: checkpoint?.value.checkpoint_id ?? null,
        checkpoint_path: checkpoint === undefined ? null : layerPath(checkpoint.path),
        last_event_id: checkpointLast,
        active_floor_event_id: activeFloor,
        newest_active_event_id: newestActive,
      },
      baseline: {
        required: baselineRequired,
        reason: baselineReason,
        context_paths: baselinePaths,
      },
      relevant_changes: relevantChanges,
      out_of_scope_changes: outOfScopeChanges,
      required_context_paths: requiredContextPaths,
      status_digest: reconciliationDigest(digestPayload),
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
  root: string,
  checkpoint: ReconciliationCheckpoint,
  existing: LoadedYaml<ReconciliationCheckpoint> | undefined,
): Promise<string> {
  const result = validateSchema('checkpoint', checkpoint);
  if (!result.valid) {
    throw statusError(
      'PCP_STATUS_CHECKPOINT_INVALID',
      'The generated reconciliation checkpoint failed its release schema.',
    );
  }

  const relativePath = `${CHECKPOINT_DIRECTORY}/${checkpoint.checkpoint_id}.yaml`;
  const directory = path.join(root, '.pcp', ...CHECKPOINT_DIRECTORY.split('/'));
  const target = path.join(root, '.pcp', ...relativePath.split('/'));
  await mkdir(directory, { recursive: true });
  if (existing !== undefined) {
    const current = await fileContentsOrUndefined(target);
    if (current !== existing.contents) {
      throw statusError(
        'PCP_STATUS_SOURCE_CHANGED',
        'The scoped checkpoint changed after status was recomputed.',
      );
    }
  } else if ((await fileContentsOrUndefined(target)) !== undefined) {
    throw statusError(
      'PCP_STATUS_SOURCE_CHANGED',
      'A checkpoint with the generated identity appeared before acknowledgement.',
    );
  }

  const contents = stringify(checkpoint);
  const temporary = path.join(directory, `.${checkpoint.checkpoint_id}.${randomUUID()}.tmp`);
  const previous = `${temporary}.previous`;
  await writeDurableFile(temporary, contents);
  let previousHeld = false;
  let replacementInstalled = false;
  try {
    if (existing === undefined) {
      await rename(temporary, target);
      return layerPath(relativePath);
    }
    try {
      await rename(temporary, target);
      return layerPath(relativePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST' && code !== 'EPERM') throw error;
    }

    await rename(target, previous);
    previousHeld = true;
    await rename(temporary, target);
    replacementInstalled = true;
    if (previousHeld) {
      await unlink(previous);
      previousHeld = false;
    }
    return layerPath(relativePath);
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
      throw new ReconciliationError(
        'PCP_STATUS_ROLLBACK_FAILED',
        `Checkpoint acknowledgement failed (${error instanceof Error ? error.message : String(error)}) and its prior state could not be restored.`,
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

async function reportStatusLocked(root: string, input: StatusInput): Promise<StatusResult> {
  const state = await loadOperationalContinuityState(root);
  const preview = previewStatus(state, input);
  if (input.acknowledge === undefined) return preview.result;
  if (input.acknowledge !== preview.result.status_digest) {
    throw statusError(
      'PCP_STATUS_DIGEST_MISMATCH',
      'Status changed or the acknowledgement digest is incorrect; review a fresh preview.',
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

  const checkpoint: ReconciliationCheckpoint = {
    schema_version: 1,
    checkpoint_id: preview.checkpoint?.value.checkpoint_id ?? ulid(),
    actor_id: input.actor_id,
    workstream_id: preview.result.selection.workstream_id,
    last_event_id: preview.target_last_event_id,
    reconciled_at: new Date().toISOString(),
    scopes: preview.result.selection.scopes,
    paths: preview.result.selection.paths,
    dependencies: preview.result.selection.dependencies,
  };
  const checkpointPath = await writeCheckpoint(root, checkpoint, preview.checkpoint);

  return {
    ...preview.result,
    mode: 'acknowledge',
    checkpoint: {
      ...preview.result.checkpoint,
      state: 'current',
      previous_state: preview.result.checkpoint.state,
      checkpoint_id: checkpoint.checkpoint_id,
      checkpoint_path: checkpointPath,
      last_event_id: checkpoint.last_event_id,
    },
    acknowledgement: { required: true, accepted: true },
    mutated: true,
  };
}

export async function reportStatus(projectRoot: string, input: StatusInput): Promise<StatusResult> {
  const root = path.resolve(projectRoot);
  try {
    return await withContinuityLock(root, () => reportStatusLocked(root, input));
  } catch (error) {
    if (error instanceof ContinuityLockError) {
      throw statusError(
        'PCP_STATUS_LOCKED',
        'Another actor registration or continuity operation is still running for this project.',
      );
    }
    if (error instanceof ReconciliationError) throw error;
    throw statusError('PCP_STATUS_FAILED', error instanceof Error ? error.message : String(error));
  }
}
