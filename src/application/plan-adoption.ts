import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { parse, parseDocument, stringify } from 'yaml';

import {
  ADOPTION_SCHEMA_VERSION,
  AdoptionError,
  REQUIRED_ADOPTION_DOCUMENTS,
  canonicalJson,
  createMutationPlan,
  normalizeText,
  sha256,
  type AdoptionBaseline,
  type AdoptionDocumentInput,
  type AdoptionInput,
  type AdoptionPlanMaterial,
  type AdoptionPreview,
  type AdoptionQuestion,
  type MutationOperation,
} from '../domain/adoption.js';
import { supportedAdapterForSourcePath } from '../domain/adapters.js';
import { comparePortablePaths, type InspectionResult } from '../domain/inspection.js';
import { loadReleaseTemplateFiles } from '../infrastructure/adoption-assets.js';
import {
  isMutationDirectoryIgnored,
  isMutationPathIgnored,
  mutationPathExclusion,
  resolveCandidateRoot,
  toPortablePath,
} from '../infrastructure/filesystem-inventory.js';
import { SchemaRegistry } from '../infrastructure/schema-validator.js';
import {
  discoverForeignCoverage,
  foreignRootReviewTemplate,
  validateForeignCoverage,
} from './foreign-coverage.js';
import {
  renderPlatformAdapters,
  type GeneratedPlatformAdapter,
} from './render-platform-adapters.js';
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
  const capabilityQuestion: AdoptionQuestion = {
    id: 'capability-selection',
    prompt:
      'Select zero or more supported optional capabilities: Concurrent Execution Blocks, spec-driven projects, scratch space, or walkthroughs.',
    reason: 'PCP installs optional project workflows only through explicit selection.',
    required: true,
    response_shape: 'object',
  };
  if (inspection.state === 'C') {
    return [
      {
        id: 'state-c-root-review',
        prompt:
          'Review every detected foreign root: translate live agent context or preserve ordinary project material.',
        reason:
          'Semantic signals may occur inside examples, archives, or project-owned trees that must not be swept into translation.',
        required: true,
        response_shape: 'object',
      },
      {
        id: 'state-c-coverage',
        prompt: 'Complete every disposition in the emitted foreign-source coverage matrix.',
        reason: 'State C translation and destructive removal require semantic dispositions.',
        required: true,
        response_shape: 'object',
      },
      capabilityQuestion,
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
        prompt:
          'Select recommended human-commit, none, human-owned, agent-managed, or a complete custom VCS policy.',
        reason:
          'PCP recommends transparent human commits but cannot infer or enforce version-control authority.',
        required: true,
        response_shape: 'enum',
        options: ['human-commit', 'none', 'human-owned', 'agent-managed', 'custom'],
      },
      capabilityQuestion,
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
      prompt:
        'Select recommended human-commit, none, human-owned, agent-managed, or a complete custom VCS policy.',
      reason:
        'PCP recommends transparent human commits but cannot infer or enforce version-control authority.',
      required: true,
      response_shape: 'enum',
      options: ['human-commit', 'none', 'human-owned', 'agent-managed', 'custom'],
    },
    capabilityQuestion,
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
  const preview: AdoptionPreview = {
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
  if (inspection.state === 'C') {
    preview.foreign_roots = foreignRootReviewTemplate(inspection);
    preview.coverage_status = 'requires-root-review';
  }
  return preview;
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
      (inspection.state === 'B' || inspection.state === 'C') &&
      document.type === 'knowledge' &&
      document.basis !== 'repository' &&
      document.basis !== 'repository-and-user'
    ) {
      throw new AdoptionError(
        'PCP_ADOPTION_INPUT_INVALID',
        `Established-project knowledge must cite current repository evidence: ${document.path}`,
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
  if (inspection.state !== 'C' && input.coverage !== undefined) {
    throw new AdoptionError(
      'PCP_STATE_C_COVERAGE_FORBIDDEN',
      'Foreign-context coverage belongs only to State C adoption input.',
    );
  }
  if (inspection.state !== 'C' && input.foreign_roots !== undefined) {
    throw new AdoptionError(
      'PCP_STATE_C_ROOT_REVIEW_FORBIDDEN',
      'Foreign-root review belongs only to State C adoption input.',
    );
  }
  if (inspection.state === 'C' && input.foreign_roots === undefined) {
    throw new AdoptionError(
      'PCP_STATE_C_ROOT_REVIEW_REQUIRED',
      'State C adoption input must review every detected foreign root before coverage discovery.',
    );
  }
  if ((inspection.state === 'B' || inspection.state === 'C') && input.scaffold_files.length > 0) {
    throw new AdoptionError(
      inspection.state === 'B'
        ? 'PCP_STATE_B_SCAFFOLD_FORBIDDEN'
        : 'PCP_STATE_C_SCAFFOLD_FORBIDDEN',
      `${inspection.state === 'B' ? 'State B adoption' : 'State C translation'} preserves ordinary project topology and cannot add scaffold files.`,
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

async function stageCanonicalLayer(
  input: AdoptionInput,
  adapters: readonly GeneratedPlatformAdapter[] = [],
): Promise<ReadonlyMap<string, Buffer>> {
  const stageRoot = await mkdtemp(path.join(tmpdir(), 'pcp-adoption-preview-'));
  try {
    const release = await loadReleaseTemplateFiles(input.capabilities);
    const template = new Map(release.files);
    const manifestPath = '.pcp/pcp.yaml';
    const manifestBytes = template.get(manifestPath);
    if (manifestBytes === undefined) {
      throw new AdoptionError('PCP_ADOPTION_ASSETS_MISSING', 'The core manifest asset is missing.');
    }
    const manifest = parse(manifestBytes.toString('utf8')) as Record<string, unknown>;
    manifest.persistence = input.persistence;
    manifest.capabilities = release.manifests.map((capability) => capability.manifest_value);
    manifest.adapter_ids = adapters.map((adapter) => adapter.manifest.adapter_id);
    template.set(manifestPath, yamlBuffer(manifest));
    template.set('.pcp/state/project.yaml', yamlBuffer(input.project));
    template.set('.pcp/state/projects.yaml', yamlBuffer(input.projects));
    template.set('.pcp/state/workstreams.yaml', yamlBuffer(input.workstreams));
    template.set('.pcp/state/vcs-policy.yaml', yamlBuffer(input.vcs_policy));
    for (const document of input.documents) {
      template.set(`.pcp/${document.path}`, renderDocument(document, input.baseline_at));
    }
    for (const adapter of adapters) {
      if (template.has(adapter.manifest.target_path)) {
        throw new AdoptionError(
          'PCP_ADAPTER_RENDER_INVALID',
          `Generated adapter target collides with canonical staged content: ${adapter.manifest.target_path}`,
        );
      }
      template.set(adapter.manifest.target_path, adapter.content);
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
    await collectStageFiles(stageRoot, stageRoot, result);
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

async function assertContentTargetsSafe(
  root: string,
  content: ReadonlyMap<string, Buffer>,
  inspection: InspectionResult,
  persistence: AdoptionInput['persistence'],
  replaceablePaths: ReadonlySet<string> = new Set<string>(),
): Promise<void> {
  const files = new Set(inspection.inventory.files.map((file) => file.path));
  const directories = new Set(inspection.inventory.directories);
  const symlinks = inspection.inventory.symlinks.map((link) => link.path);
  const existingPathKeys = new Map<string, string[]>();
  for (const existing of [...files, ...directories, ...symlinks]) {
    const key = portableCollisionKey(existing);
    const equivalents = existingPathKeys.get(key) ?? [];
    equivalents.push(existing);
    existingPathKeys.set(key, equivalents);
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
    const existingEquivalents = existingPathKeys.get(desiredKey) ?? [];
    const conflictingExisting = existingEquivalents.find((existing) => existing !== desired);
    if (conflictingExisting !== undefined) {
      throw new AdoptionError(
        'PCP_ADOPTION_PATH_COLLISION',
        `Planned path collides with existing path ${conflictingExisting}: ${desired}`,
      );
    }
  }

  for (const target of content.keys()) {
    if (
      (files.has(target) && !replaceablePaths.has(target)) ||
      directories.has(target) ||
      symlinks.includes(target)
    ) {
      throw new AdoptionError(
        'PCP_ADOPTION_PATH_COLLISION',
        `Planned target already exists and is not an approved file replacement: ${target}`,
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
      if ((files.has(parent) && !replaceablePaths.has(parent)) || symlinks.includes(parent)) {
        throw new AdoptionError(
          'PCP_ADOPTION_PATH_COLLISION',
          `Planned target has a non-directory ancestor: ${target}`,
        );
      }
    }
  }
}

function normalizedCoverageDigest(coverage: NonNullable<AdoptionInput['coverage']>): string {
  const normalized = {
    ...coverage,
    foreign_roots: coverage.foreign_roots
      .map((review) => ({
        ...review,
        evidence: [...review.evidence].sort(comparePortablePaths),
      }))
      .sort((left, right) => comparePortablePaths(left.root, right.root)),
    records: coverage.records
      .map((record) => ({
        ...record,
        targets: [...record.targets].sort(comparePortablePaths),
        evidence: [...record.evidence].sort(comparePortablePaths),
      }))
      .sort((left, right) => comparePortablePaths(left.source_id, right.source_id)),
  };
  return sha256(canonicalJson(normalized));
}

function stateCRemovalPaths(input: AdoptionInput): Set<string> {
  if (input.coverage === undefined) return new Set<string>();
  return new Set(
    input.coverage.records
      .filter(
        (record) =>
          (record.source_kind === 'file' || record.source_kind === 'adapter') &&
          record.disposition !== 'project-owned' &&
          record.disposition !== 'relocated',
      )
      .map((record) => record.source_path),
  );
}

interface StateCRelocation {
  record_index: number;
  source_path: string;
  target_path: string;
  preimage_digest: string;
}

function stateCRelocations(input: AdoptionInput): StateCRelocation[] {
  if (input.coverage === undefined) return [];
  return input.coverage.records
    .map((record, recordIndex) => ({ record, recordIndex }))
    .filter(({ record }) => record.disposition === 'relocated')
    .map(({ record, recordIndex }) => ({
      record_index: recordIndex,
      source_path: record.source_path,
      target_path: record.targets[0]!,
      preimage_digest: record.fingerprint,
    }))
    .sort((left, right) => comparePortablePaths(left.source_path, right.source_path));
}

function isInsideReviewedRoot(candidatePath: string, root: string): boolean {
  return root === '.' || candidatePath === root || candidatePath.startsWith(`${root}/`);
}

function validateStateCRelocations(
  input: AdoptionInput,
  relocations: readonly StateCRelocation[],
): void {
  if (input.coverage === undefined) return;
  const translatedRoots = input.coverage.foreign_roots
    .filter((review) => review.disposition === 'translate')
    .map((review) => review.root)
    .filter((root) => root !== '.');
  const targets = new Set<string>();
  const diagnostics: Array<{ code: string; path: string; message: string }> = [];
  for (const relocation of relocations) {
    if (
      relocation.target_path.startsWith('.pcp/') ||
      relocation.target_path === '.pcp' ||
      translatedRoots.some((root) => isInsideReviewedRoot(relocation.target_path, root))
    ) {
      diagnostics.push({
        code: 'coverage-relocation-target-unsafe',
        path: `/coverage/records/${relocation.record_index}/targets/0`,
        message: `Relocation target must be project-owned and outside .pcp and every translated root: ${relocation.target_path}`,
      });
    }
    if (relocation.target_path === relocation.source_path) {
      diagnostics.push({
        code: 'coverage-relocation-target-unchanged',
        path: `/coverage/records/${relocation.record_index}/targets/0`,
        message: `Relocation source and target are identical: ${relocation.source_path}`,
      });
    }
    if (targets.has(relocation.target_path)) {
      diagnostics.push({
        code: 'coverage-relocation-target-duplicate',
        path: `/coverage/records/${relocation.record_index}/targets/0`,
        message: `Relocation target appears more than once: ${relocation.target_path}`,
      });
    }
    targets.add(relocation.target_path);
  }
  if (diagnostics.length > 0) throw stateCCoverageFailure(diagnostics);
}

function stateCDirectoriesToRemove(
  inspection: InspectionResult,
  input: AdoptionInput,
  consumedFiles: ReadonlySet<string>,
  futurePaths: readonly string[],
): string[] {
  if (input.coverage === undefined) return [];
  const translatedRoots = input.coverage.foreign_roots
    .filter((review) => review.disposition === 'translate' && review.root !== '.')
    .map((review) => review.root);
  const remainingPaths = [
    ...inspection.inventory.files
      .map((file) => file.path)
      .filter((candidatePath) => !consumedFiles.has(candidatePath)),
    ...inspection.inventory.symlinks.map((link) => link.path),
    ...futurePaths,
  ];
  return inspection.inventory.directories
    .filter(
      (directory) =>
        translatedRoots.some((root) => isInsideReviewedRoot(directory, root)) &&
        !remainingPaths.some(
          (candidatePath) =>
            candidatePath === directory || candidatePath.startsWith(`${directory}/`),
        ),
    )
    .sort((left, right) => pathDepth(right) - pathDepth(left) || comparePortablePaths(left, right));
}

function buildStateCOperations(
  content: ReadonlyMap<string, Buffer>,
  inspection: InspectionResult,
  removalPaths: ReadonlySet<string>,
  relocations: readonly StateCRelocation[],
  directoryRemovals: readonly string[],
): Array<Omit<MutationOperation, 'operation_id'>> {
  const filesByPath = new Map(inspection.inventory.files.map((file) => [file.path, file]));
  const existingDirectories = new Set(inspection.inventory.directories);
  const contentPaths = [...content.keys()];
  const preWriteRemovalPaths = [...removalPaths]
    .filter(
      (removalPath) =>
        !content.has(removalPath) &&
        contentPaths.some((target) => target.startsWith(`${removalPath}/`)),
    )
    .sort(comparePortablePaths);
  const preWriteRemovals = preWriteRemovalPaths.map((removalPath) => {
    const source = filesByPath.get(removalPath);
    if (source === undefined) {
      throw new AdoptionError(
        'PCP_STATE_C_COVERAGE_INVALID',
        `Reviewed foreign file is missing from the current inventory: ${removalPath}`,
      );
    }
    return {
      action: 'remove' as const,
      path: removalPath,
      preimage_digest: source.sha256,
    };
  });

  const requiredDirectories = new Set<string>();
  for (const target of contentPaths) {
    for (const directory of parentDirectories(target)) {
      if (!existingDirectories.has(directory)) requiredDirectories.add(directory);
    }
  }
  for (const relocation of relocations) {
    for (const directory of parentDirectories(relocation.target_path)) {
      if (!existingDirectories.has(directory)) requiredDirectories.add(directory);
    }
  }
  const directoryOperations = [...requiredDirectories]
    .sort((left, right) => pathDepth(left) - pathDepth(right) || comparePortablePaths(left, right))
    .map((directory) => ({ action: 'mkdir' as const, path: directory }));
  const contentOperations = [...content.entries()]
    .sort(([left], [right]) => comparePortablePaths(left, right))
    .map(([target, bytes]) => {
      const existing = filesByPath.get(target);
      return existing === undefined
        ? { action: 'write' as const, path: target, content_digest: sha256(bytes) }
        : {
            action: 'replace' as const,
            path: target,
            content_digest: sha256(bytes),
            preimage_digest: existing.sha256,
          };
    });
  const earlyRemovalSet = new Set(preWriteRemovalPaths);
  const moveOperations = relocations.map((relocation) => ({
    action: 'move' as const,
    path: relocation.target_path,
    source_path: relocation.source_path,
    preimage_digest: relocation.preimage_digest,
  }));
  const postWriteRemovals = [...removalPaths]
    .filter((removalPath) => !content.has(removalPath) && !earlyRemovalSet.has(removalPath))
    .sort(comparePortablePaths)
    .map((removalPath) => {
      const source = filesByPath.get(removalPath);
      if (source === undefined) {
        throw new AdoptionError(
          'PCP_STATE_C_COVERAGE_INVALID',
          `Reviewed foreign file is missing from the current inventory: ${removalPath}`,
        );
      }
      return {
        action: 'remove' as const,
        path: removalPath,
        preimage_digest: source.sha256,
      };
    });
  const directoryRemovalOperations = directoryRemovals.map((directory) => ({
    action: 'rmdir' as const,
    path: directory,
  }));
  return [
    ...preWriteRemovals,
    ...directoryOperations,
    ...contentOperations,
    ...moveOperations,
    ...postWriteRemovals,
    ...directoryRemovalOperations,
  ];
}

function stateCCoverageFailure(
  diagnostics: Array<{ code: string; path: string; message: string }>,
): AdoptionError {
  const details = diagnostics
    .slice(0, 8)
    .map((diagnostic) => `${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`)
    .join('; ');
  return new AdoptionError(
    'PCP_STATE_C_COVERAGE_INVALID',
    `State C coverage is not ready: ${details}`,
  );
}

function assertSupportedStateCAdapters(input: AdoptionInput): void {
  if (input.coverage === undefined) return;
  const unsupported = input.coverage.records
    .filter(
      (record) =>
        record.source_kind === 'adapter' &&
        supportedAdapterForSourcePath(record.source_path) === undefined,
    )
    .map((record) => record.source_path)
    .sort(comparePortablePaths);
  if (unsupported.length === 0) return;
  const examples = unsupported.slice(0, 8).join(', ');
  throw new AdoptionError(
    'PCP_STATE_C_ADAPTER_UNSUPPORTED',
    `State C contains adapter surfaces without a verified PCP replacement: ${examples}. Preserve the candidate and add an explicit adapter implementation before translation.`,
  );
}

function assertGeneratedPlatformAdapters(adapters: readonly GeneratedPlatformAdapter[]): void {
  const registry = new SchemaRegistry();
  const ids = new Set<string>();
  const targets = new Set<string>();
  for (const adapter of adapters) {
    const validation = registry.validate('adapter', adapter.manifest);
    if (!validation.valid) {
      throw new AdoptionError(
        'PCP_ADAPTER_RENDER_INVALID',
        `Generated adapter ${adapter.manifest.adapter_id} is invalid: ${validation.diagnostics
          .slice(0, 8)
          .map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`)
          .join('; ')}`,
      );
    }
    if (adapter.manifest.content_digest !== sha256(adapter.content)) {
      throw new AdoptionError(
        'PCP_ADAPTER_RENDER_INVALID',
        `Generated adapter digest is stale: ${adapter.manifest.adapter_id}`,
      );
    }
    if (ids.has(adapter.manifest.adapter_id) || targets.has(adapter.manifest.target_path)) {
      throw new AdoptionError(
        'PCP_ADAPTER_RENDER_INVALID',
        `Generated adapter ID or target appears more than once: ${adapter.manifest.adapter_id}`,
      );
    }
    ids.add(adapter.manifest.adapter_id);
    targets.add(adapter.manifest.target_path);
  }
}

function validateStateCCoverageTargets(
  input: AdoptionInput,
  content: ReadonlyMap<string, Buffer>,
): void {
  if (input.coverage === undefined) return;
  const diagnostics: Array<{ code: string; path: string; message: string }> = [];
  for (const [recordIndex, record] of input.coverage.records.entries()) {
    for (const [targetIndex, target] of record.targets.entries()) {
      if (record.disposition === 'relocated') continue;
      if (!target.startsWith('.pcp/') || !content.has(target)) {
        diagnostics.push({
          code: 'coverage-target-missing',
          path: `/coverage/records/${recordIndex}/targets/${targetIndex}`,
          message: `Coverage target is not a staged canonical file: ${target}`,
        });
      }
    }
  }
  if (diagnostics.length > 0) throw stateCCoverageFailure(diagnostics);
}

async function buildStateCTranslationPlan(
  root: string,
  inspection: InspectionResult,
  input: AdoptionInput,
): Promise<AdoptionPlanMaterial> {
  if (inspection.state !== 'C') {
    throw new AdoptionError(
      'PCP_ADOPTION_STATE_UNSUPPORTED',
      `State C coverage review requires a State C candidate, not ${inspection.state}.`,
    );
  }
  if (input.coverage === undefined) {
    throw new AdoptionError(
      'PCP_STATE_C_COVERAGE_REQUIRED',
      'State C adoption input must include the completed coverage matrix emitted for this candidate.',
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

  const catalog = await discoverForeignCoverage(root, inspection, input.foreign_roots);
  const validation = validateForeignCoverage(catalog, input.coverage);
  if (!validation.valid) throw stateCCoverageFailure(validation.diagnostics);
  assertSupportedStateCAdapters(input);

  const adapters = renderPlatformAdapters();
  assertGeneratedPlatformAdapters(adapters);
  const content = await stageCanonicalLayer(input, adapters);
  validateStateCCoverageTargets(input, content);
  const removalPaths = stateCRemovalPaths(input);
  const relocations = stateCRelocations(input);
  validateStateCRelocations(input, relocations);
  const relocationTargets = new Map(
    relocations.map((relocation) => [relocation.target_path, Buffer.alloc(0)] as const),
  );
  await assertContentTargetsSafe(
    root,
    new Map([...content, ...relocationTargets]),
    inspection,
    input.persistence,
    removalPaths,
  );
  const consumedFiles = new Set([
    ...removalPaths,
    ...relocations.map((relocation) => relocation.source_path),
  ]);
  const directoryRemovals = stateCDirectoriesToRemove(inspection, input, consumedFiles, [
    ...content.keys(),
    ...relocations.map((relocation) => relocation.target_path),
  ]);
  const plan = createMutationPlan({
    classification: 'C',
    coverageDigest: normalizedCoverageDigest(input.coverage),
    inventory: inspection.inventory,
    operations: buildStateCOperations(
      content,
      inspection,
      removalPaths,
      relocations,
      directoryRemovals,
    ),
    validations: [
      'candidate-inventory',
      'canonical-layer',
      'clean-genesis',
      'coverage',
      'desired-hashes',
      'foreign-removals',
      'foreign-relocations',
      'foreign-directory-cleanup',
      'path-boundaries',
      'platform-adapters',
      'preimages',
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
    classification: 'C',
    confidence: inspection.confidence,
    applicable: true,
    questions: [],
    baseline: baselineFor(root, inspection),
    coverage: input.coverage,
    coverage_issues: [],
    coverage_status: 'complete',
    adapters: adapters.map((adapter) => adapter.manifest),
    plan,
    mutated: false,
  };
  return { inspection, input, preview, content_by_path: content };
}

async function previewScopedStateCCoverage(
  root: string,
  inspection: InspectionResult,
  input: AdoptionInput,
): Promise<AdoptionPreview> {
  validateDocumentSet(input, inspection);
  validateProjectInput(input, inspection);
  const catalog = await discoverForeignCoverage(root, inspection, input.foreign_roots);
  return {
    schema_version: ADOPTION_SCHEMA_VERSION,
    command: 'adopt',
    candidate: '.',
    classification: 'C',
    confidence: inspection.confidence,
    applicable: false,
    questions: questionsFor(inspection).filter((question) => question.id === 'state-c-coverage'),
    baseline: baselineFor(root, inspection),
    foreign_roots: catalog.foreign_roots,
    coverage: catalog.template,
    coverage_issues: catalog.issues,
    coverage_status: catalog.issues.length === 0 ? 'requires-disposition' : 'blocked',
    mutated: false,
  };
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

  const adapters = renderPlatformAdapters();
  assertGeneratedPlatformAdapters(adapters);
  const content = new Map(await stageCanonicalLayer(input, adapters));
  for (const scaffold of input.scaffold_files) {
    if (content.has(scaffold.path)) {
      throw new AdoptionError(
        'PCP_ADOPTION_PATH_BOUNDARY',
        `State A scaffold path is reserved by the canonical PCP installation: ${scaffold.path}`,
      );
    }
    content.set(scaffold.path, Buffer.from(normalizeText(scaffold.content), 'utf8'));
  }
  await assertContentTargetsSafe(root, content, inspection, input.persistence);

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
    operations: [...directoryOperations, ...writeOperations],
    validations: [
      'candidate-inventory',
      'canonical-layer',
      'clean-genesis',
      'desired-hashes',
      'path-boundaries',
      'platform-adapters',
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
    adapters: adapters.map((adapter) => adapter.manifest),
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
  if (inputPath === undefined || inspection.state === 'managed') {
    return previewWithoutPlan(root, inspection);
  }
  const input = await loadAdoptionInput(inputPath, root);
  if (inspection.state === 'C') {
    if (input.coverage === undefined) return previewScopedStateCCoverage(root, inspection, input);
    return buildStateCTranslationPlan(root, inspection, input);
  }
  return buildPlanMaterial(root, inspection, input);
}

export function isPlanMaterial(
  value: AdoptionPreview | AdoptionPlanMaterial,
): value is AdoptionPlanMaterial {
  return 'content_by_path' in value;
}
