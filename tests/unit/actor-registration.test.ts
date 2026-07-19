import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse, stringify } from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';

import { registerActor } from '../../src/application/register-actor.js';
import { validateCanonicalLayer } from '../../src/application/validate-canonical-layer.js';
import {
  normalizeActorIdentity,
  normalizeMachineLabel,
  type RegisterActorInput,
} from '../../src/domain/registration.js';
import { formatRegistration } from '../../src/presentation/format-registration.js';

const coreTemplate = fileURLToPath(new URL('../../templates/core/.pcp/', import.meta.url));
const temporaryRoots: string[] = [];
const ulidPattern = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/u;

async function createProject(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'pcp-registration-'));
  temporaryRoots.push(root);
  await cp(coreTemplate, path.join(root, '.pcp'), { recursive: true });
  return root;
}

async function actorFiles(root: string): Promise<string[]> {
  return (await readdir(path.join(root, '.pcp', 'continuity', 'actors')))
    .filter((entry) => entry.endsWith('.yaml'))
    .sort();
}

async function eventFiles(root: string): Promise<string[]> {
  const directories = ['events', 'archive'];
  const files = await Promise.all(
    directories.map(async (directory) =>
      (await readdir(path.join(root, '.pcp', 'continuity', directory)))
        .filter((entry) => entry.endsWith('.yaml'))
        .map((entry) => `${directory}/${entry}`),
    ),
  );
  return files.flat().sort();
}

