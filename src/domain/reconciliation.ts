import { sha256 } from './adoption.js';

export interface WorkstreamState {
  workstream_id: string;
  name: string;
  kind: 'sequential' | 'concurrent' | 'ceb';
  status: 'planned' | 'active' | 'blocked' | 'complete' | 'cancelled';
  paths: string[];
  areas: string[];
  dependencies: string[];
  completion: {
    criteria: string[];
    evidence: Array<{
      criterion: string;
      proof: string;
    }>;
    announcement?: string;
  };
}

export interface ActorReference {
  type: 'human' | 'agent' | 'system';
  id: string;
}

export interface ContinuityEvent {
  schema_version: 1;
  event_id: string;
  payload_digest: string;
  occurred_at: string;
  actor: ActorReference;
  recorded_by: ActorReference;
  basis: 'self' | 'reported' | 'observed' | 'system';
  change_key?: string;
  kind:
    | 'code'
    | 'documentation'
    | 'configuration'
    | 'decision'
    | 'research'
    | 'operations'
    | 'release'
    | 'vcs'
    | 'workstream';
  scopes: string[];
  workstreams: string[];
  summary: string;
  rationale?: string;
  affected_paths: string[];
}

export interface ReconciliationCheckpoint {
  schema_version: 1;
  checkpoint_id: string;
  actor_id: string;
  workstream_id: string | null;
  last_event_id: string | null;
  reconciled_at: string;
  scopes: string[];
  paths: string[];
  dependencies: string[];
}

export interface ReconciliationSelectionInput {
  workstream_id?: string;
  scopes?: readonly string[];
  paths?: readonly string[];
}

export interface ReconciliationSelection {
  workstream_id: string | null;
  workstreams: string[];
  dependencies: string[];
  scopes: string[];
  paths: string[];
  global: boolean;
}

export type RelevanceReason =
  | 'global'
  | 'active-workstream'
  | 'dependency-workstream'
  | 'scope'
  | 'path-overlap'
  | 'shared-protocol'
  | 'shared-policy'
  | 'project-registry'
  | 'workstream-registry'
  | 'shared-project-state';

export interface RelevanceClassification {
  relevant: boolean;
  reasons: RelevanceReason[];
}

export class ReconciliationError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly mutated = false,
  ) {
    super(message);
    this.name = 'ReconciliationError';
  }
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SHARED_SCOPE_REASONS = new Map<string, RelevanceReason>([
  ['protocol', 'shared-protocol'],
  ['policy', 'shared-policy'],
  ['shared-policy', 'shared-policy'],
  ['operations', 'shared-policy'],
  ['project-registry', 'project-registry'],
  ['workstream-registry', 'workstream-registry'],
  ['registry', 'shared-project-state'],
  ['project-state', 'shared-project-state'],
  ['shared', 'shared-project-state'],
]);
const REASON_ORDER: readonly RelevanceReason[] = [
  'global',
  'active-workstream',
  'dependency-workstream',
  'scope',
  'path-overlap',
  'shared-protocol',
  'shared-policy',
  'project-registry',
  'workstream-registry',
  'shared-project-state',
];

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function assertSlug(value: string, field: string): void {
  if (!SLUG_PATTERN.test(value) || value.length > 128) {
    throw new ReconciliationError(
      'PCP_STATUS_SCOPE_INVALID',
      `${field} must be a lowercase kebab-case slug with at most 128 characters.`,
    );
  }
}

function assertPortablePath(value: string): void {
  const segments = value.split('/');
  if (
    value.length === 0 ||
    value.length > 1024 ||
    value.startsWith('/') ||
    /^[A-Za-z]:/u.test(value) ||
    value.includes('\\') ||
    value.includes('//') ||
    segments.includes('..') ||
    (value !== '.' && (segments.includes('.') || value.endsWith('/')))
  ) {
    throw new ReconciliationError(
      'PCP_STATUS_PATH_INVALID',
      `Status paths must be portable project-relative paths: ${value || '<empty>'}.`,
    );
  }
}

function normalizedSlugs(values: readonly string[] | undefined, field: string): string[] {
  for (const value of values ?? []) assertSlug(value, field);
  return sortedUnique(values ?? []);
}

function normalizedPaths(values: readonly string[] | undefined): string[] {
  for (const value of values ?? []) assertPortablePath(value);
  return sortedUnique(values ?? []);
}

