import { sha256 } from '../domain/adoption.js';
import {
  SUPPORTED_ADAPTER_IDS,
  type AdapterManifest,
  type SupportedAdapterId,
} from '../domain/adapters.js';

export interface GeneratedPlatformAdapter {
  manifest: AdapterManifest;
  content: Buffer;
}

const GENERATED_MARKER = '<!-- PCP: GENERATED; DO NOT EDIT -->';
const CANONICAL_ENTRY = '.pcp/00-index.md';

const targetByAdapter = {
  codex: 'AGENTS.md',
  antigravity: '.agents/rules/pcp.md',
  'claude-code-desktop': 'CLAUDE.md',
  'github-copilot-vscode': '.github/copilot-instructions.md',
  cursor: '.cursor/rules/pcp.mdc',
} as const satisfies Record<SupportedAdapterId, string>;

function sharedBody(): string[] {
  return [
    GENERATED_MARKER,
    '',
    '# Persistent Context Protocol',
    '',
    'Canonical project context lives in `.pcp/`; this file is only a platform adapter.',
    '',
    `1. Start at \`${CANONICAL_ENTRY}\`.`,
    '2. Follow its first-task or returning-task path.',
    '3. Read only the state, knowledge, operations, project, and continuity records relevant to the active scope.',
    '4. Update canonical PCP sources when project context changes; do not create independent authority in this adapter.',
    '',
  ];
}

function adapterText(adapterId: SupportedAdapterId): string {
  const body = sharedBody();
  if (adapterId === 'claude-code-desktop') {
    body.splice(6, 1, `1. Read @${CANONICAL_ENTRY} before work.`);
  }
  if (adapterId === 'cursor') {
    return [
      '---',
      'description: Route project work through the canonical PCP context',
      'globs:',
      'alwaysApply: true',
      '---',
      '',
      ...body,
    ].join('\n');
  }
  return body.join('\n');
}

export function renderPlatformAdapters(): GeneratedPlatformAdapter[] {
  return SUPPORTED_ADAPTER_IDS.map((adapterId) => {
    const content = Buffer.from(adapterText(adapterId), 'utf8');
    return {
      manifest: {
        schema_version: 1,
        adapter_id: adapterId,
        platform: adapterId,
        target_path: targetByAdapter[adapterId],
        source_paths: [CANONICAL_ENTRY],
        ownership: 'generated',
        collision_policy: 'preview-required',
        content_digest: sha256(content),
      },
      content,
    };
  });
}
