import type { RecordEventResult } from '../domain/recording.js';

export function formatRecording(result: RecordEventResult): string {
  return [
    `Recorded event ${result.event_id}.`,
    `Summary: ${result.summary}`,
    `Path: ${result.event_path}`,
    `Active events: ${result.active_events}`,
    `Archived in this operation: ${result.archived_events_moved}`,
    '',
  ].join('\n');
}
