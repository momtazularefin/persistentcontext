import { access, readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const projectRoot = new URL('../../', import.meta.url);

function localMarkdownLinks(markdown: string): string[] {
  return [...markdown.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)#]+)(?:#[^)]+)?\)/gu)].flatMap(
    (match) => (match[1] === undefined ? [] : [match[1]]),
  );
}

describe('public documentation contract', () => {
  it('keeps the documentation index locally reachable', async () => {
    const indexUrl = new URL('docs/README.md', projectRoot);
    const index = await readFile(indexUrl, 'utf8');

    for (const target of localMarkdownLinks(index)) {
      await expect(access(new URL(target, indexUrl)), target).resolves.toBeUndefined();
    }
  });

  it('documents the implemented architecture without collapsing ownership boundaries', async () => {
    const architecture = await readFile(new URL('docs/architecture.md', projectRoot), 'utf8');

    for (const claim of [
      'Five cooperating surfaces',
      'Protocol assets',
      '`build-pcp` skill',
      'project-local `pcp` engine',
      'The repository outranks private agent memory',
      'Protocol',
      'Project',
      'Generated',
      'Runtime',
      'at most 64 records',
      'oldest 32',
      'adapter-contract',
      'Every user request',
      '(actor_id, execution_id)',
      'do not filter event delivery',
      'state/documentation.yaml',
      'project-outcome knowledge',
    ]) {
      expect(architecture, claim).toContain(claim);
    }
  });

  it('covers every implemented lifecycle command and safety boundary', async () => {
    const lifecycle = await readFile(new URL('docs/lifecycle.md', projectRoot), 'utf8');

    for (const command of [
      'inspect',
      'adopt',
      'register',
      'sync',
      'record',
      'validate',
      'render',
      'workstream',
      'repair',
      'upgrade',
      'purge-history',
    ]) {
      expect(lifecycle, command).toContain(`pcp.mjs ${command}`);
    }
    for (const boundary of [
      'Preview does not mutate',
      'zero actor profiles, zero active events, and zero archived events',
      'creates no event',
      'routine startup does not replay the archive',
      'Pull requests are recommended milestone boundaries, not a protocol requirement',
      'never filters by workstream, inferred dependency',
      'complete ordinary-project-document registry',
    ]) {
      expect(lifecycle, boundary).toContain(boundary);
    }
  });

  it('keeps compatibility claims inside the verified product contract', async () => {
    const compatibility = await readFile(new URL('docs/compatibility.md', projectRoot), 'utf8');

    for (const claim of [
      '`>=24 <25`',
      '`windows-latest`',
      '`ubuntu-latest`',
      'macOS should be treated as unverified rather than promised',
      '`codex`',
      '`antigravity`',
      '`claude-code-desktop`',
      '`github-copilot-vscode`',
      '`cursor`',
      'AGENTS.md',
      '.agents/rules/pcp.md',
      'CLAUDE.md',
      '.github/copilot-instructions.md',
      '.cursor/rules/pcp.mdc',
      'adapter-contract claim',
      'Downgrades are rejected',
    ]) {
      expect(compatibility, claim).toContain(claim);
    }
  });

  it('documents automatic adapters and a project-neutral recovery path', async () => {
    const [readme, prompts] = await Promise.all([
      readFile(new URL('README.md', projectRoot), 'utf8'),
      readFile(new URL('docs/getting-started.md', projectRoot), 'utf8'),
    ]);

    expect(readme).toContain('docs/getting-started.md');
    expect(prompts).toContain('https://github.com/momtazularefin/persistentcontext');
    expect(prompts).toContain('node .pcp/tools/pcp.mjs');
    expect(prompts).toContain('Do not assume a global `pcp` command exists');
    expect(prompts).toContain('not a new durable actor');
    expect(prompts).toContain('Every chat receives a new execution ID');
    expect(prompts).toContain('No PCP startup prompt should be necessary');
    expect(prompts).toContain('before every response or project-tool use');
    expect(prompts).toContain('stop rather than bypass PCP');
    expect(prompts).toContain('default `docs/` folder');
    expect(prompts).toContain('`.pcp/state/documentation.yaml`');
    expect(prompts).toContain('system `hostname` value');
    expect(prompts).toContain('never renamed');

    for (const [platform, adapter, client] of [
      ['Codex', 'AGENTS.md', 'codex'],
      ['Antigravity', '.agents/rules/pcp.md', 'antigravity'],
      ['Claude Code Desktop', 'CLAUDE.md', 'claude'],
      ['GitHub Copilot in Visual Studio Code', '.github/copilot-instructions.md', 'copilot'],
      ['Cursor IDE', '.cursor/rules/pcp.mdc', 'cursor'],
    ]) {
      expect(prompts, platform).toContain(platform);
      expect(prompts, adapter).toContain(adapter);
      expect(prompts, client).toContain(client);
    }
  });

  it('states security controls and limitations without implying authentication', async () => {
    const [safety, policy] = await Promise.all([
      readFile(new URL('docs/safety.md', projectRoot), 'utf8'),
      readFile(new URL('SECURITY.md', projectRoot), 'utf8'),
    ]);

    for (const boundary of [
      'never follows them',
      'reverse exact rollback',
      'not digital signatures',
      'not a general-purpose secret scanner',
      'Credential management cannot be assigned to an agent',
      'checksum proves byte equality',
    ]) {
      expect(safety, boundary).toContain(boundary);
    }
    expect(safety).toContain('only as ephemeral diagnostic output');
    expect(safety).toContain('never persisted in canonical state or continuity events');
    expect(policy).toContain("GitHub's private vulnerability-reporting form");
    expect(policy).toContain('Include no vulnerability details');
    expect(policy).toContain('does not claim to sandbox agents');
  });

  it('guides contributions through authoritative sources and complete verification', async () => {
    const contributing = await readFile(new URL('CONTRIBUTING.md', projectRoot), 'utf8');

    for (const claim of [
      'Source-of-truth boundaries',
      'Do not hand-edit synchronized engine files',
      'Transaction tests',
      'at least two meaningful invalid cases',
      'State C translation',
      'Use synthetic names, identities, histories, paths, credentials',
      'npm run verify',
      'A safe refusal is part of the product contract',
    ]) {
      expect(contributing, claim).toContain(claim);
    }
  });

  it('troubleshoots stable error families without recommending destructive bypasses', async () => {
    const troubleshooting = await readFile(new URL('docs/troubleshooting.md', projectRoot), 'utf8');

    for (const code of [
      'PCP_UNSAFE_ROOT',
      'PCP_SOURCE_CHANGED',
      'PCP_PLAN_DIGEST_MISMATCH',
      'PCP_ADOPTION_LIVE_INVALID',
      'PCP_REGISTRATION_STALE_CACHE',
      'PCP_SYNC_DIGEST_MISMATCH',
      'PCP_RECORD_DUPLICATE_CHANGE',
      'PCP_WORKSTREAM_REGISTRY_CHANGED',
      'PCP_REPAIR_NOT_APPLICABLE',
      'PCP_UPGRADE_PRESERVATION_FAILED',
      'PCP_UPGRADE_CHECK_RESPONSE_INVALID',
      'PCP_PURGE_HISTORY_NOT_APPLICABLE',
    ]) {
      expect(troubleshooting, code).toContain(code);
    }
    expect(troubleshooting).toContain('Do not use force deletion');
    expect(troubleshooting).toContain('preserve recovery evidence');
    expect(troubleshooting).toContain('`recovery_path` is `null`');
    expect(troubleshooting).toContain('do not copy it into canonical `.pcp/` documents');
    expect(troubleshooting).toContain('Do not create a second independent instruction layer');
  });
});
