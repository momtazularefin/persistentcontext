import path from 'node:path';

import {
  comparePortablePaths,
  type ForeignLayerCandidate,
  type InspectionAmbiguity,
  type InspectionConfidence,
  type InspectionSignal,
  type IntakeState,
  type RepositoryInventory,
  type SignalCategory,
  type SignalStrength,
} from './inspection.js';

export interface TextDocument {
  path: string;
  contents: string;
}

export interface ManagedManifestAssessment {
  status: 'absent' | 'valid' | 'invalid';
  reason: string;
}

export interface ClassificationInput {
  inventory: RepositoryInventory;
  documents: readonly TextDocument[];
  managedManifest: ManagedManifestAssessment;
}

export interface ClassificationResult {
  state: IntakeState;
  confidence: InspectionConfidence;
  signals: InspectionSignal[];
  foreignCandidates: ForeignLayerCandidate[];
  ambiguities: InspectionAmbiguity[];
}

const foreignCategories = new Set<SignalCategory>([
  'agent-instructions',
  'persistent-memory',
  'agent-identity',
  'change-journal',
  'workflow',
  'orchestration',
]);

const codeExtensions = new Set([
  '.c',
  '.cc',
  '.clj',
  '.cpp',
  '.cs',
  '.css',
  '.dart',
  '.ex',
  '.exs',
  '.fs',
  '.go',
  '.h',
  '.hpp',
  '.html',
  '.java',
  '.jl',
  '.js',
  '.jsx',
  '.kt',
  '.kts',
  '.lua',
  '.m',
  '.php',
  '.pl',
  '.ps1',
  '.py',
  '.r',
  '.rb',
  '.rs',
  '.scala',
  '.sh',
  '.sol',
  '.sql',
  '.svelte',
  '.swift',
  '.ts',
  '.tsx',
  '.vue',
]);

const manifestNames = new Set([
  'build.gradle',
  'build.gradle.kts',
  'cargo.toml',
  'cmakelists.txt',
  'composer.json',
  'gemfile',
  'go.mod',
  'makefile',
  'mix.exs',
  'package.json',
  'pom.xml',
  'project.clj',
  'pyproject.toml',
  'requirements.txt',
  'setup.py',
]);

const deploymentNames = new Set([
  'app.yaml',
  'compose.yaml',
  'docker-compose.yml',
  'dockerfile',
  'fly.toml',
  'netlify.toml',
  'procfile',
  'serverless.yml',
  'vercel.json',
]);

const documentationExtensions = new Set(['.adoc', '.md', '.mdx', '.rst']);
const dataExtensions = new Set(['.arrow', '.csv', '.db', '.jsonl', '.parquet', '.sqlite', '.tsv']);
const assetExtensions = new Set([
  '.ai',
  '.blend',
  '.eps',
  '.fig',
  '.gif',
  '.jpeg',
  '.jpg',
  '.mov',
  '.mp3',
  '.mp4',
  '.pdf',
  '.png',
  '.psd',
  '.svg',
  '.wav',
  '.webp',
]);

const rootSeedDocumentNames = new Set([
  'changelog.md',
  'contributing.md',
  'license.md',
  'readme.md',
  'security.md',
  'spec.md',
]);

const knownInstructionBasenames = new Set([
  '.cursorrules',
  'agents.md',
  'claude.md',
  'copilot-instructions.md',
  'gemini.md',
  'skill.md',
]);

const knownInstructionPrefixes = [
  '.agents/rules/',
  '.claude/',
  '.cursor/rules/',
  '.github/agents/',
  '.github/instructions/',
  '.roo/rules/',
  '.windsurf/rules/',
];

