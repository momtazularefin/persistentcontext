import { mkdir, open, readFile, readdir, rm, unlink } from 'node:fs/promises';
import path from 'node:path';

import { parse, stringify } from 'yaml';

import { validateCanonicalLayer } from './validate-canonical-layer.js';
import {
  actorIdentityMatches,
  createActorId,
  createExecutionId,
  normalizeActorIdentity,
  RegistrationError,
  type ActorIdentityCache,
  type ActorProfile,
  type ActorRegistrationResult,
  type NormalizedActorIdentity,
  type RegisterActorInput,
} from '../domain/registration.js';
import { ContinuityLockError, withContinuityLock } from '../infrastructure/continuity-lock.js';
import { validateSchema } from '../infrastructure/schema-validator.js';

const ACTOR_DIRECTORY = '.pcp/continuity/actors';
const CACHE_DIRECTORY = '.pcp/runtime/actors';

function portablePath(value: string): string {
  return value.split(path.sep).join('/');
}

function profileRelativePath(actorId: string): string {
  return `${ACTOR_DIRECTORY}/${actorId}.yaml`;
}

function cacheRelativePath(identity: NormalizedActorIdentity): string {
  return `${CACHE_DIRECTORY}/${identity.actor_type}-${identity.client}-${identity.machine_label}.json`;
}

