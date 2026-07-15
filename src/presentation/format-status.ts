import type { StatusResult } from '../application/report-status.js';

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

export function formatStatus(result: StatusResult): string {
  const lines = [
    `PCP status for ${result.actor_id}`,
    `Checkpoint: ${result.checkpoint.state}`,
    `Relevant: ${countLabel(result.relevant_changes.length, 'change')}`,
    `Out of scope: ${countLabel(result.out_of_scope_changes.length, 'change')}`,
  ];

  if (result.baseline.required) {
    lines.push(`Baseline required: ${result.baseline.context_paths.join(', ')}`);
  } else if (result.required_context_paths.length > 0) {
    lines.push(`Read current state: ${result.required_context_paths.join(', ')}`);
  }

  if (result.mode === 'acknowledge') {
    lines.push(
      result.mutated
        ? `Acknowledged ${result.status_digest}; checkpoint advanced.`
        : `Acknowledged ${result.status_digest}; checkpoint was already current.`,
    );
  } else if (result.acknowledgement.required) {
    lines.push(`After absorbing this context, acknowledge digest ${result.status_digest}.`);
  } else {
    lines.push('No acknowledgement is needed.');
  }

  return `${lines.join('\n')}\n`;
}
