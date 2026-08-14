import type { PurgeHistoryApplyResult, PurgeHistoryPreview } from '../domain/purge-history.js';

export function formatPurgeHistory(result: PurgeHistoryPreview | PurgeHistoryApplyResult): string {
  if (result.mutated) {
    return `${[
      'PCP actor and continuity history purged.',
      `Plan digest: ${result.plan_digest}`,
      `Purged files: ${result.purged_paths.length}`,
      result.next_action,
    ].join('\n')}\n`;
  }
  const lines = [
    `PCP history purge preview: ${result.applicable ? 'explicit approval required' : 'already empty'}`,
    `Purge files: ${result.purge_paths.length}`,
    result.warning,
    ...result.purge_paths.map((purgePath) => `- ${purgePath}`),
  ];
  if (result.plan !== undefined) lines.push(`Plan digest: ${result.plan.plan_digest}`);
  return `${lines.join('\n')}\n`;
}
