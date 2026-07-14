import { appendFile, cp, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse, stringify } from 'yaml';
import { monotonicFactory } from 'ulid';
import { afterEach, describe, expect, it } from 'vitest';

import { validateCanonicalLayer } from '../../src/application/validate-canonical-layer.js';
import { canonicalSourceDigest } from '../../src/infrastructure/canonical-source-digest.js';

const coreTemplate = fileURLToPath(new URL('../../templates/core/.pcp/', import.meta.url));
const temporaryRoots: string[] = [];
const agentId = 'codex-test-machine-0123456789';
const humanId = 'human-test-machine-9876543210';
const eventId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function arrayValue(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

async function createProject(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'pcp-canonical-'));
  temporaryRoots.push(root);
  await cp(coreTemplate, path.join(root, '.pcp'), { recursive: true });
  return root;
}

async function readYamlObject(file: string): Promise<Record<string, unknown>> {
  return objectValue(parse(await readFile(file, 'utf8')) as unknown, file);
}

async function writeYamlObject(file: string, value: Record<string, unknown>): Promise<void> {
  await writeFile(file, stringify(value), 'utf8');
}

function diagnosticCodes(report: Awaited<ReturnType<typeof validateCanonicalLayer>>): string[] {
  return report.diagnostics.map((diagnostic) => diagnostic.code);
}

async function writeActor(
  root: string,
  actorId = agentId,
  actorType: 'agent' | 'human' = 'agent',
  fileName = `${actorId}.yaml`,
): Promise<void> {
  await writeFile(
    path.join(root, '.pcp', 'continuity', 'actors', fileName),
    stringify({
      schema_version: 1,
      actor_id: actorId,
      actor_type: actorType,
      client: actorType === 'human' ? 'human' : 'codex',
      machine_label: 'test-machine',
      first_seen: '2026-07-12T13:00:00Z',
      checkpoint_paths: [],
    }),
    'utf8',
  );
}

