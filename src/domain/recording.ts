import { decodeTime, ulid } from 'ulid';

import type { ActorReference, ContinuityEvent } from './reconciliation.js';

export interface RecordEventInput {
  schema_version: 1;
  occurred_at?: string;
  actor: ActorReference;
  recorded_by: ActorReference;
  basis: ContinuityEvent['basis'];
  kind: ContinuityEvent['kind'];
  scopes: string[];
  workstreams: string[];
  summary: string;
  rationale?: string;
  affected_paths: string[];
}

export interface RecordEventResult {
  schema_version: 1;
  command: 'record';
  status: 'recorded';
  event_id: string;
  event_path: string;
  occurred_at: string;
  summary: string;
  active_events: number;
  archived_events_moved: number;
  event_created: true;
  mutated: true;
}

export class RecordingError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly mutated = false,
    public readonly recovery_retained = false,
  ) {
    super(message);
    this.name = 'RecordingError';
  }
}

export function nextEventId(existingIds: readonly string[], now = Date.now()): string {
  const newest = [...existingIds].sort((left, right) => left.localeCompare(right)).at(-1);
  const timestamp = newest === undefined ? now : Math.max(now, decodeTime(newest) + 1);
  return ulid(timestamp);
}
