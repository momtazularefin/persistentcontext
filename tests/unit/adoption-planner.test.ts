import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { isPlanMaterial, planAdoption } from '../../src/application/plan-adoption.js';
import { inspectRepository } from '../../src/application/inspect-repository.js';
import type { AdoptionDocumentInput, AdoptionInput } from '../../src/domain/adoption.js';

const fixtureRoot = fileURLToPath(new URL('../fixtures/inspection/', import.meta.url));
const temporaryRoots: string[] = [];

async function temporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const documentDefinitions = [
  ['knowledge/10-overview.md', 'knowledge', 'static', 'Project overview'],
  ['knowledge/20-architecture.md', 'knowledge', 'static', 'Architecture'],
  ['knowledge/30-source-map.md', 'knowledge', 'static', 'Source map'],
  ['knowledge/40-build-and-tooling.md', 'knowledge', 'static', 'Build and tooling'],
  ['knowledge/50-domain-and-invariants.md', 'knowledge', 'static', 'Domain and invariants'],
  ['operations/10-working-agreement.md', 'policy', 'living', 'Working agreement'],
  ['operations/20-plan.md', 'plan', 'living', 'Project plan'],
  ['operations/30-decisions.md', 'policy', 'living', 'Decision ledger'],
] as const;

function documents(evidencePath?: string): AdoptionDocumentInput[] {
  return documentDefinitions.map(([documentPath, type, status, title]) => ({
    path: documentPath,
    type,
    status,
    basis: evidencePath === undefined ? 'user' : 'repository',
    evidence_paths: evidencePath === undefined ? [] : [evidencePath],
    body: `# ${title}\n\nThis baseline is grounded for the fixture under test.`,
  }));
}

function noneVcsPolicy(): Record<string, unknown> {
  const prohibited = {
    initialize: 'prohibited',
    create_repository: 'prohibited',
    configure_remote: 'prohibited',
    configure_protection: 'prohibited',
    sync_default: 'prohibited',
    create_branch: 'prohibited',
    stage: 'prohibited',
    commit: 'prohibited',
    push: 'prohibited',
    open_pull_request: 'prohibited',
    repair_ci: 'prohibited',
    review_pull_request: 'prohibited',
    merge_pull_request: 'prohibited',
    cleanup_branch: 'prohibited',
    tag: 'prohibited',
    release: 'prohibited',
    force_push: 'prohibited',
    rewrite_history: 'prohibited',
    destructive_recovery: 'prohibited',
    manage_credentials: 'prohibited',
  };
  return {
    schema_version: 1,
    mode: 'none',
    system: 'none',
    provider: 'none',
    repository: { remote_name: 'none', default_branch: 'main' },
    responsibilities: prohibited,
    workflow: {
      branch_pattern: 'disabled',
      commit_convention: 'none',
      commit_signing: 'none',
      push_cadence: 'never',
      pull_request_policy: 'none',
      human_merge_required: false,
      post_merge: [],
    },
  };
}

