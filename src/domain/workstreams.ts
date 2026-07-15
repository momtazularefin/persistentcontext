import { canonicalJson } from './adoption.js';
import type { ActorReference, WorkstreamState } from './reconciliation.js';

export interface WorkstreamRegistry {
  schema_version: 1;
  workstreams: WorkstreamState[];
}

interface WorkstreamOperationBase {
  schema_version: 1;
  expected_registry_digest: string;
  occurred_at?: string;
  actor: ActorReference;
  recorded_by: ActorReference;
  basis: 'self' | 'reported' | 'observed' | 'system';
  change_key?: string;
  summary: string;
  rationale?: string;
}

export interface CreateWorkstreamInput extends WorkstreamOperationBase {
  operation: 'create';
  workstream: WorkstreamState;
}

export interface UpdateWorkstreamInput extends WorkstreamOperationBase {
  operation: 'update';
  workstream: WorkstreamState;
}

export interface CompleteWorkstreamInput extends WorkstreamOperationBase {
  operation: 'complete';
  workstream_id: string;
  evidence: WorkstreamState['completion']['evidence'];
  announcement: string;
}

export type WorkstreamOperationInput =
  CreateWorkstreamInput | UpdateWorkstreamInput | CompleteWorkstreamInput;

export interface WorkstreamValidationResult {
  schema_version: 1;
  command: 'workstream';
  operation: 'validate';
  status: 'valid';
  registry_path: '.pcp/state/workstreams.yaml';
  registry_digest: string;
  workstream_count: number;
  workstream: WorkstreamState | null;
  diagnostics: [];
  event_created: false;
  mutated: false;
}

export interface WorkstreamMutationResult {
  schema_version: 1;
  command: 'workstream';
  operation: 'create' | 'update' | 'complete';
  status: 'created' | 'updated' | 'completed';
  workstream_id: string;
  registry_path: '.pcp/state/workstreams.yaml';
  registry_digest_before: string;
  registry_digest_after: string;
  event_id: string;
  event_path: string;
  event_payload_digest: string;
  announcement: string | null;
  event_created: true;
  mutated: true;
  recovery_retained: boolean;
}

export type WorkstreamResult = WorkstreamValidationResult | WorkstreamMutationResult;

export interface PreparedWorkstreamMutation {
  registry: WorkstreamRegistry;
  workstream: WorkstreamState;
}

export class WorkstreamError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly mutated = false,
    public readonly recovery_retained = false,
  ) {
    super(message);
    this.name = 'WorkstreamError';
  }
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function normalizeEvidence(
  evidence: WorkstreamState['completion']['evidence'],
): WorkstreamState['completion']['evidence'] {
  return evidence
    .map((item) => ({ criterion: item.criterion.trim(), proof: item.proof.trim() }))
    .sort(
      (left, right) =>
        left.criterion.localeCompare(right.criterion) || left.proof.localeCompare(right.proof),
    );
}

export function normalizeWorkstream(workstream: WorkstreamState): WorkstreamState {
  return {
    workstream_id: workstream.workstream_id,
    name: workstream.name.trim(),
    kind: workstream.kind,
    status: workstream.status,
    paths: sorted(workstream.paths),
    areas: sorted(workstream.areas),
    dependencies: sorted(workstream.dependencies),
    completion: {
      criteria: sorted(workstream.completion.criteria.map((criterion) => criterion.trim())),
      evidence: normalizeEvidence(workstream.completion.evidence),
      ...(workstream.completion.announcement === undefined
        ? {}
        : { announcement: workstream.completion.announcement.trim() }),
    },
  };
}

function replaceWorkstream(
  registry: WorkstreamRegistry,
  workstream: WorkstreamState,
): WorkstreamRegistry {
  return {
    schema_version: 1,
    workstreams: [
      ...registry.workstreams.filter((item) => item.workstream_id !== workstream.workstream_id),
      workstream,
    ].sort((left, right) => left.workstream_id.localeCompare(right.workstream_id)),
  };
}

function existingWorkstream(registry: WorkstreamRegistry, workstreamId: string): WorkstreamState {
  const existing = registry.workstreams.find((item) => item.workstream_id === workstreamId);
  if (existing === undefined) {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_NOT_FOUND',
      `Workstream ${workstreamId} does not exist.`,
    );
  }
  return existing;
}