const semanticPatterns: ReadonlyArray<{
  category: SignalCategory;
  pattern: RegExp;
  reason: string;
}> = [
  {
    category: 'agent-instructions',
    pattern:
      /\b(before (?:any|each|every) task|agent instructions?|instructions? for (?:an |the )?(?:ai |coding )?agent|must (?:read|follow|register|sync)|you are (?:an |the )?(?:ai |coding )?agent)\b/iu,
    reason: 'Contains operational instructions directed at agents.',
  },
  {
    category: 'persistent-memory',
    pattern:
      /\b(source of truth|persistent (?:project )?(?:context|memory)|continuity|last[- ]synced|checkpoint|reconciliation|handoff)\b/iu,
    reason: 'Defines persistent context, continuity, or reconciliation state.',
  },
  {
    category: 'agent-identity',
    pattern:
      /\b(agent[- ]id|agent identity|agent profile|agent registry|agent repository|machine[- ]name)\b/iu,
    reason: 'Defines durable agent identity or registration.',
  },
  {
    category: 'change-journal',
    pattern:
      /\b(append[- ]only|change ?log|journal event|event log|record (?:each|every|meaningful) change)\b/iu,
    reason: 'Defines a persistent project-change history or journal.',
  },
  {
    category: 'workflow',
    pattern:
      /\b(working agreement|stage plan|completion protocol|task tracker|project workflow|living plan)\b/iu,
    reason: 'Defines a durable workflow, plan, or standing operating rule.',
  },
  {
    category: 'orchestration',
    pattern:
      /\b(multi[- ]agent|parallel agents?|concurrent execution blocks?|dependency mapping|agent orchestration|workstreams?)\b/iu,
    reason: 'Defines multi-agent orchestration or concurrent work boundaries.',
  },
];

function basename(value: string): string {
  const pieces = value.split('/');
  return (pieces.at(-1) ?? value).toLowerCase();
}

function extension(value: string): string {
  return path.posix.extname(value).toLowerCase();
}

function addSignal(
  signals: InspectionSignal[],
  code: string,
  category: SignalCategory,
  candidatePath: string,
  reason: string,
  strength: SignalStrength,
): void {
  if (signals.some((signal) => signal.code === code && signal.path === candidatePath)) return;
  signals.push({ code, category, path: candidatePath, reason, strength });
}

function knownForeignPathSignals(input: ClassificationInput): InspectionSignal[] {
  const signals: InspectionSignal[] = [];

  for (const file of input.inventory.files) {
    const normalizedPath = file.path.toLowerCase();
    const fileName = basename(file.path);

    if (
      knownInstructionBasenames.has(fileName) ||
      knownInstructionPrefixes.some((prefix) => normalizedPath.startsWith(prefix))
    ) {
      addSignal(
        signals,
        'foreign.agent-instructions.known-entry',
        'agent-instructions',
        file.path,
        'Uses a recognized non-PCP agent instruction or skill entry point.',
        'strong',
      );
    }

    if (/^(?:.+\/)?agent-(?:repository|registry)\.md$/u.test(normalizedPath)) {
      addSignal(
        signals,
        'foreign.agent-identity.registry',
        'agent-identity',
        file.path,
        'Uses a durable non-PCP agent identity registry.',
        'strong',
      );
    }
    if (/^(?:.+\/)?sync-protocol\.md$/u.test(normalizedPath)) {
      addSignal(
        signals,
        'foreign.persistent-memory.sync-protocol',
        'persistent-memory',
        file.path,
        'Uses a non-PCP synchronization or continuity protocol.',
        'strong',
      );
    }
    if (/^(?:.+\/)?parallel-orchestration\.md$/u.test(normalizedPath)) {
      addSignal(
        signals,
        'foreign.orchestration.parallel-plan',
        'orchestration',
        file.path,
        'Uses a non-PCP multi-agent orchestration plan.',
        'strong',
      );
    }
  }

  for (const document of input.documents) {
    const normalizedPath = document.path.toLowerCase();
    if (
      /(?:^|\/)(?:ai|agents?|context|memory)\/.*change ?log\.ya?ml$/u.test(normalizedPath) &&
      /\bagent\s*:/iu.test(document.contents)
    ) {
      addSignal(
        signals,
        'foreign.change-journal.agent-log',
        'change-journal',
        document.path,
        'Contains an agent-attributed non-PCP change journal.',
        'strong',
      );
    }
  }

  return signals;
}