async function writeActor(
  root: string,
  actorId: string,
  client = 'codex',
  machineLabel = 'test-machine',
): Promise<void> {
  await writeFile(
    path.join(root, '.pcp', 'continuity', 'actors', `${actorId}.yaml`),
    stringify({
      schema_version: 1,
      actor_id: actorId,
      actor_type: 'agent',
      client,
      machine_label: machineLabel,
      first_seen: '2026-07-15T00:00:00Z',
      checkpoint_paths: [],
    }),
    'utf8',
  );
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('actor registration', () => {
  it('creates one durable actor, reuses it, and returns a fresh execution ID', async () => {
    const root = await createProject();
    const input = { client: 'codex', machine_label: 'test-machine' };

    const first = await registerActor(root, input);
    const second = await registerActor(root, input);

    expect(first).toMatchObject({
      command: 'register',
      status: 'created',
      profile_created: true,
      cache_created: true,
      event_created: false,
      mutated: true,
    });
    expect(second).toMatchObject({
      status: 'recovered',
      actor_id: first.actor_id,
      profile_created: false,
      cache_created: false,
      event_created: false,
      mutated: false,
    });
    expect(first.execution_id).toMatch(ulidPattern);
    expect(second.execution_id).toMatch(ulidPattern);
    expect(second.execution_id).not.toBe(first.execution_id);
    expect(formatRegistration(first)).toContain(`Created actor ${first.actor_id}.`);
    expect(formatRegistration(second)).toContain(`Recovered actor ${first.actor_id}.`);
    expect(await actorFiles(root)).toEqual([`${first.actor_id}.yaml`]);
    expect(await eventFiles(root)).toEqual([]);
    expect((await validateCanonicalLayer(root)).valid).toBe(true);
  });

  it('serializes simultaneous registrations onto one actor without sharing executions', async () => {
    const root = await createProject();
    const input = { client: 'cursor', machine_label: 'shared-machine' };

    const results = await Promise.all([
      registerActor(root, input),
      registerActor(root, input),
      registerActor(root, input),
    ]);

    expect(new Set(results.map((result) => result.actor_id))).toHaveLength(1);
    expect(new Set(results.map((result) => result.execution_id))).toHaveLength(3);
    expect(results.filter((result) => result.status === 'created')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'recovered')).toHaveLength(2);
    expect(await actorFiles(root)).toHaveLength(1);
    expect(await eventFiles(root)).toEqual([]);
  });

  it('recovers a unique durable profile when its local cache is missing', async () => {
    const root = await createProject();
    const input = { client: 'antigravity', machine_label: 'recovery-machine' };
    const first = await registerActor(root, input);
    await rm(path.join(root, '.pcp', 'runtime'), { recursive: true, force: true });

    const recovered = await registerActor(root, input);

    expect(recovered).toMatchObject({
      status: 'recovered',
      actor_id: first.actor_id,
      profile_created: false,
      cache_created: true,
      event_created: false,
      mutated: true,
    });
    expect(await actorFiles(root)).toEqual([`${first.actor_id}.yaml`]);
  });

  it('fails closed when a cache points to a missing profile', async () => {
    const root = await createProject();
    const input = { client: 'codex', machine_label: 'stale-machine' };
    const first = await registerActor(root, input);
    await rm(path.join(root, first.profile_path));

    await expect(registerActor(root, input)).rejects.toMatchObject({
      code: 'PCP_REGISTRATION_STALE_CACHE',
      mutated: false,
    });
    expect(await actorFiles(root)).toEqual([]);
  });

  it('fails closed when the local cache is malformed', async () => {
    const root = await createProject();
    const input = { client: 'codex', machine_label: 'cache-machine' };
    const first = await registerActor(root, input);
    const cache = path.join(root, '.pcp', 'runtime', 'actors', 'agent-codex-cache-machine.json');
    await writeFile(cache, 'not json\n', 'utf8');

    await expect(registerActor(root, input)).rejects.toMatchObject({
      code: 'PCP_REGISTRATION_CACHE_INVALID',
      mutated: false,
    });
    expect(await actorFiles(root)).toEqual([`${first.actor_id}.yaml`]);
  });

  it('refuses an explicit actor ID that contradicts the cached identity', async () => {
    const root = await createProject();
    const input = { client: 'codex', machine_label: 'cache-machine' };
    const first = await registerActor(root, input);

    await expect(
      registerActor(root, {
        ...input,
        actor_id: 'codex-cache-machine-0123456789',
      }),
    ).rejects.toMatchObject({ code: 'PCP_REGISTRATION_CACHE_MISMATCH', mutated: false });
    expect(await actorFiles(root)).toEqual([`${first.actor_id}.yaml`]);
  });

  it('requires an explicit actor ID when durable recovery is ambiguous', async () => {
    const root = await createProject();
    const firstActor = 'codex-test-machine-0123456789';
    const secondActor = 'codex-test-machine-9876543210';
    await writeActor(root, firstActor);
    await writeActor(root, secondActor);

    await expect(
      registerActor(root, { client: 'codex', machine_label: 'test-machine' }),
    ).rejects.toMatchObject({ code: 'PCP_REGISTRATION_AMBIGUOUS', mutated: false });

    const recovered = await registerActor(root, {
      client: 'codex',
      machine_label: 'test-machine',
      actor_id: secondActor,
    });
    expect(recovered).toMatchObject({
      status: 'recovered',
      actor_id: secondActor,
      cache_created: true,
      profile_created: false,
      mutated: true,
    });
  });

  it('fails closed when explicit recovery is missing or belongs to another identity', async () => {
    const root = await createProject();
    const cursorActor = 'cursor-test-machine-0123456789';
    await writeActor(root, cursorActor, 'cursor');

    await expect(
      registerActor(root, {
        client: 'codex',
        machine_label: 'test-machine',
        actor_id: 'codex-test-machine-9876543210',
      }),
    ).rejects.toMatchObject({ code: 'PCP_REGISTRATION_ACTOR_NOT_FOUND', mutated: false });
    await expect(
      registerActor(root, {
        client: 'codex',
        machine_label: 'test-machine',
        actor_id: cursorActor,
      }),
    ).rejects.toMatchObject({ code: 'PCP_REGISTRATION_ACTOR_MISMATCH', mutated: false });
    expect(await actorFiles(root)).toEqual([`${cursorActor}.yaml`]);
  });

  it('registers a human without agent checkpoints or a continuity event', async () => {
    const root = await createProject();

    const result = await registerActor(root, {
      actor_type: 'human',
      machine_label: 'personal-laptop',
    });
    const profile = parse(await readFile(path.join(root, result.profile_path), 'utf8')) as Record<
      string,
      unknown
    >;

    expect(result).toMatchObject({
      actor_type: 'human',
      client: 'human',
      event_created: false,
    });
    expect(result.actor_id).toMatch(/^human-personal-laptop-[0-9A-HJKMNP-TV-Z]{10}$/u);
    expect(profile.checkpoint_paths).toEqual([]);
    expect(await eventFiles(root)).toEqual([]);
  });

  it.each(['github-copilot-vscode', 'cursor'])(
    'creates a schema-valid %s actor profile',
    async (client) => {
      const root = await createProject();
      const result = await registerActor(root, { client, machine_label: 'ide-machine' });

      expect(result.client).toBe(client);
      expect(result.actor_id.startsWith(`${client}-ide-machine-`)).toBe(true);
      expect((await validateCanonicalLayer(root)).valid).toBe(true);
    },
  );

  it('supports the longest schema-valid machine label for every client prefix', async () => {
    const root = await createProject();
    const machineLabel = 'm'.repeat(128);

    const result = await registerActor(root, {
      client: 'github-copilot-vscode',
      machine_label: machineLabel,
    });

    expect(result.actor_id).toHaveLength(161);
    expect((await validateCanonicalLayer(root)).valid).toBe(true);
  });

  it('rejects unknown clients before creating local or durable state', async () => {
    const root = await createProject();

    await expect(registerActor(root, { machine_label: 'test-machine' })).rejects.toMatchObject({
      code: 'PCP_REGISTRATION_CLIENT_REQUIRED',
      mutated: false,
    });
    await expect(
      registerActor(root, { client: 'mystery-client', machine_label: 'test-machine' }),
    ).rejects.toMatchObject({ code: 'PCP_REGISTRATION_CLIENT_INVALID', mutated: false });
    expect(await actorFiles(root)).toEqual([]);
    await expect(readdir(path.join(root, '.pcp', 'runtime', 'actors'))).rejects.toThrow();
  });

  it('refuses registration when the installed canonical layer is invalid', async () => {
    const root = await createProject();
    await rm(path.join(root, '.pcp', 'state', 'project.yaml'));

    await expect(
      registerActor(root, { client: 'codex', machine_label: 'test-machine' }),
    ).rejects.toMatchObject({ code: 'PCP_REGISTRATION_INVALID_LAYER', mutated: false });
    expect(await actorFiles(root)).toEqual([]);
    await expect(readdir(path.join(root, '.pcp', 'runtime', 'actors'))).rejects.toThrow();
  });

  it('registers without reading archived event contents reserved for explicit audit', async () => {
    const root = await createProject();
    const archivedEvent = path.join(
      root,
      '.pcp',
      'continuity',
      'archive',
      '01ARZ3NDEKTSV4RRFFQ69G5FAV.yaml',
    );
    await writeFile(archivedEvent, 'not: [valid yaml', 'utf8');

    const result = await registerActor(root, {
      client: 'codex',
      machine_label: 'archive-safe-machine',
    });

    expect(result.status).toBe('created');
    expect((await validateCanonicalLayer(root)).valid).toBe(false);
  });
});