async function writeEvent(
  root: string,
  options: {
    id?: string;
    fileName?: string;
    directory?: 'events' | 'archive';
    actor?: { type: 'human' | 'agent' | 'system'; id: string };
    recordedBy?: { type: 'human' | 'agent' | 'system'; id: string };
    basis?: 'self' | 'reported' | 'observed' | 'system';
    kind?: 'code' | 'vcs';
    rationale?: string;
  } = {},
): Promise<void> {
  const id = options.id ?? eventId;
  const actor = options.actor ?? { type: 'agent', id: agentId };
  const recordedBy = options.recordedBy ?? actor;
  const event = {
    schema_version: 1,
    event_id: id,
    occurred_at: '2026-07-12T13:05:00Z',
    actor,
    recorded_by: recordedBy,
    basis: options.basis ?? 'self',
    kind: options.kind ?? 'code',
    scopes: ['core'],
    workstreams: [],
    summary: 'Validated a canonical fixture.',
    ...(options.rationale === undefined ? {} : { rationale: options.rationale }),
    affected_paths: ['state/project.yaml'],
  };
  await writeFile(
    path.join(
      root,
      '.pcp',
      'continuity',
      options.directory ?? 'events',
      options.fileName ?? `${id}.yaml`,
    ),
    stringify(event),
    'utf8',
  );
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('installed canonical layer validation', () => {
  it('accepts the clean core template', async () => {
    const report = await validateCanonicalLayer(await createProject(), { clean_genesis: true });

    expect(report.valid).toBe(true);
    expect(report.checked_files).toBeGreaterThan(30);
    expect(report.diagnostics).toEqual([]);
  });

  it('rejects a structurally incomplete canonical core', async () => {
    const root = await createProject();
    await rm(path.join(root, '.pcp', 'state', 'project.yaml'));

    expect(diagnosticCodes(await validateCanonicalLayer(root))).toContain('layer.required-path');
  });

  it('rejects machine paths, file URIs, and secret material', async () => {
    const root = await createProject();
    const privateFileUri = ['file:', '///C:/Users/example/private.md'].join('');
    await appendFile(
      path.join(root, '.pcp', 'knowledge', '10-overview.md'),
      `\n[Private notes](${privateFileUri})\n\ntoken=ghp_abcdefghijklmnopqrstuvwxyz1234567890\n`,
      'utf8',
    );

    const codes = diagnosticCodes(await validateCanonicalLayer(root));
    expect(codes).toContain('link.file-uri');
    expect(codes).toContain('path.absolute-text');
    expect(codes).toContain('secret.github-token');
  });

  it('rejects duplicate project identities that are structurally different', async () => {
    const root = await createProject();
    const file = path.join(root, '.pcp', 'state', 'projects.yaml');
    const registry = await readYamlObject(file);
    registry.projects = [
      {
        schema_version: 1,
        project_id: 'pending-project',
        name: 'Duplicate project identity',
        purpose: 'Prove semantic identity validation.',
        project_type: 'other',
        lifecycle: 'seed',
        artifact_roots: ['.'],
        context_roots: ['.pcp'],
        repositories: [],
        tags: [],
      },
    ];
    await writeYamlObject(file, registry);

    expect(diagnosticCodes(await validateCanonicalLayer(root))).toContain(
      'identity.duplicate-project',
    );
  });

  it('rejects dependency cycles and unsupported completion claims', async () => {
    const root = await createProject();
    const file = path.join(root, '.pcp', 'state', 'workstreams.yaml');
    await writeYamlObject(file, {
      schema_version: 1,
      workstreams: [
        {
          workstream_id: 'alpha',
          name: 'Alpha',
          kind: 'concurrent',
          status: 'complete',
          paths: [],
          areas: [],
          dependencies: ['beta'],
          completion: { criteria: ['Validated.'], evidence: [] },
        },
        {
          workstream_id: 'beta',
          name: 'Beta',
          kind: 'concurrent',
          status: 'active',
          paths: [],
          areas: [],
          dependencies: ['alpha'],
          completion: { criteria: ['Validated.'], evidence: [] },
        },
      ],
    });

    const codes = diagnosticCodes(await validateCanonicalLayer(root));
    expect(codes).toContain('workstream.dependency-cycle');
    expect(codes).toContain('workstream.completion-without-evidence');
  });

  it('rejects duplicate actor identities and filename drift', async () => {
    const root = await createProject();
    await writeActor(root, agentId, 'agent', 'first.yaml');
    await writeActor(root, agentId, 'agent', 'second.yaml');

    const codes = diagnosticCodes(await validateCanonicalLayer(root));
    expect(codes).toContain('identity.duplicate-actor');
    expect(codes).toContain('identity.actor-filename-mismatch');
  });

  it('rejects invalid event ULIDs before semantic processing', async () => {
    const root = await createProject();
    await writeEvent(root, { id: 'not-a-ulid' });

    const report = await validateCanonicalLayer(root);
    expect(report.valid).toBe(false);
    expect(
      report.diagnostics.some((item) => item.path.startsWith('continuity/events/not-a-ulid')),
    ).toBe(true);
    expect(diagnosticCodes(report)).toContain('schema.pattern');
  });

  it('checks immutable event filenames and recording basis', async () => {
    const root = await createProject();
    await writeActor(root);
    await writeActor(root, humanId, 'human');
    await writeEvent(root, {
      fileName: 'mismatched.yaml',
      recordedBy: { type: 'human', id: humanId },
      basis: 'self',
    });

    const codes = diagnosticCodes(await validateCanonicalLayer(root));
    expect(codes).toContain('event.filename-mismatch');
    expect(codes).toContain('event.self-recorder-mismatch');
  });

  it('accepts minimal human-reported VCS events and requires a durable human identity', async () => {
    const root = await createProject();
    await writeActor(root);
    await writeActor(root, humanId, 'human');
    await writeEvent(root, {
      actor: { type: 'human', id: humanId },
      recordedBy: { type: 'agent', id: agentId },
      basis: 'reported',
      kind: 'vcs',
    });

    expect((await validateCanonicalLayer(root)).valid).toBe(true);

    await rm(path.join(root, '.pcp', 'continuity', 'actors', `${humanId}.yaml`));
    expect(diagnosticCodes(await validateCanonicalLayer(root))).toContain('event.unknown-actor');
  });

  it('rejects invalid reading order and orphan Markdown', async () => {
    const root = await createProject();
    await writeFile(
      path.join(root, '.pcp', 'knowledge', '15-unlisted.md'),
      `---
doc: knowledge/15-unlisted.md
type: knowledge
status: static
version: 1.0.0
last_updated: 2026-07-12T13:00:00Z
ownership: project
---

# Unlisted
`,
      'utf8',
    );

    const codes = diagnosticCodes(await validateCanonicalLayer(root));
    expect(codes).toContain('markdown.increment');
    expect(codes).toContain('index.unlisted-document');
    expect(codes).toContain('markdown.orphan');
  });

  it('rejects manifest ownership collisions', async () => {
    const root = await createProject();
    const file = path.join(root, '.pcp', 'pcp.yaml');
    const manifest = await readYamlObject(file);
    const ownership = objectValue(manifest.ownership, 'ownership');
    arrayValue(ownership.project, 'ownership.project').push('protocol/**');
    await writeYamlObject(file, manifest);

    expect(diagnosticCodes(await validateCanonicalLayer(root))).toContain('ownership.collision');
  });

  it('accepts a marked current projection and detects source drift', async () => {
    const root = await createProject();
    const layer = path.join(root, '.pcp');
    const digest = await canonicalSourceDigest(layer, ['state/project.yaml']);
    await writeFile(
      path.join(layer, 'views', '20-project.generated.md'),
      `---
doc: views/20-project.generated.md
type: generated
status: generated
version: 1.0.0
last_updated: 2026-07-12T13:00:00Z
ownership: generated
sources:
  - state/project.yaml
source_digest: ${digest}
---

<!-- PCP: GENERATED; DO NOT EDIT -->

# Project
`,
      'utf8',
    );
    await appendFile(
      path.join(layer, 'views', '00-index.md'),
      '\n2. [20-project.generated.md](20-project.generated.md) — current project view.\n',
      'utf8',
    );

    expect((await validateCanonicalLayer(root)).valid).toBe(true);

    const projectFile = path.join(layer, 'state', 'project.yaml');
    const project = await readYamlObject(projectFile);
    project.purpose = 'Changed canonical purpose.';
    await writeYamlObject(projectFile, project);

    expect(diagnosticCodes(await validateCanonicalLayer(root))).toContain('generated.stale');
  });

  it('rejects an editable generated view even with schema-valid metadata', async () => {
    const root = await createProject();
    const layer = path.join(root, '.pcp');
    await writeFile(
      path.join(layer, 'views', '20-project.generated.md'),
      `---
doc: views/20-project.generated.md
type: generated
status: generated
version: 1.0.0
last_updated: 2026-07-12T13:00:00Z
ownership: generated
sources:
  - state/project.yaml
source_digest: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
---

# Editable projection
`,
      'utf8',
    );
    await appendFile(
      path.join(layer, 'views', '00-index.md'),
      '\n2. [20-project.generated.md](20-project.generated.md) — current project view.\n',
      'utf8',
    );

    const codes = diagnosticCodes(await validateCanonicalLayer(root));
    expect(codes).toContain('generated.editable');
    expect(codes).toContain('generated.stale');
  });

  it('validates checkpoint references against durable identities and state', async () => {
    const root = await createProject();
    const checkpointId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
    const directory = path.join(root, '.pcp', 'continuity', 'checkpoints');
    await writeFile(
      path.join(directory, `${checkpointId}.yaml`),
      stringify({
        schema_version: 1,
        checkpoint_id: checkpointId,
        actor_id: agentId,
        workstream_id: 'missing-workstream',
        last_event_id: eventId,
        reconciled_at: '2026-07-12T13:10:00Z',
        scopes: [],
        dependencies: [],
      }),
      'utf8',
    );

    const codes = diagnosticCodes(await validateCanonicalLayer(root));
    expect(codes).toContain('checkpoint.unknown-actor');
    expect(codes).toContain('checkpoint.unknown-workstream');
    expect(codes).toContain('checkpoint.unknown-event');
  });

  it('fails closed when a policy assigns credential management to an agent', async () => {
    const root = await createProject();
    const file = path.join(root, '.pcp', 'state', 'vcs-policy.yaml');
    const policy = await readYamlObject(file);
    policy.mode = 'custom';
    policy.provider = 'github';
    objectValue(policy.responsibilities, 'responsibilities').manage_credentials = 'agent';
    await writeYamlObject(file, policy);

    expect(diagnosticCodes(await validateCanonicalLayer(root))).toContain(
      'vcs.agent-credential-management',
    );
  });

  it('enforces clean genesis without rejecting valid managed history', async () => {
    const root = await createProject();
    await writeActor(root);
    await writeEvent(root);

    expect((await validateCanonicalLayer(root)).valid).toBe(true);
    const cleanGenesis = await validateCanonicalLayer(root, { clean_genesis: true });
    expect(diagnosticCodes(cleanGenesis)).toContain('genesis.actor-profile');
    expect(diagnosticCodes(cleanGenesis)).toContain('genesis.event');
  });

  it('bounds active history and accepts a 32-event archive rotation', async () => {
    const root = await createProject();
    await writeActor(root);
    const nextUlid = monotonicFactory();
    const ids: string[] = [];
    for (let index = 0; index < 65; index += 1) {
      const id = nextUlid(1_720_000_000_000);
      ids.push(id);
      await writeEvent(root, { id });
    }

    expect(diagnosticCodes(await validateCanonicalLayer(root))).toContain(
      'continuity.active-event-limit',
    );

    for (const id of ids.slice(0, 32)) {
      await rename(
        path.join(root, '.pcp', 'continuity', 'events', `${id}.yaml`),
        path.join(root, '.pcp', 'continuity', 'archive', `${id}.yaml`),
      );
    }
    expect((await validateCanonicalLayer(root)).valid).toBe(true);
  });
});
