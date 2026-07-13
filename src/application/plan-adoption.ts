import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { parse, parseDocument, stringify } from 'yaml';

import {
  ADOPTION_SCHEMA_VERSION,
  AdoptionError,
  REQUIRED_ADOPTION_DOCUMENTS,
  createMutationPlan,
  normalizeText,
  sha256,
  type AdoptionBaseline,
  type AdoptionDocumentInput,
  type AdoptionInput,
  type AdoptionPlanMaterial,
  type AdoptionPreview,
  type AdoptionQuestion,
} from '../domain/adoption.js';
import { comparePortablePaths, type InspectionResult } from '../domain/inspection.js';
import { loadCoreTemplateFiles } from '../infrastructure/adoption-assets.js';
import {
  isMutationDirectoryIgnored,
  isMutationPathIgnored,
  mutationPathExclusion,
  resolveCandidateRoot,
  toPortablePath,
} from '../infrastructure/filesystem-inventory.js';
import { SchemaRegistry } from '../infrastructure/schema-validator.js';
import { renderCanonicalViews } from './render-canonical-views.js';
import { inspectRepository } from './inspect-repository.js';
import { validateCanonicalLayer } from './validate-canonical-layer.js';

const MAXIMUM_ADOPTION_INPUT_BYTES = 4 * 1_048_576;
const PLACEHOLDER_PATTERN = /replace this baseline|pending project|grounded project purpose/iu;
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
const WINDOWS_FORBIDDEN_CHARACTER = /[<>:"|?*]/u;
const SCAFFOLD_SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/u,
  /\bsk-[A-Za-z0-9_-]{20,}\b/u,
  /\b(?:password|passwd|api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9+/_=-]{12,}/iu,
];

const expectedDocuments = new Map<string, Pick<AdoptionDocumentInput, 'type' | 'status'>>([
  ['knowledge/10-overview.md', { type: 'knowledge', status: 'static' }],
  ['knowledge/20-architecture.md', { type: 'knowledge', status: 'static' }],
  ['knowledge/30-source-map.md', { type: 'knowledge', status: 'static' }],
  ['knowledge/40-build-and-tooling.md', { type: 'knowledge', status: 'static' }],
  ['knowledge/50-domain-and-invariants.md', { type: 'knowledge', status: 'static' }],
  ['operations/10-working-agreement.md', { type: 'policy', status: 'living' }],
  ['operations/20-plan.md', { type: 'plan', status: 'living' }],
  ['operations/30-decisions.md', { type: 'policy', status: 'living' }],
]);

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function portableBasename(root: string): string {
  const normalized = path.basename(root).normalize('NFKD').toLowerCase();
  const slug = normalized
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 63);
  return slug || 'project';
}

function baselineFor(root: string, inspection: InspectionResult): AdoptionBaseline {
  const groups = new Map<string, Set<string>>();
  for (const signal of inspection.signals) {
    const paths = groups.get(signal.category) ?? new Set<string>();
    paths.add(signal.path);
    groups.set(signal.category, paths);
  }
  groups.set('inventory', new Set(inspection.inventory.files.map((file) => file.path)));

  return {
    suggested_project_id: portableBasename(root),
    seed_sources:
      inspection.state === 'A' ? inspection.inventory.files.map((file) => file.path) : [],
    evidence_groups: [...groups.entries()]
      .map(([category, paths]) => ({ category, paths: [...paths].sort(comparePortablePaths) }))
      .sort((left, right) => comparePortablePaths(left.category, right.category)),
    nested_repositories: [...inspection.inventory.nestedRepositories],
    required_documents: REQUIRED_ADOPTION_DOCUMENTS,
    preserves_existing_paths: true,
  };
}