function validationSummary(report: Awaited<ReturnType<typeof validateCanonicalLayer>>): string {
  return report.diagnostics
    .slice(0, 3)
    .map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`)
    .join('; ');
}

async function assertValidCanonicalLayer(projectRoot: string): Promise<void> {
  const report = await validateCanonicalLayer(projectRoot, { archive_content: 'filenames-only' });
  if (report.valid) return;
  const detail = validationSummary(report);
  throw new RegistrationError(
    'PCP_REGISTRATION_INVALID_LAYER',
    `Actor registration requires a valid installed PCP layer${detail.length === 0 ? '.' : `: ${detail}`}`,
  );
}

async function readOptionalText(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

function actorProfile(value: unknown, relativePath: string): ActorProfile {
  const result = validateSchema('actor-profile', value);
  if (!result.valid) {
    throw new RegistrationError(
      'PCP_REGISTRATION_INVALID_LAYER',
      `Actor profile failed its release schema: ${relativePath}.`,
    );
  }
  return value as ActorProfile;
}

async function loadActorProfiles(projectRoot: string): Promise<ActorProfile[]> {
  const actorRoot = path.join(projectRoot, ...ACTOR_DIRECTORY.split('/'));
  const entries = await readdir(actorRoot, { withFileTypes: true });
  const profiles: ActorProfile[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isFile() || !entry.name.endsWith('.yaml')) continue;
    const relativePath = `${ACTOR_DIRECTORY}/${entry.name}`;
    const contents = await readFile(path.join(actorRoot, entry.name), 'utf8');
    let value: unknown;
    try {
      value = parse(contents) as unknown;
    } catch {
      throw new RegistrationError(
        'PCP_REGISTRATION_INVALID_LAYER',
        `Actor profile is not valid YAML: ${relativePath}.`,
      );
    }
    profiles.push(actorProfile(value, relativePath));
  }
  return profiles;
}

function parseIdentityCache(
  contents: string,
  identity: NormalizedActorIdentity,
): ActorIdentityCache {
  let value: unknown;
  try {
    value = JSON.parse(contents) as unknown;
  } catch {
    throw new RegistrationError(
      'PCP_REGISTRATION_CACHE_INVALID',
      'The local actor identity cache is not valid JSON.',
    );
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RegistrationError(
      'PCP_REGISTRATION_CACHE_INVALID',
      'The local actor identity cache must be an object.',
    );
  }
  const record = value as Record<string, unknown>;
  const expectedKeys = ['actor_id', 'actor_type', 'client', 'machine_label', 'schema_version'];
  if (JSON.stringify(Object.keys(record).sort()) !== JSON.stringify(expectedKeys)) {
    throw new RegistrationError(
      'PCP_REGISTRATION_CACHE_INVALID',
      'The local actor identity cache has an unexpected shape.',
    );
  }

  let normalized: NormalizedActorIdentity;
  try {
    normalized = normalizeActorIdentity({
      actor_type: typeof record.actor_type === 'string' ? record.actor_type : '',
      client: typeof record.client === 'string' ? record.client : '',
      machine_label: typeof record.machine_label === 'string' ? record.machine_label : '',
      actor_id: typeof record.actor_id === 'string' ? record.actor_id : '',
    });
  } catch {
    throw new RegistrationError(
      'PCP_REGISTRATION_CACHE_INVALID',
      'The local actor identity cache contains invalid identity fields.',
    );
  }

  if (record.schema_version !== 1 || !sameIdentity(normalized, identity)) {
    throw new RegistrationError(
      'PCP_REGISTRATION_CACHE_MISMATCH',
      'The local actor identity cache does not match the requested client and machine.',
    );
  }
  if (normalized.actor_id === undefined) {
    throw new RegistrationError(
      'PCP_REGISTRATION_CACHE_INVALID',
      'The local actor identity cache has no actor ID.',
    );
  }
  return {
    schema_version: 1,
    actor_id: normalized.actor_id,
    actor_type: normalized.actor_type,
    client: normalized.client,
    machine_label: normalized.machine_label,
  };
}

function sameIdentity(left: NormalizedActorIdentity, right: NormalizedActorIdentity): boolean {
  return (
    left.actor_type === right.actor_type &&
    left.client === right.client &&
    left.machine_label === right.machine_label
  );
}

async function createExclusiveFile(
  file: string,
  contents: string,
  onCreate: () => void,
): Promise<void> {
  const handle = await open(file, 'wx');
  try {
    onCreate();
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function rollbackUnlink(file: string, failures: unknown[]): Promise<void> {
  await unlink(file).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') failures.push(error);
  });
}

async function rollbackCreatedPaths(input: {
  cache_path?: string;
  profile_path?: string;
  runtime_root?: string;
}): Promise<boolean> {
  const failures: unknown[] = [];
  if (input.cache_path !== undefined) {
    await rollbackUnlink(input.cache_path, failures);
  }
  if (input.profile_path !== undefined) {
    await rollbackUnlink(input.profile_path, failures);
  }
  if (input.runtime_root !== undefined) {
    await rm(input.runtime_root, { recursive: true, force: true }).catch((error: unknown) =>
      failures.push(error),
    );
  }
  return failures.length === 0;
}

function cacheValue(profile: ActorProfile): ActorIdentityCache {
  return {
    schema_version: 1,
    actor_id: profile.actor_id,
    actor_type: profile.actor_type,
    client: profile.client,
    machine_label: profile.machine_label,
  };
}

async function withActorRegistrationLock<T>(root: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await withContinuityLock(root, operation);
  } catch (error) {
    if (error instanceof ContinuityLockError) {
      throw new RegistrationError(
        'PCP_REGISTRATION_LOCKED',
        'Another actor registration or continuity operation is still running for this project.',
      );
    }
    throw error;
  }
}

export async function registerActor(
  projectRoot: string,
  input: RegisterActorInput,
): Promise<ActorRegistrationResult> {
  const root = path.resolve(projectRoot);
  const identity = normalizeActorIdentity(input);
  const executionId = createExecutionId();

  return withActorRegistrationLock(root, async () => {
    let createdProfilePath: string | undefined;
    let createdCachePath: string | undefined;
    let createdRuntimeRoot: string | undefined;

    try {
      await assertValidCanonicalLayer(root);
      const profiles = await loadActorProfiles(root);
      const profilesById = new Map(profiles.map((profile) => [profile.actor_id, profile]));
      const cachePath = path.join(root, ...cacheRelativePath(identity).split('/'));
      const cachedContents = await readOptionalText(cachePath);
      let selected: ActorProfile | undefined;

      if (cachedContents !== undefined) {
        const cached = parseIdentityCache(cachedContents, identity);
        if (identity.actor_id !== undefined && identity.actor_id !== cached.actor_id) {
          throw new RegistrationError(
            'PCP_REGISTRATION_CACHE_MISMATCH',
            'The requested actor ID disagrees with the cached project identity.',
          );
        }
        selected = profilesById.get(cached.actor_id);
        if (selected === undefined) {
          throw new RegistrationError(
            'PCP_REGISTRATION_STALE_CACHE',
            'The cached actor profile is missing; restore or explicitly repair identity state.',
          );
        }
        if (!actorIdentityMatches(selected, identity)) {
          throw new RegistrationError(
            'PCP_REGISTRATION_CACHE_MISMATCH',
            'The cached actor profile no longer matches its client and machine identity.',
          );
        }
      } else if (identity.actor_id !== undefined) {
        selected = profilesById.get(identity.actor_id);
        if (selected === undefined) {
          throw new RegistrationError(
            'PCP_REGISTRATION_ACTOR_NOT_FOUND',
            'The requested actor profile does not exist in this project.',
          );
        }
        if (!actorIdentityMatches(selected, identity)) {
          throw new RegistrationError(
            'PCP_REGISTRATION_ACTOR_MISMATCH',
            'The requested actor profile belongs to a different client or machine.',
          );
        }
      } else {
        const matches = profiles.filter((profile) => actorIdentityMatches(profile, identity));
        if (matches.length > 1) {
          throw new RegistrationError(
            'PCP_REGISTRATION_AMBIGUOUS',
            'Multiple actor profiles match this client and machine; rerun with --actor-id.',
          );
        }
        selected = matches[0];
      }

      let profileCreated = false;
      if (selected === undefined) {
        selected = {
          schema_version: 1,
          actor_id: createActorId(identity),
          actor_type: identity.actor_type,
          client: identity.client,
          machine_label: identity.machine_label,
          first_seen: new Date().toISOString(),
          checkpoint_paths: [],
        };
        const schemaResult = validateSchema('actor-profile', selected);
        if (!schemaResult.valid) {
          throw new RegistrationError(
            'PCP_REGISTRATION_PROFILE_INVALID',
            'The generated actor profile did not satisfy the release schema.',
          );
        }
        const newProfilePath = path.join(
          root,
          ...profileRelativePath(selected.actor_id).split('/'),
        );
        await createExclusiveFile(newProfilePath, stringify(selected), () => {
          createdProfilePath = newProfilePath;
        });
        profileCreated = true;
        await assertValidCanonicalLayer(root);
      }

      let cacheCreated = false;
      if (cachedContents === undefined) {
        const cacheDirectory = path.dirname(cachePath);
        createdRuntimeRoot = await mkdir(cacheDirectory, { recursive: true });
        await createExclusiveFile(
          cachePath,
          `${JSON.stringify(cacheValue(selected), null, 2)}\n`,
          () => {
            createdCachePath = cachePath;
          },
        );
        cacheCreated = true;
      }

      await assertValidCanonicalLayer(root);
      return {
        schema_version: 1,
        command: 'register',
        status: profileCreated ? 'created' : 'recovered',
        actor_id: selected.actor_id,
        actor_type: selected.actor_type,
        client: selected.client,
        machine_label: selected.machine_label,
        profile_path: portablePath(profileRelativePath(selected.actor_id)),
        execution_id: executionId,
        profile_created: profileCreated,
        cache_created: cacheCreated,
        event_created: false,
        mutated: profileCreated || cacheCreated,
      };
    } catch (error) {
      const rolledBack = await rollbackCreatedPaths({
        ...(createdCachePath === undefined ? {} : { cache_path: createdCachePath }),
        ...(createdProfilePath === undefined ? {} : { profile_path: createdProfilePath }),
        ...(createdRuntimeRoot === undefined ? {} : { runtime_root: createdRuntimeRoot }),
      });
      if (!rolledBack) {
        throw new RegistrationError(
          'PCP_REGISTRATION_ROLLBACK_FAILED',
          'Actor registration failed and its new files could not be fully removed.',
          true,
        );
      }
      if (error instanceof RegistrationError) {
        throw new RegistrationError(error.code, error.message, false);
      }
      throw new RegistrationError(
        'PCP_REGISTRATION_FAILED',
        error instanceof Error ? error.message : String(error),
        false,
      );
    }
  });
}
