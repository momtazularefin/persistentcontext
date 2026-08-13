import { sha256 } from './adoption.js';
import type { ActorReference, ContinuityEvent } from './reconciliation.js';

export interface SynchronizationCheckpoint {
  schema_version: 1;
  checkpoint_id: string;
  actor_id: string;
  execution_id: string;
  last_event_id: string | null;
  reconciled_at: string;
}

export interface SyncInput {
  actor_id: string;
  execution_id: string;
  acknowledge?: string;
}

export type SyncCheckpointState = 'missing' | 'behind-active-floor' | 'changes-pending' | 'current';

export interface SyncChange {
  event_id: string;
  occurred_at: string;
  actor: ActorReference;
  recorded_by: ActorReference;
  basis: ContinuityEvent['basis'];
  kind: ContinuityEvent['kind'];
  summary: string;
  rationale?: string;
  scopes: string[];
  workstreams: string[];
  affected_paths: string[];
}

export interface SyncResult {
  schema_version: 1;
  command: 'sync';
  mode: 'preview' | 'acknowledge';
  actor_id: string;
  execution_id: string;
  checkpoint: {
    state: SyncCheckpointState;
    previous_state: SyncCheckpointState | null;
    checkpoint_id: string;
    checkpoint_path: string;
    last_event_id: string | null;
    active_floor_event_id: string | null;
    newest_active_event_id: string | null;
  };
  baseline: {
    required: boolean;
    reason: 'first-execution-baseline' | 'checkpoint-before-active-floor' | null;
    context_paths: string[];
  };
  changes: SyncChange[];
  required_context_paths: string[];
  sync_digest: string;
  acknowledgement: {
    required: boolean;
    accepted: boolean;
  };
  event_created: false;
  mutated: boolean;
}

export class SynchronizationError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly mutated = false,
  ) {
    super(message);
    this.name = 'SynchronizationError';
  }
}

export function synchronizationDigest(value: unknown): string {
  return sha256(JSON.stringify(value));
}