function adoptionInput(options: {
  projectType: AdoptionInput['project']['project_type'];
  evidencePath?: string;
  scaffold?: AdoptionInput['scaffold_files'];
}): AdoptionInput {
  return {
    schema_version: 1,
    baseline_at: '2026-07-13T09:45:00Z',
    capabilities: [],
    persistence: 'tracked',
    project: {
      schema_version: 1,
      project_id: 'fixture-project',
      name: 'Fixture project',
      purpose: 'Exercise deterministic and grounded PCP adoption.',
      project_type: options.projectType,
      lifecycle: options.evidencePath === undefined ? 'seed' : 'active',
      artifact_roots: ['.'],
      context_roots: ['.pcp'],
      documentation_root: 'docs',
      documentation_root_source: 'default',
      repositories: [],
      tags: [],
    },
    projects: { schema_version: 1, projects: [] },
    documentation: {
      schema_version: 1,
      documents: [
        {
          path: 'docs/README.md',
          project_id: 'fixture-project',
          category: 'outcome',
          status: 'living',
          summary: 'Introduces the project outcome documentation set.',
          related_paths: options.evidencePath === undefined ? [] : [options.evidencePath],
        },
        ...(options.evidencePath !== undefined &&
        /\.(?:adoc|md|mdx|rst|txt)$/u.test(options.evidencePath)
          ? [
              {
                path: options.evidencePath,
                project_id: 'fixture-project',
                category: 'reference' as const,
                status: 'living' as const,
                summary: 'Existing project document used as adoption evidence.',
                related_paths: [],
              },
            ]
          : []),
      ],
    },
    workstreams: { schema_version: 1, workstreams: [] },
    vcs_policy: noneVcsPolicy(),
    documents: documents(options.evidencePath),
    outcome_documents: [
      {
        path: 'docs/README.md',
        project_id: 'fixture-project',
        status: 'living',
        basis: 'user',
        evidence_paths: [],
        body: '# Project documentation\n\nOutcome knowledge for the fixture project.',
      },
    ],
    scaffold_files: options.scaffold ?? [],
  };
}

async function writeInput(value: AdoptionInput): Promise<string> {
  const root = await temporaryRoot('pcp-adoption-input-');
  const target = path.join(root, 'adoption.json');
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return target;
}