function questionsFor(inspection: InspectionResult): AdoptionQuestion[] {
  if (inspection.state === 'managed') return [];
  if (inspection.state === 'C') {
    return [
      {
        id: 'state-c-coverage',
        prompt: 'Provide complete foreign-context file and history coverage before adoption.',
        reason: 'State C translation and destructive removal require semantic dispositions.',
        required: true,
        response_shape: 'file-set',
      },
    ];
  }
  if (inspection.state === 'B') {
    return [
      {
        id: 'grounded-baseline',
        prompt: 'Synthesize the eight canonical project documents from cited repository evidence.',
        reason:
          'The deterministic engine inventories evidence but must not invent project meaning.',
        required: true,
        response_shape: 'object',
      },
      {
        id: 'vcs-profile',
        prompt: 'Select none, human-owned, agent-managed, or a complete custom VCS policy.',
        reason: 'PCP cannot infer version-control authority from repository presence.',
        required: true,
        response_shape: 'enum',
        options: ['none', 'human-owned', 'agent-managed', 'custom'],
      },
    ];
  }

  const questions: AdoptionQuestion[] = [
    {
      id: 'project-identity',
      prompt: 'Provide the project name, concrete purpose, project type, and lifecycle state.',
      reason: 'A seed title or empty directory does not establish indispensable project meaning.',
      required: true,
      response_shape: 'object',
    },
    {
      id: 'software-stack',
      prompt:
        'If this is software, provide the language, runtime, package manager, license, and deployment choice that actually apply.',
      reason: 'PCP must not invent a software stack or license from a title.',
      required: true,
      response_shape: 'object',
      when: 'project.project_type == software',
    },
    {
      id: 'vcs-profile',
      prompt: 'Select none, human-owned, agent-managed, or a complete custom VCS policy.',
      reason: 'PCP cannot infer version-control authority.',
      required: true,
      response_shape: 'enum',
      options: ['none', 'human-owned', 'agent-managed', 'custom'],
    },
  ];
  if (inspection.inventory.files.length === 0) {
    questions.push({
      id: 'initial-scaffold',
      prompt: 'Provide the minimal project-type-appropriate files to create beside .pcp/.',
      reason:
        'An empty seed needs an explicit scaffold, and PCP does not assume every project is software.',
      required: true,
      response_shape: 'file-set',
    });
  }
  return questions;
}

function previewWithoutPlan(root: string, inspection: InspectionResult): AdoptionPreview {
  return {
    schema_version: ADOPTION_SCHEMA_VERSION,
    command: 'adopt',
    candidate: '.',
    classification: inspection.state,
    confidence: inspection.confidence,
    applicable: false,
    questions: questionsFor(inspection),
    baseline: baselineFor(root, inspection),
    mutated: false,
  };
}