export function resolveReconciliationSelection(
  workstreams: readonly WorkstreamState[],
  input: ReconciliationSelectionInput,
): ReconciliationSelection {
  const requestedWorkstream = input.workstream_id;
  if (requestedWorkstream !== undefined) assertSlug(requestedWorkstream, 'Workstream ID');

  const byId = new Map(workstreams.map((workstream) => [workstream.workstream_id, workstream]));
  const selectedIds = new Set<string>();
  const dependencies = new Set<string>();

  if (requestedWorkstream !== undefined) {
    if (!byId.has(requestedWorkstream)) {
      throw new ReconciliationError(
        'PCP_STATUS_WORKSTREAM_NOT_FOUND',
        `Workstream ${requestedWorkstream} does not exist.`,
      );
    }
    const visit = (workstreamId: string): void => {
      if (selectedIds.has(workstreamId)) return;
      selectedIds.add(workstreamId);
      const workstream = byId.get(workstreamId);
      if (workstream === undefined) {
        throw new ReconciliationError(
          'PCP_STATUS_INVALID_LAYER',
          `Workstream ${workstreamId} has an unknown dependency.`,
        );
      }
      for (const dependency of workstream.dependencies) {
        dependencies.add(dependency);
        visit(dependency);
      }
    };
    visit(requestedWorkstream);
    dependencies.delete(requestedWorkstream);
  }

  const selectedWorkstreams = [...selectedIds]
    .map((id) => byId.get(id))
    .filter((workstream): workstream is WorkstreamState => workstream !== undefined);
  const scopes = normalizedSlugs(
    [...(input.scopes ?? []), ...selectedWorkstreams.flatMap((item) => item.areas)],
    'Scope',
  );
  const paths = normalizedPaths([
    ...(input.paths ?? []),
    ...selectedWorkstreams.flatMap((item) => item.paths),
  ]);

  return {
    workstream_id: requestedWorkstream ?? null,
    workstreams: sortedUnique(selectedIds),
    dependencies: sortedUnique(dependencies),
    scopes,
    paths,
    global: requestedWorkstream === undefined && scopes.length === 0 && paths.length === 0,
  };
}

function withoutLayerPrefix(value: string): string {
  return value.startsWith('.pcp/') ? value.slice('.pcp/'.length) : value;
}

function wildcardRoot(value: string): string {
  const wildcard = value.search(/[*?[]/u);
  const root = wildcard === -1 ? value : value.slice(0, wildcard);
  return root.replace(/\/+$/u, '') || '.';
}

export function pathsOverlap(left: string, right: string): boolean {
  const leftRoot = wildcardRoot(left);
  const rightRoot = wildcardRoot(right);
  return (
    leftRoot === '.' ||
    rightRoot === '.' ||
    leftRoot === rightRoot ||
    leftRoot.startsWith(`${rightRoot}/`) ||
    rightRoot.startsWith(`${leftRoot}/`)
  );
}

function sharedPathReason(value: string): RelevanceReason | undefined {
  const relative = withoutLayerPrefix(value);
  if (relative === 'pcp.yaml' || relative === 'protocol' || relative.startsWith('protocol/')) {
    return 'shared-protocol';
  }
  if (
    relative === 'state/vcs-policy.yaml' ||
    relative === 'operations' ||
    relative.startsWith('operations/')
  ) {
    return 'shared-policy';
  }
  if (relative === 'state/projects.yaml') return 'project-registry';
  if (relative === 'state/workstreams.yaml') return 'workstream-registry';
  if (relative === 'state/project.yaml') return 'shared-project-state';
  return undefined;
}

export function classifyEventRelevance(
  event: ContinuityEvent,
  selection: ReconciliationSelection,
): RelevanceClassification {
  const reasons = new Set<RelevanceReason>();
  if (selection.global) reasons.add('global');

  for (const workstream of event.workstreams) {
    if (workstream === selection.workstream_id) reasons.add('active-workstream');
    if (selection.dependencies.includes(workstream)) reasons.add('dependency-workstream');
  }
  if (event.scopes.some((scope) => selection.scopes.includes(scope))) reasons.add('scope');
  if (
    event.affected_paths.some((affectedPath) =>
      selection.paths.some((selectedPath) => pathsOverlap(affectedPath, selectedPath)),
    )
  ) {
    reasons.add('path-overlap');
  }

  for (const scope of event.scopes) {
    const reason = SHARED_SCOPE_REASONS.get(scope);
    if (reason !== undefined) reasons.add(reason);
  }
  for (const affectedPath of event.affected_paths) {
    const reason = sharedPathReason(affectedPath);
    if (reason !== undefined) reasons.add(reason);
  }

  const ordered = REASON_ORDER.filter((reason) => reasons.has(reason));
  return { relevant: ordered.length > 0, reasons: ordered };
}

export function checkpointIdentity(checkpoint: {
  actor_id: string;
  workstream_id: string | null;
  scopes: readonly string[];
  paths: readonly string[];
  dependencies: readonly string[];
}): string {
  return JSON.stringify({
    actor_id: checkpoint.actor_id,
    workstream_id: checkpoint.workstream_id,
    scopes: sortedUnique(checkpoint.scopes),
    paths: sortedUnique(checkpoint.paths),
    dependencies: sortedUnique(checkpoint.dependencies),
  });
}

export function baselineContextPaths(selection: ReconciliationSelection): string[] {
  return sortedUnique([
    '.pcp/pcp.yaml',
    '.pcp/protocol/00-index.md',
    '.pcp/knowledge/00-index.md',
    '.pcp/operations/00-index.md',
    '.pcp/state/project.yaml',
    '.pcp/state/projects.yaml',
    '.pcp/state/workstreams.yaml',
    '.pcp/state/vcs-policy.yaml',
    ...selection.paths,
  ]);
}

export function reconciliationDigest(value: unknown): string {
  return sha256(JSON.stringify(value));
}
