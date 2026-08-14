import { sha256 } from '../domain/adoption.js';
import {
  ACTOR_CLIENT_BY_ADAPTER,
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
    'Canonical project context lives in `.pcp/`; this generated file is the mandatory platform adapter.',
    '',
    'For every user request in this project, before answering or using project tools:',
    '',
    '1. Keep one project-lifetime actor ID and one execution ID for this conversation. If either is unavailable, run `node .pcp/tools/pcp.mjs register . --client <adapter-client> --json` once and retain both returned IDs.',
    '2. Run `node .pcp/tools/pcp.mjs sync . --actor-id <actor-id> --execution-id <execution-id>`.',
    '3. If sync reports no project updates, continue immediately.',
    `4. If sync reports changes or a baseline, read every returned current path, beginning with \`${CANONICAL_ENTRY}\` when named; then acknowledge the exact digest with the same sync command plus \`--acknowledge <sync-digest>\`.`,
    '5. If the local engine is missing, fails, or reports invalid context, stop project work and tell the user; do not bypass synchronization.',
    '',
    'After a meaningful durable change, update canonical PCP sources and record one continuity event. Do not record routine reads, syncs, acknowledgements, or no-op checks. Never create independent authority in this adapter.',
    '',
  ];
}

function adapterText(adapterId: SupportedAdapterId): string {
  const body = sharedBody();
  const clientLine = body.findIndex((line) => line.includes('<adapter-client>'));
  if (clientLine >= 0)
    body[clientLine] =
      body[clientLine]?.replace('<adapter-client>', ACTOR_CLIENT_BY_ADAPTER[adapterId]) ?? '';
  if (adapterId === 'claude-code-desktop') {
    body.push(
      `Claude Code loads this adapter at session start; @${CANONICAL_ENTRY} is the canonical entry.`,
    );
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
