export interface WorkstreamState {
  workstream_id: string;
  name: string;
  kind: 'sequential' | 'concurrent';
  status: 'planned' | 'active' | 'blocked' | 'complete' | 'cancelled';
  paths: string[];
  areas: string[];
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