describe('registration identity input', () => {
  it('normalizes a host name without changing a supplied stable slug', () => {
    expect(normalizeMachineLabel('Momtaz’s Workstation.local')).toBe('momtaz-s-workstation-local');
    expect(
      normalizeActorIdentity({ client: 'codex', machine_label: 'momtaz-workstation' }),
    ).toEqual({
      actor_type: 'agent',
      client: 'codex',
      machine_label: 'momtaz-workstation',
    });
  });

  it.each([
    [
      'PCP_REGISTRATION_ACTOR_TYPE_INVALID',
      { actor_type: 'robot', client: 'codex', machine_label: 'machine' },
    ],
    [
      'PCP_REGISTRATION_CLIENT_MISMATCH',
      { actor_type: 'human', client: 'codex', machine_label: 'machine' },
    ],
    [
      'PCP_REGISTRATION_CLIENT_MISMATCH',
      { actor_type: 'agent', client: 'human', machine_label: 'machine' },
    ],
    ['PCP_REGISTRATION_MACHINE_LABEL_INVALID', { client: 'codex', machine_label: 'Not A Slug' }],
    [
      'PCP_REGISTRATION_ACTOR_ID_INVALID',
      { client: 'codex', machine_label: 'machine', actor_id: 'codex-machine-short' },
    ],
  ] satisfies Array<[string, RegisterActorInput]>)(
    'rejects invalid identity input with %s',
    (code, input) => {
      expect(() => normalizeActorIdentity(input)).toThrow(
        expect.objectContaining({ code, mutated: false }),
      );
    },
  );

  it('rejects a host name with no portable slug characters', () => {
    expect(() => normalizeMachineLabel('___')).toThrow(
      expect.objectContaining({ code: 'PCP_REGISTRATION_MACHINE_LABEL_INVALID' }),
    );
  });
});
