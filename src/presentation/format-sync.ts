import type { SyncResult } from '../domain/synchronization.js';

function reference(reference: { type: string; id: string }): string {
  return `${reference.type}:${reference.id}`;
}

export function formatSync(result: SyncResult): string {
  const lines = [
    result.checkpoint.state === 'current'
      ? 'PCP sync: current — no project updates.'
      : result.baseline.required
        ? 'PCP sync: baseline required.'
        : `PCP sync: ${result.changes.length} project update${result.changes.length === 1 ? '' : 's'}.`,
    `Actor: ${result.actor_id}`,
    `Execution: ${result.execution_id}`,
  ];

  for (const change of result.changes) {
    lines.push(
      '',
      `Event ${change.event_id} | ${change.occurred_at} | ${change.kind} | ${change.basis}`,
      `Performed by: ${reference(change.actor)}; recorded by: ${reference(change.recorded_by)}`,
      `Summary: ${change.summary}`,
    );
    if (change.rationale !== undefined) lines.push(`Rationale: ${change.rationale}`);
    if (change.affected_paths.length > 0) {
      lines.push(`Affected paths: ${change.affected_paths.join(', ')}`);
    }
  }

  if (result.required_context_paths.length > 0) {
    lines.push('', `Read current state: ${result.required_context_paths.join(', ')}`);
  }
  if (result.mode === 'acknowledge') {
    lines.push(
      '',
      result.mutated
        ? `Acknowledged ${result.sync_digest}; execution checkpoint advanced.`
        : `Acknowledged ${result.sync_digest}; execution checkpoint was already current.`,
    );
  } else if (result.acknowledgement.required) {
    lines.push('', `After absorbing this context, acknowledge digest ${result.sync_digest}.`);
  }
  return `${lines.join('\n')}\n`;
}