describe('State A and State B adoption planning', () => {
  it('returns structured indispensable questions for an empty State A candidate', async () => {
    const candidate = await temporaryRoot('pcp-empty-seed-');
    const before = await inspectRepository(candidate);
    const result = await planAdoption(candidate);
    const after = await inspectRepository(candidate);

    expect(result).toMatchObject({
      classification: 'A',
      applicable: false,
      mutated: false,
    });
    expect('questions' in result ? result.questions.map((question) => question.id) : []).toEqual(
      expect.arrayContaining([
        'project-identity',
        'software-stack',
        'initial-scaffold',
        'capability-selection',
      ]),
    );
    const vcsQuestion =
      'questions' in result
        ? result.questions.find((question) => question.id === 'vcs-profile')
        : undefined;
    expect(vcsQuestion?.options?.[0]).toBe('human-commit');
    expect(after.inventory.digest).toBe(before.inventory.digest);
  });

  it('emits grounded State B evidence inputs without inventing semantic content', async () => {
    const result = await planAdoption(path.join(fixtureRoot, 'conventional'));
    expect(result).toMatchObject({ classification: 'B', applicable: false, mutated: false });
    if (isPlanMaterial(result)) throw new Error('Expected a semantic-input preview.');

    expect(result.baseline.evidence_groups).toContainEqual({
      category: 'inventory',
      paths: ['package.json', 'src/index.ts'],
    });
    expect(result.baseline.required_documents).toHaveLength(8);
    expect(result.questions.map((question) => question.id)).toEqual([
      'grounded-baseline',
      'vcs-profile',
      'capability-selection',
      'documentation-boundary',
    ]);
    expect(result.questions[1]?.options?.[0]).toBe('human-commit');
  });

  it('builds a stable preview-only State B mutation plan from cited semantic input', async () => {
    const candidate = path.join(fixtureRoot, 'conventional');
    const input = await writeInput(
      adoptionInput({ projectType: 'software', evidencePath: 'package.json' }),
    );
    const before = await inspectRepository(candidate);
    const [first, second] = await Promise.all([
      planAdoption(candidate, input),
      planAdoption(candidate, input),
    ]);
    if (!isPlanMaterial(first) || !isPlanMaterial(second)) {
      throw new Error('Expected applicable adoption plans.');
    }

    expect(first.preview.plan).toEqual(second.preview.plan);
    expect(first.preview.plan.plan_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.preview.plan.operations.length).toBeGreaterThan(30);
    const adapterPaths = first.preview.adapters?.map((adapter) => adapter.target_path) ?? [];
    expect(adapterPaths).toEqual([
      'AGENTS.md',
      '.agents/rules/pcp.md',
      'CLAUDE.md',
      '.github/copilot-instructions.md',
      '.cursor/rules/pcp.mdc',
    ]);
    const adapterPlanPaths = new Set(adapterPaths);
    for (const target of adapterPaths) {
      let parent = path.posix.dirname(target);
      while (parent !== '.') {
        adapterPlanPaths.add(parent);
        parent = path.posix.dirname(parent);
      }
    }
    expect(
      first.preview.plan.operations.every(
        (operation) =>
          operation.path.startsWith('.pcp') ||
          operation.path === 'docs' ||
          operation.path === 'docs/README.md' ||
          adapterPlanPaths.has(operation.path),
      ),
    ).toBe(true);
    expect((await inspectRepository(candidate)).inventory.digest).toBe(before.inventory.digest);
  });

  it('distinguishes ordinary planning language from standalone template placeholders', async () => {
    const candidate = path.join(fixtureRoot, 'conventional');
    const grounded = adoptionInput({ projectType: 'software', evidencePath: 'package.json' });
    grounded.documents[6] = {
      ...grounded.documents[6]!,
      body: '# Project plan\n\nInitiate other pending project and preparation tracks as capacity permits.',
    };
    expect(isPlanMaterial(await planAdoption(candidate, await writeInput(grounded)))).toBe(true);

    const placeholder = structuredClone(grounded);
    placeholder.documents[6] = {
      ...placeholder.documents[6]!,
      body: '# Project plan\n\nPending project state',
    };
    await expect(planAdoption(candidate, await writeInput(placeholder))).rejects.toMatchObject({
      code: 'PCP_ADOPTION_INPUT_INVALID',
    });
  });

  it('installs explicitly selected capabilities in canonical order', async () => {
    const candidate = path.join(fixtureRoot, 'conventional');
    const value = adoptionInput({ projectType: 'software', evidencePath: 'package.json' });
    value.capabilities = ['walkthroughs', 'spec-driven-projects', 'scratch-space'];
    value.documentation.documents.push({
      path: 'scratch/README.md',
      project_id: 'fixture-project',
      category: 'reference',
      status: 'static',
      summary: 'Explains the optional noncanonical scratch workspace.',
      related_paths: [],
    });
    const result = await planAdoption(candidate, await writeInput(value));
    if (!isPlanMaterial(result)) throw new Error('Expected an applicable capability plan.');

    expect(
      parse(result.content_by_path.get('.pcp/pcp.yaml')?.toString('utf8') ?? ''),
    ).toMatchObject({
      capabilities: ['scratch-space', 'spec-driven-projects', 'walkthroughs'],
    });
    for (const installedPath of [
      '.pcp/protocol/80-spec-driven-delivery.md',
      '.pcp/protocol/100-scratch-space.md',
      '.pcp/protocol/110-walkthrough-creation.md',
      '.pcp/templates/30-project-spec.md',
      '.pcp/templates/50-walkthrough.md',
      'scratch/README.md',
    ]) {
      expect(result.content_by_path.has(installedPath), installedPath).toBe(true);
    }
    const protocolIndex = result.content_by_path.get('.pcp/protocol/00-index.md')?.toString('utf8');
    expect(protocolIndex).toContain('[80-spec-driven-delivery.md](80-spec-driven-delivery.md)');
    expect(protocolIndex).toContain('[100-scratch-space.md](100-scratch-space.md)');
    expect(protocolIndex).toContain('[110-walkthrough-creation.md](110-walkthrough-creation.md)');
  });

  it('uses an established documentation directory without creating a replacement baseline', async () => {
    const candidate = path.join(fixtureRoot, 'docs-heavy');
    const value = adoptionInput({
      projectType: 'writing',
      evidencePath: 'docs/architecture.md',
    });
    value.project.documentation_root = 'docs';
    value.project.documentation_root_source = 'existing';
    value.outcome_documents = [];
    value.documentation.documents = [
      'docs/architecture.md',
      'docs/field-guide.md',
      'docs/publishing.md',
    ].map((documentPath) => ({
      path: documentPath,
      project_id: 'fixture-project',
      category: 'outcome' as const,
      status: 'living' as const,
      summary: `Tracks ${documentPath}.`,
      related_paths: [],
    }));

    const result = await planAdoption(candidate, await writeInput(value));
    if (!isPlanMaterial(result)) throw new Error('Expected an applicable documented plan.');
    expect(result.preview.baseline.documentation).toMatchObject({
      recommended_root: 'docs',
      recommended_root_source: 'existing',
    });
    expect(result.preview.plan.operations).not.toContainEqual(
      expect.objectContaining({ path: 'docs/README.md' }),
    );
  });

  it('rejects a primary documentation root that contradicts inspection', async () => {
    const candidate = path.join(fixtureRoot, 'conventional');
    const value = adoptionInput({ projectType: 'software', evidencePath: 'package.json' });
    value.project.documentation_root = 'src';
    value.project.documentation_root_source = 'existing';

    await expect(planAdoption(candidate, await writeInput(value))).rejects.toMatchObject({
      code: 'PCP_DOCUMENTATION_ROOT_SELECTION_INVALID',
    });
  });

  it('stages project-outcome knowledge under the external documentation root', async () => {
    const candidate = path.join(fixtureRoot, 'conventional');
    const value = adoptionInput({ projectType: 'software', evidencePath: 'package.json' });
    value.capabilities = ['spec-driven-projects'];
    value.outcome_documents.push({
      path: 'docs/fixture-specification.md',
      project_id: 'fixture-project',
      status: 'living',
      basis: 'repository',
      evidence_paths: ['package.json'],
      body: '# Fixture specification\n\nThe accepted outcome remains intentionally incomplete.',
    });
    value.documentation.documents.push({
      path: 'docs/fixture-specification.md',
      project_id: 'fixture-project',
      category: 'outcome',
      status: 'living',
      summary: 'Defines the fixture project outcome.',
      related_paths: ['package.json'],
    });

    const result = await planAdoption(candidate, await writeInput(value));
    if (!isPlanMaterial(result)) throw new Error('Expected an applicable project-document plan.');

    expect(result.content_by_path.get('docs/fixture-specification.md')?.toString('utf8')).toBe(
      '# Fixture specification\n\nThe accepted outcome remains intentionally incomplete.\n',
    );
    expect(result.content_by_path.has('.pcp/projects/fixture-project/10-specification.md')).toBe(
      false,
    );
    expect(
      parse(result.content_by_path.get('.pcp/state/documentation.yaml')?.toString('utf8') ?? ''),
    ).toMatchObject({
      documents: [
        expect.objectContaining({ path: 'docs/README.md', category: 'outcome' }),
        expect.objectContaining({ path: 'docs/fixture-specification.md', category: 'outcome' }),
      ],
    });
  });

  it('rejects outcome documents outside their configured root or project registry', async () => {
    const candidate = path.join(fixtureRoot, 'conventional');
    const value = adoptionInput({ projectType: 'software', evidencePath: 'package.json' });
    value.outcome_documents.push({
      path: 'fixture-specification.md',
      project_id: 'fixture-project',
      status: 'living',
      basis: 'repository',
      evidence_paths: ['package.json'],
      body: '# Fixture specification\n\nGrounded project detail.',
    });
    await expect(planAdoption(candidate, await writeInput(value))).rejects.toMatchObject({
      code: 'PCP_OUTCOME_DOCUMENT_PATH_INVALID',
    });

    value.outcome_documents[1] = {
      ...value.outcome_documents[1]!,
      path: 'docs/fixture-specification.md',
      project_id: 'unknown-project',
    };
    await expect(planAdoption(candidate, await writeInput(value))).rejects.toMatchObject({
      code: 'PCP_ADOPTION_INPUT_INVALID',
    });
  });

  it('plans an explicit non-software State A scaffold while preserving the seed boundary', async () => {
    const candidate = await temporaryRoot('pcp-research-seed-');
    const value = adoptionInput({
      projectType: 'research',
      scaffold: [
        { path: 'README.md', content: '# Research notebook\n' },
        { path: 'notes/00-index.md', content: '# Notes\n' },
      ],
    });
    value.documentation.documents.push(
      {
        path: 'README.md',
        project_id: 'fixture-project',
        category: 'reference',
        status: 'living',
        summary: 'Introduces the research notebook.',
        related_paths: [],
      },
      {
        path: 'notes/00-index.md',
        project_id: 'fixture-project',
        category: 'reference',
        status: 'living',
        summary: 'Indexes the research notes.',
        related_paths: [],
      },
    );
    const input = await writeInput(value);
    const result = await planAdoption(candidate, input);
    if (!isPlanMaterial(result)) throw new Error('Expected an applicable State A plan.');

    expect(result.preview.classification).toBe('A');
    expect(result.preview.plan.operations).toContainEqual(
      expect.objectContaining({ action: 'write', path: 'README.md' }),
    );
    expect(result.preview.plan.operations).toContainEqual(
      expect.objectContaining({ action: 'write', path: 'notes/00-index.md' }),
    );
    expect((await inspectRepository(candidate)).inventory.files).toEqual([]);
  });

  it('rejects State B scaffold writes and uncited repository evidence', async () => {
    const candidate = path.join(fixtureRoot, 'conventional');
    const scaffoldInput = adoptionInput({
      projectType: 'software',
      evidencePath: 'package.json',
      scaffold: [{ path: 'extra.txt', content: 'not allowed' }],
    });
    await expect(planAdoption(candidate, await writeInput(scaffoldInput))).rejects.toMatchObject({
      code: 'PCP_STATE_B_SCAFFOLD_FORBIDDEN',
    });

    const missingEvidence = adoptionInput({
      projectType: 'software',
      evidencePath: 'missing.txt',
    });
    await expect(planAdoption(candidate, await writeInput(missingEvidence))).rejects.toMatchObject({
      code: 'PCP_ADOPTION_EVIDENCE_MISSING',
    });

    const userOnlyKnowledge = adoptionInput({
      projectType: 'software',
      evidencePath: 'package.json',
    });
    userOnlyKnowledge.documents[0] = {
      ...userOnlyKnowledge.documents[0]!,
      basis: 'user',
      evidence_paths: [],
    };
    await expect(
      planAdoption(candidate, await writeInput(userOnlyKnowledge)),
    ).rejects.toMatchObject({ code: 'PCP_ADOPTION_INPUT_INVALID' });

    const stateCCoverage = adoptionInput({
      projectType: 'software',
      evidencePath: 'package.json',
    });
    stateCCoverage.coverage = {
      schema_version: 1,
      coverage_id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      source_inventory_digest: 'a'.repeat(64),
      foreign_roots: [
        { root: '.', disposition: 'translate', evidence: ['Reviewed test fixture.'] },
      ],
      records: [],
      unresolved_count: 0,
    };
    await expect(planAdoption(candidate, await writeInput(stateCCoverage))).rejects.toMatchObject({
      code: 'PCP_STATE_C_COVERAGE_FORBIDDEN',
    });
  });

  it('rejects State C coverage attached to State A input', async () => {
    const candidate = await temporaryRoot('pcp-state-a-coverage-');
    const input = adoptionInput({
      projectType: 'research',
      scaffold: [{ path: 'README.md', content: '# Research notebook\n' }],
    });
    input.coverage = {
      schema_version: 1,
      coverage_id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      source_inventory_digest: 'a'.repeat(64),
      foreign_roots: [
        { root: '.', disposition: 'translate', evidence: ['Reviewed test fixture.'] },
      ],
      records: [],
      unresolved_count: 0,
    };
    await expect(planAdoption(candidate, await writeInput(input))).rejects.toMatchObject({
      code: 'PCP_STATE_C_COVERAGE_FORBIDDEN',
    });
  });

  it('rejects excluded, case-colliding, nonportable, and secret-bearing State A scaffold paths', async () => {
    const candidate = await temporaryRoot('pcp-scaffold-boundary-');
    await writeFile(
      path.join(candidate, 'README.md'),
      '# Seed\n\nAn explicit project description.\n',
      'utf8',
    );
    await writeFile(path.join(candidate, '.gitignore'), 'private/\n', 'utf8');

    const cases = [
      {
        file: { path: '.git/config', content: 'unsafe\n' },
        code: 'PCP_ADOPTION_PATH_BOUNDARY',
      },
      {
        file: { path: 'node_modules/generated.js', content: 'unsafe\n' },
        code: 'PCP_ADOPTION_PATH_BOUNDARY',
      },
      {
        file: { path: 'private/generated.txt', content: 'unsafe\n' },
        code: 'PCP_ADOPTION_PATH_BOUNDARY',
      },
      {
        file: { path: 'AGENTS.md', content: '# Independent instructions\n' },
        code: 'PCP_ADOPTION_PATH_BOUNDARY',
      },
      {
        file: { path: 'readme.md', content: 'collision\n' },
        code: 'PCP_ADOPTION_PATH_COLLISION',
      },
      {
        file: { path: 'CON.txt', content: 'nonportable\n' },
        code: 'PCP_ADOPTION_PATH_NONPORTABLE',
      },
      {
        file: {
          path: 'config.txt',
          content: '-----BEGIN PRIVATE KEY-----\nnot-real-but-never-scaffold-this\n',
        },
        code: 'PCP_ADOPTION_SCAFFOLD_SECRET',
      },
      {
        file: {
          path: 'credentials.txt',
          content: 'api_key = abcdefghijklmnopqrstuvwxyz\n',
        },
        code: 'PCP_ADOPTION_SCAFFOLD_SECRET',
      },
    ];

    for (const fixtureCase of cases) {
      const input = adoptionInput({
        projectType: 'software',
        evidencePath: 'README.md',
        scaffold: [fixtureCase.file],
      });
      await expect(planAdoption(candidate, await writeInput(input))).rejects.toMatchObject({
        code: fixtureCase.code,
      });
    }
  });

  it('requires local persistence to be covered by existing candidate ignore policy', async () => {
    const candidate = await temporaryRoot('pcp-local-persistence-');
    await writeFile(
      path.join(candidate, 'README.md'),
      '# Local project\n\nA private local-context seed.\n',
      'utf8',
    );
    await writeFile(path.join(candidate, '.gitignore'), 'private/\n', 'utf8');
    const input = adoptionInput({ projectType: 'writing', evidencePath: 'README.md' });
    input.persistence = 'local';
    const inputPath = await writeInput(input);

    await expect(planAdoption(candidate, inputPath)).rejects.toMatchObject({
      code: 'PCP_LOCAL_PERSISTENCE_NOT_IGNORED',
    });

    await writeFile(path.join(candidate, '.gitignore'), 'private/\n.pcp/pcp.yaml\n', 'utf8');
    await expect(planAdoption(candidate, inputPath)).rejects.toMatchObject({
      code: 'PCP_LOCAL_PERSISTENCE_NOT_IGNORED',
    });

    await writeFile(path.join(candidate, '.gitignore'), 'private/\n.pcp/\n', 'utf8');
    const result = await planAdoption(candidate, inputPath);
    expect(isPlanMaterial(result)).toBe(true);
  });
});