function semanticForeignSignals(documents: readonly TextDocument[]): InspectionSignal[] {
  const signals: InspectionSignal[] = [];
  const agentAnchor =
    /\b(ai agents?|coding agents?|assistant|agent[- ]id|multi[- ]agent|parallel agents?)\b/iu;
  const contextAnchor =
    /\b(before (?:any|each|every) task|source of truth|continuity|handoff|checkpoint|last[- ]synced|agent[- ]id|agent registry|journal event|change ?log|working agreement|workstream|must (?:read|follow|register|sync))\b/iu;

  for (const document of documents) {
    const normalizedPath = document.path.toLowerCase();
    const isRootReadme = normalizedPath === 'readme.md';
    if (!agentAnchor.test(document.contents) || !contextAnchor.test(document.contents)) continue;

    const matches = semanticPatterns.filter(({ pattern }) => pattern.test(document.contents));
    if (
      isRootReadme &&
      (matches.length < 2 || !matches.some((match) => match.category === 'agent-instructions'))
    ) {
      continue;
    }

    for (const match of matches) {
      addSignal(
        signals,
        `foreign.${match.category}.semantic`,
        match.category,
        document.path,
        match.reason,
        matches.length >= 3 ? 'strong' : 'moderate',
      );
    }
  }

  return signals;
}

function representativeSignal(
  signals: InspectionSignal[],
  code: string,
  category: SignalCategory,
  paths: readonly string[],
  reason: string,
  strength: SignalStrength,
): void {
  const first = [...paths].sort(comparePortablePaths)[0];
  if (first !== undefined) addSignal(signals, code, category, first, reason, strength);
}

function projectSignals(inventory: RepositoryInventory): InspectionSignal[] {
  const signals: InspectionSignal[] = [];
  const sourcePaths: string[] = [];
  const testPaths: string[] = [];
  const manifestPaths: string[] = [];
  const deploymentPaths: string[] = [];
  const documentationPaths: string[] = [];
  const dataPaths: string[] = [];
  const assetPaths: string[] = [];

  for (const file of inventory.files) {
    const normalized = file.path.toLowerCase();
    const fileName = basename(normalized);
    const fileExtension = extension(normalized);

    if (manifestNames.has(fileName) || /\.(?:csproj|fsproj|sln)$/u.test(fileName)) {
      manifestPaths.push(file.path);
    }
    if (
      deploymentNames.has(fileName) ||
      normalized.startsWith('.github/workflows/') ||
      normalized.startsWith('k8s/') ||
      normalized.startsWith('kubernetes/') ||
      normalized.startsWith('terraform/') ||
      fileExtension === '.tf'
    ) {
      deploymentPaths.push(file.path);
    }
    if (codeExtensions.has(fileExtension) || fileExtension === '.ipynb') {
      if (
        /(?:^|\/)(?:__tests__|test|tests)\//u.test(normalized) ||
        /\.(?:spec|test)\.[^.]+$/u.test(normalized)
      ) {
        testPaths.push(file.path);
      } else {
        sourcePaths.push(file.path);
      }
    }
    if (documentationExtensions.has(fileExtension)) {
      const atRoot = !normalized.includes('/');
      if (!atRoot || !rootSeedDocumentNames.has(fileName)) documentationPaths.push(file.path);
    }
    if (dataExtensions.has(fileExtension)) dataPaths.push(file.path);
    if (assetExtensions.has(fileExtension)) assetPaths.push(file.path);
  }

  representativeSignal(
    signals,
    'project.manifest',
    'project-manifest',
    manifestPaths,
    `Found ${manifestPaths.length} project or build manifest${manifestPaths.length === 1 ? '' : 's'}.`,
    'strong',
  );
  representativeSignal(
    signals,
    'project.source-code',
    'source-code',
    sourcePaths,
    `Found ${sourcePaths.length} source-code file${sourcePaths.length === 1 ? '' : 's'}.`,
    'strong',
  );
  representativeSignal(
    signals,
    'project.tests',
    'tests',
    testPaths,
    `Found ${testPaths.length} test file${testPaths.length === 1 ? '' : 's'}.`,
    'moderate',
  );
  representativeSignal(
    signals,
    'project.deployment',
    'deployment',
    deploymentPaths,
    `Found ${deploymentPaths.length} deployment or CI file${deploymentPaths.length === 1 ? '' : 's'}.`,
    'strong',
  );

  const documentationBytes = inventory.files
    .filter((file) => documentationPaths.includes(file.path))
    .reduce((total, file) => total + file.size, 0);
  const docsDirectoryCount = documentationPaths.filter((candidate) =>
    candidate.includes('/'),
  ).length;
  if (
    documentationPaths.length >= 3 ||
    docsDirectoryCount >= 2 ||
    (documentationPaths.length >= 2 && documentationBytes >= 12_000)
  ) {
    representativeSignal(
      signals,
      'project.documentation-set',
      'documentation',
      documentationPaths,
      `Found a substantive documentation set (${documentationPaths.length} files, ${documentationBytes} bytes).`,
      'moderate',
    );
  }

  representativeSignal(
    signals,
    'project.data',
    'data',
    dataPaths,
    `Found ${dataPaths.length} project data file${dataPaths.length === 1 ? '' : 's'}.`,
    'strong',
  );
  representativeSignal(
    signals,
    'project.creative-assets',
    'creative-assets',
    assetPaths,
    `Found ${assetPaths.length} creative or media asset${assetPaths.length === 1 ? '' : 's'}.`,
    'moderate',
  );

  const recognized = new Set([
    ...sourcePaths,
    ...testPaths,
    ...manifestPaths,
    ...deploymentPaths,
    ...documentationPaths,
    ...dataPaths,
    ...assetPaths,
  ]);
  const unclassified = inventory.files.filter(
    (file) =>
      !recognized.has(file.path) &&
      !rootSeedDocumentNames.has(basename(file.path)) &&
      !['.gitignore', '.gitattributes', '.editorconfig'].includes(basename(file.path)),
  );
  const unclassifiedBytes = unclassified.reduce((total, file) => total + file.size, 0);
  if (unclassified.length >= 4 || unclassifiedBytes >= 65_536) {
    representativeSignal(
      signals,
      'project.unclassified-assets',
      'data',
      unclassified.map((file) => file.path),
      `Found a substantive set of unclassified project assets (${unclassified.length} files, ${unclassifiedBytes} bytes).`,
      'weak',
    );
  }

  return signals;
}

