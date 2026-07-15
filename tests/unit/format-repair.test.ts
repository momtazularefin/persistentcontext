import { describe, expect, it } from 'vitest';

import { formatRepair } from '../../src/presentation/format-repair.js';

describe('repair formatter', () => {
  it('renders a reviewable preview with its digest', () => {
    const output = formatRepair({
      schema_version: 1,
      command: 'repair',
      candidate: '.',
      applicable: true,
      repair_paths: ['AGENTS.md'],
      diagnostics: [],
      adapters: [],
      plan: {
        schema_version: 1,
        plan_id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        generated_at: '2026-07-15T00:00:00.000Z',
        classification: 'managed',
        candidate_inventory_digest: 'a'.repeat(64),
        operations: [],
        validations: ['platform-adapters'],
        plan_digest: 'b'.repeat(64),
      },
      mutated: false,
    });

    expect(output).toContain('PCP repair preview: approval required');
    expect(output).toContain('- AGENTS.md');
    expect(output).toContain(`Plan digest: ${'b'.repeat(64)}`);
  });

  it('renders applied paths and transaction evidence', () => {
    const output = formatRepair({
      schema_version: 1,
      command: 'repair',
      candidate: '.',
      plan_digest: 'c'.repeat(64),
      repaired_paths: ['CLAUDE.md'],
      applied_operations: 1,
      validation: { valid: true, checked_files: 42, checked_adapters: 5 },
      recovery_cleaned: true,
      mutated: true,
    });

    expect(output).toContain('PCP repair applied: 1 adapter(s)');
    expect(output).toContain('Operations: 1');
    expect(output).toContain('- CLAUDE.md');
  });
});
