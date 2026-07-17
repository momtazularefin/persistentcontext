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
      'five cooperating surfaces',
      'Protocol assets',
      '`build-pcp` skill',
      'Project-local `pcp` engine',
      'The repository outranks private agent memory',
      'Protocol',
      'Project',
      'Generated',
      'Runtime',
      'at most 64 records',
      'oldest 32',
      'adapter-contract',
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
      'status',
      'record',
      'validate',
      'render',
      'workstream',
      'repair',
      'upgrade',
    ]) {
      expect(lifecycle, command).toContain(`pcp.mjs ${command}`);
    }
    for (const boundary of [
      'Preview does not mutate',
      'zero actor profiles, zero active events, and zero archived events',
      'creates no event',
      'routine startup does not replay the archive',
      'Pull requests are recommended milestone boundaries, not a protocol requirement',
    ]) {
      expect(lifecycle, boundary).toContain(boundary);
    }
  });
});