const scopedForeignRoots = [
  '.agents/rules',
  '.claude',
  '.cursor/rules',
  '.github/agents',
  '.github/instructions',
  '.roo/rules',
  '.windsurf/rules',
] as const;

function candidateRoot(candidatePath: string): string {
  const normalized = candidatePath.toLowerCase();
  if (normalized === '.github/copilot-instructions.md') return candidatePath;
  for (const scopedRoot of scopedForeignRoots) {
    if (normalized !== scopedRoot && !normalized.startsWith(`${scopedRoot}/`)) continue;
    return candidatePath.split('/').slice(0, scopedRoot.split('/').length).join('/');
  }
  const separator = candidatePath.indexOf('/');
  return separator === -1 ? '.' : candidatePath.slice(0, separator);
}

function foreignCandidates(signals: readonly InspectionSignal[]): ForeignLayerCandidate[] {
  const candidates = new Map<string, { categories: Set<SignalCategory>; paths: Set<string> }>();
  for (const signal of signals) {
    if (!foreignCategories.has(signal.category)) continue;
    const root = candidateRoot(signal.path);
    const candidate = candidates.get(root) ?? { categories: new Set(), paths: new Set() };
    candidate.categories.add(signal.category);
    candidate.paths.add(signal.path);
    candidates.set(root, candidate);
  }

  return [...candidates.entries()]
    .map(([root, candidate]) => ({
      root,
      categories: [...candidate.categories].sort(comparePortablePaths),
      paths: [...candidate.paths].sort(comparePortablePaths),
    }))
    .sort((left, right) => comparePortablePaths(left.root, right.root));
}

function initialAmbiguities(input: ClassificationInput): InspectionAmbiguity[] {
  const ambiguities: InspectionAmbiguity[] = [];
  const unsafeLinks = input.inventory.symlinks.filter((link) => link.boundary !== 'internal');
  if (unsafeLinks.length > 0) {
    ambiguities.push({
      code: 'unsafe-symlink-boundary',
      message: 'External or broken symlinks were fingerprinted but never followed.',
      paths: unsafeLinks.map((link) => link.path).sort(comparePortablePaths),
    });
  }
  if (input.inventory.nestedRepositories.length > 0) {
    ambiguities.push({
      code: 'nested-repositories-excluded',
      message: 'Nested repositories were recorded as independent boundaries and not inspected.',
      paths: [...input.inventory.nestedRepositories],
    });
  }
  if (input.managedManifest.status === 'invalid') {
    ambiguities.push({
      code: 'invalid-pcp-manifest',
      message: input.managedManifest.reason,
      paths: ['.pcp/pcp.yaml'],
    });
  }
  return ambiguities;
}

