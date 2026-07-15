import type { RepairApplyResult, RepairPreview } from '../domain/repair.js';

export function formatRepair(result: RepairPreview | RepairApplyResult): string {
  if (result.mutated) {
    return `${[
      `PCP repair applied: ${result.repaired_paths.length} adapter(s)`,
      `Plan digest: ${result.plan_digest}`,
      `Operations: ${result.applied_operations}`,
      ...result.repaired_paths.map((repairPath) => `- ${repairPath}`),
    ].join('\n')}\n`;
  }
  const lines = [
    `PCP repair preview: ${result.applicable ? 'approval required' : 'current'}`,
    `Repair paths: ${result.repair_paths.length}`,
    ...result.repair_paths.map((repairPath) => `- ${repairPath}`),
  ];
  if (result.plan !== undefined) lines.push(`Plan digest: ${result.plan.plan_digest}`);
  return `${lines.join('\n')}\n`;
}
