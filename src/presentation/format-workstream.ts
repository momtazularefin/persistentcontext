import type { WorkstreamResult } from '../domain/workstreams.js';

export function formatWorkstream(result: WorkstreamResult): string {
  if (result.operation === 'validate') {
    return [
      `Validated ${result.workstream_count} workstream${result.workstream_count === 1 ? '' : 's'}.`,
      `Registry digest: ${result.registry_digest}`,
      ...(result.workstream === null
        ? []
        : [
            `Selected: ${result.workstream.workstream_id} (${result.workstream.status}, ${result.workstream.kind})`,
          ]),
      '',
    ].join('\n');
  }

  return [
    `${result.status[0]?.toUpperCase()}${result.status.slice(1)} workstream ${result.workstream_id}.`,
    `Event: ${result.event_id}`,
    `Registry digest: ${result.registry_digest_after}`,
    ...(result.announcement === null ? [] : [`Announcement: ${result.announcement}`]),
    ...(result.recovery_retained ? ['Warning: recovery material was retained.'] : []),
    '',
  ].join('\n');
}
