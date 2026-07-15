export const SUPPORTED_ADAPTER_IDS = [
  'codex',
  'antigravity',
  'claude-code-desktop',
  'github-copilot-vscode',
  'cursor',
] as const;

export type SupportedAdapterId = (typeof SUPPORTED_ADAPTER_IDS)[number];
export type AdapterPlatform = SupportedAdapterId | 'custom';

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
