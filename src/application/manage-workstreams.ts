import { createHash, randomUUID } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdtemp,
  open,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  unlink,
  utimes,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { parseDocument, stringify } from 'yaml';

import { recordEventUnderLock } from './record-event.js';
import { renderCanonicalStatusView } from './render-canonical-views.js';
import { validateCanonicalLayer } from './validate-canonical-layer.js';
import { validateCanonicalSemantics } from '../domain/canonical-semantics.js';
import type { RecordEventInput } from '../domain/recording.js';
import { RecordingError } from '../domain/recording.js';
import {
  prepareWorkstreamMutation,
  WorkstreamError,
  type WorkstreamMutationResult,
  type WorkstreamOperationInput,
  type WorkstreamRegistry,
  type WorkstreamValidationResult,
} from '../domain/workstreams.js';
import { ContinuityLockError, withContinuityLock } from '../infrastructure/continuity-lock.js';
import { canonicalSourceDigestFromContents } from '../infrastructure/canonical-source-digest.js';
import { validateSchema } from '../infrastructure/schema-validator.js';

const WORKSTREAM_PATH = '.pcp/state/workstreams.yaml';
const STATUS_VIEW_PATH = '.pcp/views/10-status.generated.md';
const STATUS_SOURCES = [
  'state/project.yaml',
  'state/projects.yaml',
  'state/workstreams.yaml',
  'state/vcs-policy.yaml',
] as const;
const MAXIMUM_INPUT_BYTES = 64 * 1024;

interface LoadedRegistry {
  absolute_path: string;
  bytes: Buffer;
  digest: string;
  registry: WorkstreamRegistry;
}

interface FileMetadata {
  mode: number;
  atime: Date;
  mtime: Date;
}

export interface WorkstreamMutationOptions {
  fail_after_operation?: number;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function rootDigest(root: string): string {
  const resolved = path.resolve(root);
  return sha256(process.platform === 'win32' ? resolved.toLowerCase() : resolved);
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function layerSummary(report: Awaited<ReturnType<typeof validateCanonicalLayer>>): string {
  return report.diagnostics
    .slice(0, 4)
    .map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`)
    .join('; ');
}

async function assertValidOperationalLayer(root: string): Promise<void> {
  const report = await validateCanonicalLayer(root, { archive_content: 'filenames-only' });
  if (report.valid) return;
  const detail = layerSummary(report);
  throw new WorkstreamError(
    'PCP_WORKSTREAM_INVALID_LAYER',
    `Workstream operations require a valid installed PCP layer${detail.length === 0 ? '.' : `: ${detail}`}`,
  );
}

function inputFailure(message: string): WorkstreamError {
  return new WorkstreamError('PCP_WORKSTREAM_INPUT_INVALID', message);
}

async function loadWorkstreamInput(
  inputPath: string,
  projectRoot: string,
  expectedOperation: WorkstreamOperationInput['operation'],
): Promise<WorkstreamOperationInput> {
  const resolvedInput = path.resolve(inputPath);
  if (isInside(projectRoot, resolvedInput)) {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_INPUT_INSIDE_PROJECT',
      'Store transient workstream input outside the managed project so it cannot become duplicate project state.',
    );
  }

  let metadata;
  try {
    metadata = await lstat(resolvedInput);
  } catch (error) {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_INPUT_UNREADABLE',
      `Cannot read workstream input: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAXIMUM_INPUT_BYTES) {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_INPUT_UNSAFE',
      'Workstream input must be a regular non-symlink file no larger than 64 KiB.',
    );
  }
  try {
    const [physicalInput, physicalProjectRoot] = await Promise.all([
      realpath(resolvedInput),
      realpath(projectRoot),
    ]);
    if (isInside(physicalProjectRoot, physicalInput)) {
      throw new WorkstreamError(
        'PCP_WORKSTREAM_INPUT_INSIDE_PROJECT',
        'Store transient workstream input outside the managed project so it cannot become duplicate project state.',
      );
    }
  } catch (error) {
    if (error instanceof WorkstreamError) throw error;
    throw new WorkstreamError(
      'PCP_WORKSTREAM_INPUT_UNREADABLE',
      `Cannot resolve workstream input safely: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const contents = await readFile(resolvedInput, 'utf8').catch((error: unknown) => {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_INPUT_UNREADABLE',
      `Cannot read workstream input: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  const document = parseDocument(contents, {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw inputFailure(
      `Workstream input is not valid YAML: ${document.errors.map((error) => error.message).join('; ')}`,
    );
  }
  let value: unknown;
  try {
    value = document.toJS({ mapAsMap: false, maxAliasCount: 50 }) as unknown;
  } catch (error) {
    throw inputFailure(
      `Workstream input cannot be decoded safely: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const validation = validateSchema('workstream-operation-input', value);
  if (!validation.valid) {
    const detail = validation.diagnostics
      .slice(0, 8)
      .map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`)
      .join('; ');
    throw inputFailure(`Workstream input fails its release schema: ${detail}`);
  }
  const input = value as WorkstreamOperationInput;
  if (input.operation !== expectedOperation) {
    throw inputFailure(
      `The ${expectedOperation} command requires operation: ${expectedOperation}, not ${input.operation}.`,
    );
  }
  return input;
}

function parseRegistry(bytes: Buffer): WorkstreamRegistry {
  const document = parseDocument(bytes.toString('utf8'), {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_REGISTRY_INVALID',
      'The canonical workstream registry is not valid YAML.',
    );
  }
  const value = document.toJS({ mapAsMap: false, maxAliasCount: 50 }) as unknown;
  const schema = validateSchema('workstreams', value);
  if (!schema.valid) {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_REGISTRY_INVALID',
      'The canonical workstream registry fails its release schema.',
    );
  }
  return value as WorkstreamRegistry;
}

function parseSource(contents: string, relativePath: string): Record<string, unknown> {
  const document = parseDocument(contents, {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_RENDER_SOURCE_INVALID',
      `Cannot render the status view because ${relativePath} is not valid YAML.`,
    );
  }
  const value = document.toJS({ mapAsMap: false, maxAliasCount: 50 }) as unknown;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_RENDER_SOURCE_INVALID',
      `Cannot render the status view because ${relativePath} is not an object.`,
    );
  }
  return value as Record<string, unknown>;
}

