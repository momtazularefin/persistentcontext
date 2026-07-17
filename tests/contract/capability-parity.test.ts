import { readFile } from 'node:fs/promises';

import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const projectRoot = new URL('../../', import.meta.url);

type Capability = {
  id: string;
  source: 'portable-reference-layer' | 'advanced-command-center';
  outcome: 'preserved' | 'superseded';
  pcp: string;
  evidence: { path: string; contains: string[] };
};

type ParityRecord = {
  version: number;
  sources: Array<{ id: string; description: string }>;
  capabilities: Capability[];
};

async function loadParity(): Promise<ParityRecord> {
  return parse(
    await readFile(new URL('docs/capability-parity.yaml', projectRoot), 'utf8'),
  ) as ParityRecord;
}

describe('capability parity record', () => {
  it('covers both source families with unique, resolved claims', async () => {
    const record = await loadParity();
    const ids = record.capabilities.map(({ id }) => id);

    expect(record.version).toBe(1);
    expect(new Set(ids).size).toBe(ids.length);
    expect(record.capabilities.length).toBe(25);
    expect(new Set(record.capabilities.map(({ source }) => source))).toEqual(
      new Set(['portable-reference-layer', 'advanced-command-center']),
    );
    expect(new Set(record.capabilities.map(({ outcome }) => outcome))).toEqual(
      new Set(['preserved', 'superseded']),
    );
    expect(record.capabilities.every(({ pcp }) => pcp.length >= 40)).toBe(true);
  });

  it('binds every parity claim to public repository evidence', async () => {
    const record = await loadParity();

    for (const capability of record.capabilities) {
      const evidence = await readFile(new URL(capability.evidence.path, projectRoot), 'utf8');
      expect(capability.evidence.contains.length, capability.id).toBeGreaterThan(0);
      for (const signal of capability.evidence.contains) {
        expect(evidence, `${capability.id}: ${signal}`).toContain(signal);
      }
    }
  });

  it('keeps the readable matrix synchronized with every claim', async () => {
    const [record, markdown] = await Promise.all([
      loadParity(),
      readFile(new URL('docs/capability-parity.md', projectRoot), 'utf8'),
    ]);

    for (const { id } of record.capabilities) {
      expect(markdown, id).toContain(`\`${id}\``);
    }
    expect(markdown).toContain('Preserved');
    expect(markdown).toContain('Superseded');
  });
});