function assertUpdateTransition(previous: WorkstreamState, next: WorkstreamState): void {
  if (previous.kind !== next.kind) {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_KIND_IMMUTABLE',
      `Workstream ${previous.workstream_id} cannot change kind from ${previous.kind} to ${next.kind}.`,
    );
  }
  if (previous.status === 'complete' || previous.status === 'cancelled') {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_TERMINAL',
      `Workstream ${previous.workstream_id} is ${previous.status} and cannot be updated.`,
    );
  }
  if (next.status === 'complete') {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_COMPLETE_REQUIRED',
      `Use the complete operation to finish workstream ${previous.workstream_id}.`,
    );
  }

  const allowed: Record<WorkstreamState['status'], readonly WorkstreamState['status'][]> = {
    planned: ['planned', 'active', 'blocked', 'cancelled'],
    active: ['active', 'blocked', 'cancelled'],
    blocked: ['blocked', 'active', 'cancelled'],
    complete: [],
    cancelled: [],
  };
  if (!allowed[previous.status].includes(next.status)) {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_TRANSITION_INVALID',
      `Workstream ${previous.workstream_id} cannot move from ${previous.status} to ${next.status}.`,
    );
  }
}

function prepareCreate(
  registry: WorkstreamRegistry,
  input: CreateWorkstreamInput,
): PreparedWorkstreamMutation {
  const workstream = normalizeWorkstream(input.workstream);
  if (registry.workstreams.some((item) => item.workstream_id === workstream.workstream_id)) {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_EXISTS',
      `Workstream ${workstream.workstream_id} already exists.`,
    );
  }
  if (workstream.status === 'complete' || workstream.status === 'cancelled') {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_CREATE_STATUS_INVALID',
      'A new workstream must start as planned, active, or blocked.',
    );
  }
  return { registry: replaceWorkstream(registry, workstream), workstream };
}

function prepareUpdate(
  registry: WorkstreamRegistry,
  input: UpdateWorkstreamInput,
): PreparedWorkstreamMutation {
  const workstream = normalizeWorkstream(input.workstream);
  const previous = existingWorkstream(registry, workstream.workstream_id);
  assertUpdateTransition(previous, workstream);
  if (canonicalJson(previous) === canonicalJson(workstream)) {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_NO_CHANGE',
      `Workstream ${workstream.workstream_id} already has the requested state.`,
    );
  }
  return { registry: replaceWorkstream(registry, workstream), workstream };
}

function prepareCompletion(
  registry: WorkstreamRegistry,
  input: CompleteWorkstreamInput,
): PreparedWorkstreamMutation {
  const previous = existingWorkstream(registry, input.workstream_id);
  if (previous.status !== 'active' && previous.status !== 'blocked') {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_NOT_COMPLETABLE',
      `Workstream ${previous.workstream_id} is ${previous.status}; only active or blocked work can be completed.`,
    );
  }

  const evidence = normalizeEvidence(input.evidence);
  const criterionCounts = new Map<string, number>();
  for (const item of evidence) {
    criterionCounts.set(item.criterion, (criterionCounts.get(item.criterion) ?? 0) + 1);
  }
  const criteria = previous.completion.criteria.map((criterion) => criterion.trim());
  const unknown = evidence.find((item) => !criteria.includes(item.criterion));
  if (unknown !== undefined) {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_EVIDENCE_UNKNOWN',
      `Completion evidence does not match a criterion: ${unknown.criterion}`,
    );
  }
  const duplicate = [...criterionCounts].find(([, count]) => count !== 1);
  if (duplicate !== undefined) {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_EVIDENCE_DUPLICATE',
      `Completion criterion has more than one proof: ${duplicate[0]}`,
    );
  }
  const missing = criteria.find((criterion) => !criterionCounts.has(criterion));
  if (missing !== undefined || evidence.length !== criteria.length) {
    throw new WorkstreamError(
      'PCP_WORKSTREAM_EVIDENCE_INCOMPLETE',
      `Completion requires exactly one proof for every criterion${missing === undefined ? '.' : `; missing: ${missing}`}`,
    );
  }
  for (const dependencyId of previous.dependencies) {
    const dependency = existingWorkstream(registry, dependencyId);
    if (dependency.status !== 'complete') {
      throw new WorkstreamError(
        'PCP_WORKSTREAM_DEPENDENCY_INCOMPLETE',
        `Workstream ${previous.workstream_id} cannot complete before ${dependencyId}.`,
      );
    }
  }

  const workstream = normalizeWorkstream({
    ...previous,
    status: 'complete',
    completion: {
      criteria: previous.completion.criteria,
      evidence,
      announcement: input.announcement.trim(),
    },
  });
  return { registry: replaceWorkstream(registry, workstream), workstream };
}

export function prepareWorkstreamMutation(
  registry: WorkstreamRegistry,
  input: WorkstreamOperationInput,
): PreparedWorkstreamMutation {
  if (input.operation === 'create') return prepareCreate(registry, input);
  if (input.operation === 'update') return prepareUpdate(registry, input);
  return prepareCompletion(registry, input);
}