async function desiredStatusView(
  root: string,
  workstreamContents: string,
  registry: WorkstreamRegistry,
): Promise<Buffer> {
  const layerRoot = path.join(root, '.pcp');
  const contents = await Promise.all(
    STATUS_SOURCES.map(async (relativePath) => ({
      path: relativePath,
      contents:
        relativePath === 'state/workstreams.yaml'
          ? workstreamContents
          : await readFile(path.join(layerRoot, ...relativePath.split('/')), 'utf8'),
    })),
  );
  const values = new Map<string, Record<string, unknown>>();
  for (const source of contents) {
    values.set(
      source.path,
      source.path === 'state/workstreams.yaml'
        ? (registry as unknown as Record<string, unknown>)
        : parseSource(source.contents, source.path),
    );
  }
  const sourceDigest = canonicalSourceDigestFromContents(contents);
  return Buffer.from(renderCanonicalStatusView(values, sourceDigest), 'utf8');
}

async function loadRegistry(root: string): Promise<LoadedRegistry> {
  const absolutePath = path.join(root, ...WORKSTREAM_PATH.split('/'));
  const metadata = await lstat(absolutePath).catch((error: unknown) => {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_REGISTRY_UNREADABLE',
      `Cannot read the canonical workstream registry: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_REGISTRY_UNSAFE',
      'The canonical workstream registry must be a regular non-symlink file.',
    );
  }
  const bytes = await readFile(absolutePath);
  return {
    absolute_path: absolutePath,
    bytes,
    digest: sha256(bytes),
    registry: parseRegistry(bytes),
  };
}

function assertRegistrySemantics(registry: WorkstreamRegistry): void {
  const diagnostics = validateCanonicalSemantics({
    workstreams: { path: 'state/workstreams.yaml', value: registry },
    actors: [],
    events: [],
    checkpoints: [],
  });
  if (diagnostics.length === 0) return;
  const detail = diagnostics
    .slice(0, 8)
    .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
    .join('; ');
  throw new WorkstreamError(
    'PCP_WORKSTREAM_STATE_INVALID',
    `The requested workstream state is inconsistent: ${detail}`,
  );
}

async function writeDurableExclusive(file: string, bytes: Buffer): Promise<void> {
  const handle = await open(file, 'wx');
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function replaceWithTemporary(target: string, temporary: string): Promise<void> {
  try {
    await rename(temporary, target);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'EEXIST' && code !== 'EPERM') throw error;
    const held = `${temporary}.previous`;
    await rename(target, held);
    try {
      await rename(temporary, target);
      await unlink(held);
    } catch (replacementError) {
      if (await exists(target)) await unlink(target);
      await rename(held, target);
      throw replacementError;
    }
  }
}

async function installBytes(target: string, bytes: Buffer): Promise<void> {
  const temporary = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${randomUUID()}.tmp`,
  );
  try {
    await writeDurableExclusive(temporary, bytes);
    await replaceWithTemporary(target, temporary);
  } finally {
    if (await exists(temporary)) await unlink(temporary);
  }
}

async function restoreRegistry(
  target: string,
  bytes: Buffer,
  metadata: FileMetadata,
): Promise<void> {
  await installBytes(target, bytes);
  await chmod(target, metadata.mode);
  await utimes(target, metadata.atime, metadata.mtime);
}

function eventInput(input: WorkstreamOperationInput, workstreamId: string): RecordEventInput {
  return {
    schema_version: 1,
    ...(input.occurred_at === undefined ? {} : { occurred_at: input.occurred_at }),
    actor: input.actor,
    recorded_by: input.recorded_by,
    basis: input.basis,
    ...(input.change_key === undefined ? {} : { change_key: input.change_key }),
    kind: 'workstream',
    scopes: ['workstream-registry'],
    workstreams: [workstreamId],
    summary: input.summary,
    ...(input.rationale === undefined ? {} : { rationale: input.rationale }),
    affected_paths: [WORKSTREAM_PATH, STATUS_VIEW_PATH],
  };
}

function injectedFailure(operation: number, options: WorkstreamMutationOptions): void {
  if (options.fail_after_operation === operation) {
    throw new WorkstreamError(
      'PCP_FAULT_INJECTED',
      `Injected workstream failure after operation ${operation}.`,
      true,
    );
  }
}

async function executeMutation(
  root: string,
  loaded: LoadedRegistry,
  input: WorkstreamOperationInput,
  nextRegistry: WorkstreamRegistry,
  workstreamId: string,
  options: WorkstreamMutationOptions,
): Promise<WorkstreamMutationResult> {
  const nextBytes = Buffer.from(stringify(nextRegistry), 'utf8');
  const nextDigest = sha256(nextBytes);
  const statusViewPath = path.join(root, ...STATUS_VIEW_PATH.split('/'));
  const [metadata, viewMetadata, viewBytes, nextViewBytes] = await Promise.all([
    stat(loaded.absolute_path),
    stat(statusViewPath),
    readFile(statusViewPath),
    desiredStatusView(root, nextBytes.toString('utf8'), nextRegistry),
  ]);
  const registryMetadata: FileMetadata = {
    mode: metadata.mode,
    atime: metadata.atime,
    mtime: metadata.mtime,
  };
  const statusViewMetadata: FileMetadata = {
    mode: viewMetadata.mode,
    atime: viewMetadata.atime,
    mtime: viewMetadata.mtime,
  };
  let recoveryRoot: string | undefined;
  let registryInstalled = false;
  let statusViewInstalled = false;

  try {
    recoveryRoot = await mkdtemp(
      path.join(tmpdir(), `pcp-workstream-transaction-${rootDigest(root).slice(0, 12)}-`),
    );
    await writeDurableExclusive(path.join(recoveryRoot, 'workstreams.preimage'), loaded.bytes);
    await writeDurableExclusive(path.join(recoveryRoot, 'status-view.preimage'), viewBytes);
    await writeDurableExclusive(
      path.join(recoveryRoot, 'transaction.json'),
      Buffer.from(
        `${JSON.stringify({
          schema_version: 1,
          target: WORKSTREAM_PATH,
          digest_before: loaded.digest,
          digest_after: nextDigest,
          generated_view: STATUS_VIEW_PATH,
          generated_view_digest_before: sha256(viewBytes),
          generated_view_digest_after: sha256(nextViewBytes),
        })}\n`,
        'utf8',
      ),
    );

    await installBytes(loaded.absolute_path, nextBytes);
    registryInstalled = true;
    injectedFailure(1, options);

    await installBytes(statusViewPath, nextViewBytes);
    statusViewInstalled = true;
    injectedFailure(2, options);

    const nestedFailure =
      options.fail_after_operation === undefined || options.fail_after_operation <= 2
        ? undefined
        : options.fail_after_operation - 2;
    const recorded = await recordEventUnderLock(root, eventInput(input, workstreamId), {
      ...(nestedFailure === undefined ? {} : { fail_after_operation: nestedFailure }),
    });

    let recoveryRetained = false;
    try {
      await rm(recoveryRoot, { recursive: true, force: false });
    } catch {
      recoveryRetained = true;
    }
    return {
      schema_version: 1,
      command: 'workstream',
      operation: input.operation,
      status:
        input.operation === 'create'
          ? 'created'
          : input.operation === 'update'
            ? 'updated'
            : 'completed',
      workstream_id: workstreamId,
      registry_path: WORKSTREAM_PATH,
      registry_digest_before: loaded.digest,
      registry_digest_after: nextDigest,
      event_id: recorded.event_id,
      event_path: recorded.event_path,
      event_payload_digest: recorded.payload_digest,
      announcement: input.operation === 'complete' ? input.announcement.trim() : null,
      event_created: true,
      mutated: true,
      recovery_retained: recoveryRetained,
      recovery_path: recoveryRetained ? recoveryRoot : null,
    };
  } catch (error) {
    const rollbackFailures: string[] = [];
    if (statusViewInstalled) {
      try {
        await restoreRegistry(statusViewPath, viewBytes, statusViewMetadata);
      } catch (rollbackError) {
        rollbackFailures.push(
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        );
      }
    }
    if (registryInstalled) {
      try {
        await restoreRegistry(loaded.absolute_path, loaded.bytes, registryMetadata);
      } catch (rollbackError) {
        rollbackFailures.push(
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        );
      }
    }
    try {
      const restored = await readFile(loaded.absolute_path);
      if (!restored.equals(loaded.bytes)) {
        rollbackFailures.push('workstream registry bytes differ from the preimage');
      }
    } catch (rollbackError) {
      rollbackFailures.push(
        rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      );
    }
    try {
      const restoredView = await readFile(statusViewPath);
      if (!restoredView.equals(viewBytes)) {
        rollbackFailures.push('generated status view bytes differ from the preimage');
      }
    } catch (rollbackError) {
      rollbackFailures.push(
        rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      );
    }
    if (rollbackFailures.length === 0) {
      const report = await validateCanonicalLayer(root, { archive_content: 'filenames-only' });
      if (!report.valid)
        rollbackFailures.push(`restored layer is invalid: ${layerSummary(report)}`);
    }

    if (rollbackFailures.length > 0) {
      const retainedPaths = [
        ...(recoveryRoot === undefined ? [] : [recoveryRoot]),
        ...(error instanceof RecordingError ? error.recovery_paths : []),
      ];
      throw new WorkstreamError(
        'PCP_WORKSTREAM_ROLLBACK_FAILED',
        `Workstream mutation failed (${error instanceof Error ? error.message : String(error)}) and exact rollback could not be verified: ${rollbackFailures.join('; ')}`,
        true,
        retainedPaths,
      );
    }

    const retainedPaths = error instanceof RecordingError ? [...error.recovery_paths] : [];
    if (recoveryRoot !== undefined) {
      try {
        await rm(recoveryRoot, { recursive: true, force: true });
      } catch {
        retainedPaths.push(recoveryRoot);
      }
    }
    const code =
      error instanceof WorkstreamError || error instanceof RecordingError
        ? error.code
        : 'PCP_WORKSTREAM_TRANSACTION_FAILED';
    throw new WorkstreamError(
      code,
      error instanceof Error ? error.message : String(error),
      false,
      retainedPaths,
    );
  }
}

async function underLock<T>(root: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await withContinuityLock(root, operation);
  } catch (error) {
    if (error instanceof ContinuityLockError) {
      throw new WorkstreamError(
        'PCP_WORKSTREAM_LOCKED',
        'Another actor registration or continuity operation is still running for this project.',
      );
    }
    throw error;
  }
}