function stateBConfidence(signals: readonly InspectionSignal[]): InspectionConfidence {
  const categories = new Set(signals.map((signal) => signal.category));
  if (
    categories.has('source-code') &&
    (categories.has('project-manifest') || categories.has('tests') || categories.has('deployment'))
  ) {
    return 'high';
  }
  if (categories.has('source-code') || categories.has('deployment') || categories.has('data')) {
    return 'high';
  }
  return 'medium';
}

export function classifyRepository(input: ClassificationInput): ClassificationResult {
  const signals = [
    ...knownForeignPathSignals(input),
    ...semanticForeignSignals(input.documents),
    ...projectSignals(input.inventory),
  ];
  const ambiguities = initialAmbiguities(input);

  if (input.managedManifest.status === 'valid') {
    signals.push({
      code: 'managed.valid-manifest',
      category: 'managed-manifest',
      path: '.pcp/pcp.yaml',
      reason: input.managedManifest.reason,
      strength: 'strong',
    });
    const candidates = foreignCandidates(signals);
    if (candidates.length > 0) {
      ambiguities.push({
        code: 'managed-foreign-overlap',
        message:
          'A managed PCP project also exposes possible context adapters or foreign remnants; validation must resolve ownership.',
        paths: candidates.flatMap((candidate) => candidate.paths).sort(comparePortablePaths),
      });
    }
    return {
      state: 'managed',
      confidence: 'high',
      signals: signals.sort((left, right) => comparePortablePaths(left.path, right.path)),
      foreignCandidates: candidates,
      ambiguities,
    };
  }

  if (input.managedManifest.status === 'invalid') {
    signals.push({
      code: 'foreign.invalid-pcp-manifest',
      category: 'agent-instructions',
      path: '.pcp/pcp.yaml',
      reason: 'A PCP-like layer exists but its manifest is not a valid managed identity.',
      strength: 'strong',
    });
  }

  const foreignSignals = signals.filter((signal) => foreignCategories.has(signal.category));
  const candidates = foreignCandidates(signals);
  if (foreignSignals.length > 0) {
    const categoryCount = new Set(foreignSignals.map((signal) => signal.category)).size;
    if (candidates.length > 1) {
      ambiguities.push({
        code: 'foreign-layer-overlap',
        message:
          'Multiple possible context-layer roots overlap and require semantic coverage during State C adoption.',
        paths: candidates.flatMap((candidate) => candidate.paths).sort(comparePortablePaths),
      });
    }
    return {
      state: 'C',
      confidence:
        foreignSignals.some((signal) => signal.strength === 'strong') || categoryCount >= 3
          ? 'high'
          : 'medium',
      signals: signals.sort((left, right) => comparePortablePaths(left.path, right.path)),
      foreignCandidates: candidates,
      ambiguities,
    };
  }

  const substantiveSignals = signals.filter((signal) => !foreignCategories.has(signal.category));
  if (substantiveSignals.length > 0) {
    if (
      substantiveSignals.every(
        (signal) => signal.strength === 'weak' || signal.category === 'documentation',
      )
    ) {
      ambiguities.push({
        code: 'a-b-conservative-fallback',
        message:
          'The project is borderline seed/established; PCP defaults ambiguous A/B targets to State B.',
        paths: substantiveSignals.map((signal) => signal.path).sort(comparePortablePaths),
      });
    }
    return {
      state: 'B',
      confidence: stateBConfidence(substantiveSignals),
      signals: signals.sort((left, right) => comparePortablePaths(left.path, right.path)),
      foreignCandidates: [],
      ambiguities,
    };
  }

  const seedFiles = input.inventory.files.filter(
    (file) => !['.gitignore', '.gitattributes', '.editorconfig'].includes(basename(file.path)),
  );
  return {
    state: 'A',
    confidence: seedFiles.length <= 1 ? 'high' : 'medium',
    signals: [],
    foreignCandidates: [],
    ambiguities,
  };
}
