export const SUPPORTED_ADAPTER_IDS = [
  'codex',
  'antigravity',
  'claude-code-desktop',
  'github-copilot-vscode',
  'cursor',
] as const;

export type SupportedAdapterId = (typeof SUPPORTED_ADAPTER_IDS)[number];
export type AdapterPlatform = SupportedAdapterId | 'custom';

export const ACTOR_CLIENT_BY_ADAPTER = {
  codex: 'codex',
  antigravity: 'antigravity',
  'claude-code-desktop': 'claude',
  'github-copilot-vscode': 'copilot',
  cursor: 'cursor',
} as const satisfies Record<SupportedAdapterId, string>;

export type ActorClientLabel = (typeof ACTOR_CLIENT_BY_ADAPTER)[SupportedAdapterId];

export const PRODUCT_NAME_BY_CLIENT = {
  codex: 'Codex',
  antigravity: 'Antigravity',
  claude: 'Claude Code',
  copilot: 'GitHub Copilot',
  cursor: 'Cursor',
} as const satisfies Record<ActorClientLabel, string>;

/**
 * The supported products that load each generated adapter at session start.
 *
 * An adapter's location identifies its reader only when exactly one product
 * loads it. `AGENTS.md` began as Codex's instruction file but is now a shared
 * convention: Antigravity (from v1.20.3), Cursor, and GitHub Copilot in VS Code
 * load it alongside their own files. Writing `--client codex` into it told every
 * one of those products to register as Codex, which is how an Antigravity
 * conversation came to act under a Codex actor for weeks without error.
 *
 * Registration therefore names a label only in an adapter with a single reader.
 * An adapter several products load must leave the label to the product that is
 * actually running, because nothing inside a shared file can say which one that
 * is.
 */
export const ADAPTER_READERS = {
  codex: ['codex', 'antigravity', 'copilot', 'cursor'],
  antigravity: ['antigravity'],
  'claude-code-desktop': ['claude'],
  'github-copilot-vscode': ['copilot'],
  cursor: ['cursor'],
} as const satisfies Record<SupportedAdapterId, readonly ActorClientLabel[]>;

/** The single product an adapter identifies, or `undefined` when several products load it. */
export function adapterIdentifiesReader(
  adapterId: SupportedAdapterId,
): ActorClientLabel | undefined {
  const readers: readonly ActorClientLabel[] = ADAPTER_READERS[adapterId];
  return readers.length === 1 ? readers[0] : undefined;
}

/** Every adapter a product loads at session start, in canonical adapter order. */
export function adaptersLoadedBy(client: ActorClientLabel): SupportedAdapterId[] {
  return SUPPORTED_ADAPTER_IDS.filter((adapterId) =>
    (ADAPTER_READERS[adapterId] as readonly ActorClientLabel[]).includes(client),
  );
}

export interface AdapterManifest {
  schema_version: 1;
  adapter_id: string;
  platform: AdapterPlatform;
  target_path: string;
  source_paths: string[];
  ownership: 'generated';
  collision_policy: 'preview-required' | 'preserve' | 'replace-generated';
  content_digest: string;
}

const ADAPTER_BASENAMES = new Set([
  '.cursorrules',
  'agents.md',
  'claude.md',
  'copilot-instructions.md',
  'gemini.md',
  'skill.md',
]);

const ADAPTER_NAMESPACES = [
  '.agents/rules',
  '.claude/agents',
  '.claude/commands',
  '.claude/rules',
  '.claude/skills',
  '.cursor/rules',
  '.github/agents',
  '.github/instructions',
  '.roo/rules',
  '.windsurf/rules',
] as const;

function normalizedPath(candidatePath: string): string {
  return candidatePath.replaceAll('\\', '/').replace(/^\.\//u, '').toLowerCase();
}

function isInsideNamespace(candidatePath: string, namespace: string): boolean {
  return (
    candidatePath === namespace ||
    candidatePath.startsWith(`${namespace}/`) ||
    candidatePath.includes(`/${namespace}/`)
  );
}

export function isForeignAdapterSourcePath(candidatePath: string): boolean {
  const normalized = normalizedPath(candidatePath);
  const basename = normalized.split('/').at(-1) ?? normalized;
  return (
    ADAPTER_BASENAMES.has(basename) ||
    ADAPTER_NAMESPACES.some((namespace) => isInsideNamespace(normalized, namespace))
  );
}

export function supportedAdapterForSourcePath(
  candidatePath: string,
): SupportedAdapterId | undefined {
  const normalized = normalizedPath(candidatePath);
  const basename = normalized.split('/').at(-1) ?? normalized;
  if (basename === 'agents.md') return 'codex';
  if (basename === 'claude.md') return 'claude-code-desktop';
  if (basename === '.cursorrules' || isInsideNamespace(normalized, '.cursor/rules')) {
    return 'cursor';
  }
  if (isInsideNamespace(normalized, '.agents/rules')) return 'antigravity';
  if (
    basename === 'copilot-instructions.md' ||
    isInsideNamespace(normalized, '.github/agents') ||
    isInsideNamespace(normalized, '.github/instructions')
  ) {
    return 'github-copilot-vscode';
  }
  return undefined;
}