export async function validateWorkstreamRegistry(
  projectRoot: string,
  workstreamId?: string,
): Promise<WorkstreamValidationResult> {
  const root = path.resolve(projectRoot);
  return underLock(root, async () => {
    await assertValidOperationalLayer(root);
    const loaded = await loadRegistry(root);
    const workstream =
      workstreamId === undefined
        ? null
        : (loaded.registry.workstreams.find((item) => item.workstream_id === workstreamId) ??
          undefined);
    if (workstream === undefined) {
      throw new WorkstreamError(
        'PCP_WORKSTREAM_NOT_FOUND',
        `Workstream ${workstreamId ?? ''} does not exist.`,
      );
    }
    return {
      schema_version: 1,
      command: 'workstream',
      operation: 'validate',
      status: 'valid',
      registry_path: WORKSTREAM_PATH,
      registry_digest: loaded.digest,
      workstream_count: loaded.registry.workstreams.length,
      workstream,
      diagnostics: [],
      event_created: false,
      mutated: false,
    };
  });
}

export async function mutateWorkstream(
  projectRoot: string,
  operation: WorkstreamOperationInput['operation'],
  inputPath: string,
  options: WorkstreamMutationOptions = {},
): Promise<WorkstreamMutationResult> {
  const root = path.resolve(projectRoot);
  const input = await loadWorkstreamInput(inputPath, root, operation);
  return underLock(root, async () => {
    await assertValidOperationalLayer(root);
    const loaded = await loadRegistry(root);
    if (input.expected_registry_digest !== loaded.digest) {
      throw new WorkstreamError(
        'PCP_WORKSTREAM_REGISTRY_CHANGED',
        'The workstream registry changed after this operation was prepared; validate and rebuild the input.',
      );
    }
    const prepared = prepareWorkstreamMutation(loaded.registry, input);
    const schema = validateSchema('workstreams', prepared.registry);
    if (!schema.valid) {
      throw new WorkstreamError(
        'PCP_WORKSTREAM_STATE_INVALID',
        'The requested workstream state fails its release schema.',
      );
    }
    assertRegistrySemantics(prepared.registry);
    return executeMutation(
      root,
      loaded,
      input,
      prepared.registry,
      prepared.workstream.workstream_id,
      options,
    );
  });
}
