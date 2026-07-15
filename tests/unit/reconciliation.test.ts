import { describe, expect, it } from 'vitest';

import {
  checkpointIdentity,
  classifyEventRelevance,
  pathsOverlap,
  resolveReconciliationSelection,
  type ContinuityEvent,
  type WorkstreamState,
} from '../../src/domain/reconciliation.js';

function workstream(
  workstreamId: string,
  input: Partial<Pick<WorkstreamState, 'paths' | 'areas' | 'dependencies'>> = {},
): WorkstreamState {
  return {
    workstream_id: workstreamId,
    name: workstreamId,
    kind: 'sequential',
    status: 'active',
    paths: input.paths ?? [],
    areas: input.areas ?? [],
    dependencies: input.dependencies ?? [],
    completion: { criteria: ['Done.'], evidence: [] },
  };
}

function event(input: Partial<ContinuityEvent>): ContinuityEvent {
  return {
    schema_version: 1,
    event_id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    occurred_at: '2026-07-15T00:00:00Z',
    actor: { type: 'system', id: 'pcp' },
    recorded_by: { type: 'system', id: 'pcp' },
    basis: 'system',
    kind: 'configuration',
    scopes: [],
    workstreams: [],
    summary: 'Changed current state.',
    affected_paths: [],
    ...input,
  };
}

describe('scoped reconciliation', () => {
  const workstreams = [
    workstream('foundation', { paths: ['src/shared'], areas: ['architecture'] }),
    workstream('feature', {
      paths: ['src/feature'],
      areas: ['implementation'],
      dependencies: ['foundation'],
    }),
    workstream('unrelated', { paths: ['docs/other'], areas: ['writing'] }),
  ];

  it('expands a workstream through transitive dependencies and explicit scope', () => {
    expect(
      resolveReconciliationSelection(workstreams, {
        workstream_id: 'feature',
        scopes: ['release'],
        paths: ['tests/feature'],
      }),
    ).toEqual({
      workstream_id: 'feature',
      workstreams: ['feature', 'foundation'],
      dependencies: ['foundation'],
      scopes: ['architecture', 'implementation', 'release'],
      paths: ['src/feature', 'src/shared', 'tests/feature'],
      global: false,
    });
  });

  it('marks dependencies, shared state, and overlapping paths as relevant', () => {
    const selection = resolveReconciliationSelection(workstreams, {
      workstream_id: 'feature',
    });

    expect(classifyEventRelevance(event({ workstreams: ['foundation'] }), selection)).toMatchObject(
      { relevant: true, reasons: ['dependency-workstream'] },
    );
    expect(
      classifyEventRelevance(event({ affected_paths: ['.pcp/state/vcs-policy.yaml'] }), selection),
    ).toMatchObject({ relevant: true, reasons: ['shared-policy'] });
    expect(
      classifyEventRelevance(event({ affected_paths: ['.pcp/state/workstreams.yaml'] }), selection),
    ).toMatchObject({ relevant: true, reasons: ['workstream-registry'] });
    expect(
      classifyEventRelevance(event({ affected_paths: ['src/shared/parser.ts'] }), selection),
    ).toMatchObject({ relevant: true, reasons: ['path-overlap'] });
  });

  it('keeps an unrelated concurrent change visible but out of scope', () => {
    const selection = resolveReconciliationSelection(workstreams, {
      workstream_id: 'feature',
    });
    expect(
      classifyEventRelevance(
        event({ workstreams: ['unrelated'], scopes: ['writing'], affected_paths: ['docs/other'] }),
        selection,
      ),
    ).toEqual({ relevant: false, reasons: [] });
  });

  it('uses segment-aware overlap and canonical checkpoint identities', () => {
    expect(pathsOverlap('src/app', 'src/application')).toBe(false);
    expect(pathsOverlap('src/app', 'src/app/index.ts')).toBe(true);
    expect(pathsOverlap('src/**', 'src/app/index.ts')).toBe(true);
    expect(
      checkpointIdentity({
        actor_id: 'codex-machine-0123456789',
        workstream_id: null,
        scopes: ['validation', 'protocol'],
        paths: ['tests', 'src'],
        dependencies: [],
      }),
    ).toBe(
      checkpointIdentity({
        actor_id: 'codex-machine-0123456789',
        workstream_id: null,
        scopes: ['protocol', 'validation'],
        paths: ['src', 'tests'],
        dependencies: [],
      }),
    );
  });

  it('fails closed for missing workstreams and unsafe explicit paths', () => {
    expect(() => resolveReconciliationSelection(workstreams, { workstream_id: 'missing' })).toThrow(
      expect.objectContaining({ code: 'PCP_STATUS_WORKSTREAM_NOT_FOUND' }),
    );
    expect(() => resolveReconciliationSelection(workstreams, { paths: ['../outside'] })).toThrow(
      expect.objectContaining({ code: 'PCP_STATUS_PATH_INVALID' }),
    );
  });
});
