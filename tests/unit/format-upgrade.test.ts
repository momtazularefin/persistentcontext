import { describe, expect, it } from 'vitest';

import { formatUpgrade } from '../../src/presentation/format-upgrade.js';

describe('upgrade formatter', () => {
  it('renders preview and apply evidence for humans', () => {
    const preview = formatUpgrade({
      schema_version: 1,
      command: 'upgrade',
      candidate: '.',
      from_version: '0.0.9',
      to_version: '0.1.0',
      applicable: true,
      upgrade_paths: ['.pcp/pcp.yaml'],
      preserved_files: 12,
      preservation_digest: 'a'.repeat(64),
      adapters: [],
      plan: {
        schema_version: 1,
        plan_id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        generated_at: '2026-07-15T00:00:00.000Z',
        classification: 'managed',
        candidate_inventory_digest: 'c'.repeat(64),
        operations: [],
        validations: ['ownership-preservation'],
        plan_digest: 'd'.repeat(64),
      },
      mutated: false,
    });
    expect(preview).toContain('PCP upgrade preview: approval required');
    expect(preview).toContain('Preserved files: 12');
    expect(preview).toContain(`Plan digest: ${'d'.repeat(64)}`);

    const applied = formatUpgrade({
      schema_version: 1,
      command: 'upgrade',
      candidate: '.',
      from_version: '0.0.9',
      to_version: '0.1.0',
      plan_digest: 'b'.repeat(64),
      upgraded_paths: ['.pcp/pcp.yaml'],
      preserved_files: 12,
      preservation_digest: 'a'.repeat(64),
      applied_operations: 1,
      validation: { valid: true, checked_files: 40, checked_adapters: 5 },
      recovery_cleaned: true,
      mutated: true,
    });
    expect(applied).toContain('PCP upgrade applied: 0.0.9 -> 0.1.0');
    expect(applied).toContain('- .pcp/pcp.yaml');
  });
});