function schemaFailure(diagnostics: Array<{ path: string; message: string }>): AdoptionError {
  const details = diagnostics
    .slice(0, 8)
    .map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`)
    .join('; ');
  return new AdoptionError('PCP_ADOPTION_INPUT_INVALID', `Invalid adoption input: ${details}`);
}

async function loadAdoptionInput(inputPath: string, candidateRoot: string): Promise<AdoptionInput> {
  const resolvedInput = path.resolve(inputPath);
  if (isInside(candidateRoot, resolvedInput)) {
    throw new AdoptionError(
      'PCP_ADOPTION_INPUT_INSIDE_CANDIDATE',
      'Store the transient adoption input outside the candidate project so it cannot become project state.',
    );
  }

  const metadata = await lstat(resolvedInput).catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    throw new AdoptionError(
      'PCP_ADOPTION_INPUT_UNREADABLE',
      `Cannot read adoption input: ${detail}`,
    );
  });
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size > MAXIMUM_ADOPTION_INPUT_BYTES
  ) {
    throw new AdoptionError(
      'PCP_ADOPTION_INPUT_UNSAFE',
      'The adoption input must be a regular non-symlink file no larger than 4 MiB.',
    );
  }

  const document = parseDocument(await readFile(resolvedInput, 'utf8'), {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw new AdoptionError(
      'PCP_ADOPTION_INPUT_INVALID',
      `Invalid adoption input YAML: ${document.errors.map((error) => error.message).join('; ')}`,
    );
  }
  const value: unknown = document.toJS({ mapAsMap: false });
  const validation = new SchemaRegistry().validate('adoption-input', value);
  if (!validation.valid) throw schemaFailure(validation.diagnostics);
  return value as AdoptionInput;
}

function validateDocumentSet(input: AdoptionInput, inspection: InspectionResult): void {
  const paths = input.documents.map((document) => document.path);
  if (new Set(paths).size !== REQUIRED_ADOPTION_DOCUMENTS.length) {
    throw new AdoptionError(
      'PCP_ADOPTION_INPUT_INVALID',
      'Each required canonical adoption document must appear exactly once.',
    );
  }
  for (const requiredPath of REQUIRED_ADOPTION_DOCUMENTS) {
    if (!paths.includes(requiredPath)) {
      throw new AdoptionError(
        'PCP_ADOPTION_INPUT_INVALID',
        `Missing required adoption document: ${requiredPath}`,
      );
    }
  }

  const availableEvidence = new Set([
    ...inspection.inventory.directories,
    ...inspection.inventory.files.map((file) => file.path),
    ...inspection.inventory.nestedRepositories,
  ]);
  for (const document of input.documents) {
    const expected = expectedDocuments.get(document.path);
    if (
      expected === undefined ||
      expected.type !== document.type ||
      expected.status !== document.status
    ) {
      throw new AdoptionError(
        'PCP_ADOPTION_INPUT_INVALID',
        `Document metadata does not match its canonical role: ${document.path}`,
      );
    }
    const body = normalizeText(document.body).trim();
    if (!body.startsWith('# ') || body.startsWith('---') || PLACEHOLDER_PATTERN.test(body)) {
      throw new AdoptionError(
        'PCP_ADOPTION_INPUT_INVALID',
        `Document must contain grounded Markdown without template placeholders: ${document.path}`,
      );
    }
    if (
      (document.basis === 'repository' || document.basis === 'repository-and-user') &&
      document.evidence_paths.length === 0
    ) {
      throw new AdoptionError(
        'PCP_ADOPTION_INPUT_INVALID',
        `Repository-grounded document has no evidence path: ${document.path}`,
      );
    }
    if (
      inspection.state === 'B' &&
      document.type === 'knowledge' &&
      document.basis !== 'repository' &&
      document.basis !== 'repository-and-user'
    ) {
      throw new AdoptionError(
        'PCP_ADOPTION_INPUT_INVALID',
        `State B knowledge must cite current repository evidence: ${document.path}`,
      );
    }
    for (const evidencePath of document.evidence_paths) {
      if (!availableEvidence.has(evidencePath)) {
        throw new AdoptionError(
          'PCP_ADOPTION_EVIDENCE_MISSING',
          `Cited evidence is not in the inspected candidate: ${evidencePath}`,
        );
      }
    }
  }
}

function portableCollisionKey(value: string): string {
  return value.normalize('NFKC').toLowerCase();
}

function assertPortableMutationPath(value: string): void {
  for (const segment of value.split('/')) {
    if (
      segment.length === 0 ||
      segment.endsWith('.') ||
      segment.endsWith(' ') ||
      WINDOWS_RESERVED_NAME.test(segment) ||
      WINDOWS_FORBIDDEN_CHARACTER.test(segment) ||
      [...segment].some((character) => (character.codePointAt(0) ?? 0) <= 31)
    ) {
      throw new AdoptionError(
        'PCP_ADOPTION_PATH_NONPORTABLE',
        `Planned path is not portable across supported platforms: ${value}`,
      );
    }
  }
}

function validateProjectInput(input: AdoptionInput, inspection: InspectionResult): void {
  if (!input.project.context_roots.includes('.pcp')) {
    throw new AdoptionError(
      'PCP_ADOPTION_INPUT_INVALID',
      'Project context_roots must include .pcp.',
    );
  }
  if (inspection.state === 'B' && input.scaffold_files.length > 0) {
    throw new AdoptionError(
      'PCP_STATE_B_SCAFFOLD_FORBIDDEN',
      'State B adoption preserves ordinary project topology and cannot add scaffold files.',
    );
  }
  if (
    inspection.state === 'A' &&
    inspection.inventory.files.length === 0 &&
    input.scaffold_files.length === 0
  ) {
    throw new AdoptionError(
      'PCP_STATE_A_SCAFFOLD_REQUIRED',
      'An empty State A candidate requires an explicit project-type-appropriate scaffold.',
    );
  }
  const scaffoldPaths = input.scaffold_files.map((file) => file.path);
  if (new Set(scaffoldPaths).size !== scaffoldPaths.length) {
    throw new AdoptionError('PCP_ADOPTION_INPUT_INVALID', 'Scaffold paths must be unique.');
  }
  for (const scaffold of input.scaffold_files) {
    const normalized = path.posix.normalize(scaffold.path);
    if (
      scaffold.path === '.' ||
      normalized !== scaffold.path ||
      scaffold.path.endsWith('/') ||
      scaffold.path.startsWith('.pcp/')
    ) {
      throw new AdoptionError('PCP_ADOPTION_PATH_UNSAFE', `Unsafe scaffold path: ${scaffold.path}`);
    }
    assertPortableMutationPath(scaffold.path);
    if (SCAFFOLD_SECRET_PATTERNS.some((pattern) => pattern.test(scaffold.content))) {
      throw new AdoptionError(
        'PCP_ADOPTION_SCAFFOLD_SECRET',
        `Refusing to scaffold secret-like content: ${scaffold.path}`,
      );
    }
  }
}

function renderDocument(document: AdoptionDocumentInput, baselineAt: string): Buffer {
  const frontmatter = stringify(
    {
      doc: document.path,
      type: document.type,
      status: document.status,
      version: '1.0.0',
      last_updated: baselineAt,
      ownership: 'project',
    },
    { lineWidth: 0 },
  ).trimEnd();
  const body = normalizeText(document.body).trim();
  return Buffer.from(`---\n${frontmatter}\n---\n\n${body}\n`, 'utf8');
}

async function writeStageFiles(root: string, files: ReadonlyMap<string, Buffer>): Promise<void> {
  for (const [relativePath, content] of files) {
    const target = path.join(root, ...relativePath.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, { flag: 'wx' });
  }
}

async function collectStageFiles(
  directory: string,
  stageRoot: string,
  result: Map<string, Buffer>,
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => comparePortablePaths(left.name, right.name));
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    const metadata = await lstat(target);
    const relativePath = toPortablePath(path.relative(stageRoot, target));
    if (metadata.isSymbolicLink()) {
      throw new AdoptionError(
        'PCP_ADOPTION_STAGE_INVALID',
        `Staged symlink is forbidden: ${relativePath}`,
      );
    }
    if (metadata.isDirectory()) {
      await collectStageFiles(target, stageRoot, result);
    } else if (metadata.isFile()) {
      result.set(relativePath, await readFile(target));
    }
  }
}

function yamlBuffer(value: unknown): Buffer {
  return Buffer.from(stringify(value, { lineWidth: 0, sortMapEntries: true }), 'utf8');
}

async function stageCanonicalLayer(input: AdoptionInput): Promise<ReadonlyMap<string, Buffer>> {
  const stageRoot = await mkdtemp(path.join(tmpdir(), 'pcp-adoption-preview-'));
  try {
    const template = new Map(await loadCoreTemplateFiles());
    const manifestPath = '.pcp/pcp.yaml';
    const manifestBytes = template.get(manifestPath);
    if (manifestBytes === undefined) {
      throw new AdoptionError('PCP_ADOPTION_ASSETS_MISSING', 'The core manifest asset is missing.');
    }
    const manifest = parse(manifestBytes.toString('utf8')) as Record<string, unknown>;
    manifest.persistence = input.persistence;
    template.set(manifestPath, yamlBuffer(manifest));
    template.set('.pcp/state/project.yaml', yamlBuffer(input.project));
    template.set('.pcp/state/projects.yaml', yamlBuffer(input.projects));
    template.set('.pcp/state/workstreams.yaml', yamlBuffer(input.workstreams));
    template.set('.pcp/state/vcs-policy.yaml', yamlBuffer(input.vcs_policy));
    for (const document of input.documents) {
      template.set(`.pcp/${document.path}`, renderDocument(document, input.baseline_at));
    }

    await writeStageFiles(stageRoot, template);
    const rendering = await renderCanonicalViews(stageRoot);
    if (!rendering.valid) {
      throw new AdoptionError(
        'PCP_ADOPTION_STAGE_INVALID',
        `Unable to render staged canonical views: ${rendering.diagnostics.map((item) => item.message).join('; ')}`,
      );
    }
    const validation = await validateCanonicalLayer(stageRoot, { clean_genesis: true });
    if (!validation.valid) {
      throw new AdoptionError(
        'PCP_ADOPTION_STAGE_INVALID',
        `Staged canonical layer is invalid: ${validation.diagnostics
          .slice(0, 8)
          .map((item) => `${item.path}: ${item.message}`)
          .join('; ')}`,
      );
    }

    const result = new Map<string, Buffer>();
    await collectStageFiles(path.join(stageRoot, '.pcp'), stageRoot, result);
    return result;
  } finally {
    await rm(stageRoot, { recursive: true, force: true });
  }
}

function parentDirectories(relativePath: string): string[] {
  const result: string[] = [];
  let parent = path.posix.dirname(relativePath);
  while (parent !== '.') {
    result.push(parent);
    parent = path.posix.dirname(parent);
  }
  return result;
}

function pathDepth(value: string): number {
  return value.split('/').length;
}

async function assertNoTargetCollisions(
  root: string,
  content: ReadonlyMap<string, Buffer>,
  inspection: InspectionResult,
  persistence: AdoptionInput['persistence'],
): Promise<void> {
  const files = new Set(inspection.inventory.files.map((file) => file.path));
  const directories = new Set(inspection.inventory.directories);
  const symlinks = inspection.inventory.symlinks.map((link) => link.path);
  const existingPathKeys = new Map<string, string>();
  for (const existing of [...files, ...directories, ...symlinks]) {
    existingPathKeys.set(portableCollisionKey(existing), existing);
  }
  const desiredPaths = new Set<string>();
  for (const target of content.keys()) {
    desiredPaths.add(target);
    for (const parent of parentDirectories(target)) desiredPaths.add(parent);
  }
  const desiredPathKeys = new Map<string, string>();
  for (const desired of desiredPaths) {
    assertPortableMutationPath(desired);
    const desiredKey = portableCollisionKey(desired);
    const equivalentDesired = desiredPathKeys.get(desiredKey);
    if (equivalentDesired !== undefined && equivalentDesired !== desired) {
      throw new AdoptionError(
        'PCP_ADOPTION_PATH_COLLISION',
        `Planned paths collide under portable normalization: ${equivalentDesired}, ${desired}`,
      );
    }
    desiredPathKeys.set(desiredKey, desired);
    const existingEquivalent = existingPathKeys.get(desiredKey);
    if (existingEquivalent !== undefined && existingEquivalent !== desired) {
      throw new AdoptionError(
        'PCP_ADOPTION_PATH_COLLISION',
        `Planned path collides with existing path ${existingEquivalent}: ${desired}`,
      );
    }
  }

  for (const target of content.keys()) {
    if (files.has(target) || directories.has(target) || symlinks.includes(target)) {
      throw new AdoptionError(
        'PCP_ADOPTION_PATH_COLLISION',
        `Planned target already exists: ${target}`,
      );
    }
    const staticExclusion = mutationPathExclusion(target);
    if (staticExclusion !== undefined) {
      throw new AdoptionError(
        'PCP_ADOPTION_PATH_BOUNDARY',
        `Planned target enters a ${staticExclusion} path: ${target}`,
      );
    }
    if (
      (await isMutationPathIgnored(root, target)) &&
      !(persistence === 'local' && target.startsWith('.pcp/'))
    ) {
      throw new AdoptionError(
        'PCP_ADOPTION_PATH_BOUNDARY',
        `Planned target is ignored by candidate policy: ${target}`,
      );
    }
    for (const exclusion of inspection.inventory.exclusions) {
      if (target === exclusion.path || target.startsWith(`${exclusion.path}/`)) {
        throw new AdoptionError(
          'PCP_ADOPTION_PATH_BOUNDARY',
          `Planned target enters an excluded ${exclusion.reason} boundary: ${target}`,
        );
      }
    }
    for (const link of symlinks) {
      if (target.startsWith(`${link}/`)) {
        throw new AdoptionError(
          'PCP_ADOPTION_PATH_BOUNDARY',
          `Planned target crosses a symbolic-link boundary: ${target}`,
        );
      }
    }
    for (const nested of inspection.inventory.nestedRepositories) {
      if (target === nested || target.startsWith(`${nested}/`)) {
        throw new AdoptionError(
          'PCP_ADOPTION_NESTED_REPOSITORY',
          `Planned target crosses a nested repository boundary: ${target}`,
        );
      }
    }
    for (const parent of parentDirectories(target)) {
      if (files.has(parent) || symlinks.includes(parent)) {
        throw new AdoptionError(
          'PCP_ADOPTION_PATH_COLLISION',
          `Planned target has a non-directory ancestor: ${target}`,
        );
      }
    }
  }
}

async function buildPlanMaterial(
  root: string,
  inspection: InspectionResult,
  input: AdoptionInput,
): Promise<AdoptionPlanMaterial> {
  if (inspection.state !== 'A' && inspection.state !== 'B') {
    throw new AdoptionError(
      'PCP_ADOPTION_STATE_UNSUPPORTED',
      `M3 adoption applies only to State A or State B candidates, not ${inspection.state}.`,
    );
  }
  validateDocumentSet(input, inspection);
  validateProjectInput(input, inspection);
  if (input.persistence === 'local' && !(await isMutationDirectoryIgnored(root, '.pcp'))) {
    throw new AdoptionError(
      'PCP_LOCAL_PERSISTENCE_NOT_IGNORED',
      'Local persistence requires candidate ignore policy to cover the complete .pcp/ layer before adoption.',
    );
  }

  const content = new Map(await stageCanonicalLayer(input));
  for (const scaffold of input.scaffold_files) {
    content.set(scaffold.path, Buffer.from(normalizeText(scaffold.content), 'utf8'));
  }
  await assertNoTargetCollisions(root, content, inspection, input.persistence);

  const existingDirectories = new Set(inspection.inventory.directories);
  const requiredDirectories = new Set<string>();
  for (const target of content.keys()) {
    for (const directory of parentDirectories(target)) {
      if (!existingDirectories.has(directory)) requiredDirectories.add(directory);
    }
  }
  const directoryOperations = [...requiredDirectories]
    .sort((left, right) => pathDepth(left) - pathDepth(right) || comparePortablePaths(left, right))
    .map((directory) => ({ action: 'mkdir' as const, path: directory }));
  const writeOperations = [...content.entries()]
    .sort(([left], [right]) => comparePortablePaths(left, right))
    .map(([target, bytes]) => ({
      action: 'write' as const,
      path: target,
      content_digest: sha256(bytes),
    }));
  const plan = createMutationPlan({
    classification: inspection.state,
    inventory: inspection.inventory,
    generatedAt: input.baseline_at,
    operations: [...directoryOperations, ...writeOperations],
    validations: [
      'candidate-inventory',
      'canonical-layer',
      'clean-genesis',
      'desired-hashes',
      'path-boundaries',
      'rollback',
      'semantic-input',
    ],
  });
  const planValidation = new SchemaRegistry().validate('mutation-plan', plan);
  if (!planValidation.valid) throw schemaFailure(planValidation.diagnostics);

  const preview: AdoptionPlanMaterial['preview'] = {
    schema_version: ADOPTION_SCHEMA_VERSION,
    command: 'adopt',
    candidate: '.',
    classification: inspection.state,
    confidence: inspection.confidence,
    applicable: true,
    questions: [],
    baseline: baselineFor(root, inspection),
    plan,
    mutated: false,
  };
  return { inspection, input, preview, content_by_path: content };
}

export async function planAdoption(
  candidate = '.',
  inputPath?: string,
): Promise<AdoptionPreview | AdoptionPlanMaterial> {
  const root = await resolveCandidateRoot(candidate);
  const inspection = await inspectRepository(root);
  if (inputPath === undefined || inspection.state === 'managed' || inspection.state === 'C') {
    return previewWithoutPlan(root, inspection);
  }
  const input = await loadAdoptionInput(inputPath, root);
  return buildPlanMaterial(root, inspection, input);
}

export function isPlanMaterial(
  value: AdoptionPreview | AdoptionPlanMaterial,
): value is AdoptionPlanMaterial {
  return 'content_by_path' in value;
}
