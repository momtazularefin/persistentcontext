import type { UpgradeApplyResult, UpgradePreview } from '../domain/upgrade.js';

export function formatUpgrade(result: UpgradePreview | UpgradeApplyResult): string {
  if (result.mutated) {
    return `${[
      `PCP upgrade applied: ${result.from_version} -> ${result.to_version}`,
      `Plan digest: ${result.plan_digest}`,
      `Upgraded paths: ${result.upgraded_paths.length}`,
      `Release-owned paths: ${result.release_owned_paths.length}`,
      `Mechanical migration paths: ${result.mechanical_migration_paths.length}`,
      `Preserved files: ${result.preserved_files}`,
      `Agent semantic review: ${result.agent_migration.required ? 'required' : 'not required'}`,
      ...result.upgraded_paths.map((upgradePath) => `- ${upgradePath}`),
      ...(result.history_purge.prompt_after_completion
        ? [
            'Ask the human whether to purge PCP actor and continuity history after semantic review and validation.',
          ]
        : []),
    ].join('\n')}\n`;
  }
  const lines = [
    `PCP upgrade preview: ${result.applicable ? 'approval required' : 'current'}`,
    `Version: ${result.from_version} -> ${result.to_version}`,
    `Upgrade paths: ${result.upgrade_paths.length}`,
    `Release-owned paths: ${result.release_owned_paths.length}`,
    `Mechanical migration paths: ${result.mechanical_migration_paths.length}`,
    `Preserved files: ${result.preserved_files}`,
    `Agent semantic review: ${result.agent_migration.required ? 'required' : 'not required'}`,
    ...result.upgrade_paths.map((upgradePath) => `- ${upgradePath}`),
  ];
  if (result.plan !== undefined) lines.push(`Plan digest: ${result.plan.plan_digest}`);
  return `${lines.join('\n')}\n`;
}
