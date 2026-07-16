import type { UpgradeApplyResult, UpgradePreview } from '../domain/upgrade.js';

export function formatUpgrade(result: UpgradePreview | UpgradeApplyResult): string {
  if (result.mutated) {
    return `${[
      `PCP upgrade applied: ${result.from_version} -> ${result.to_version}`,
      `Plan digest: ${result.plan_digest}`,
      `Upgraded paths: ${result.upgraded_paths.length}`,
      `Preserved files: ${result.preserved_files}`,
      ...result.upgraded_paths.map((upgradePath) => `- ${upgradePath}`),
    ].join('\n')}\n`;
  }
  const lines = [
    `PCP upgrade preview: ${result.applicable ? 'approval required' : 'current'}`,
    `Version: ${result.from_version} -> ${result.to_version}`,
    `Upgrade paths: ${result.upgrade_paths.length}`,
    `Preserved files: ${result.preserved_files}`,
    ...result.upgrade_paths.map((upgradePath) => `- ${upgradePath}`),
  ];
  if (result.plan !== undefined) lines.push(`Plan digest: ${result.plan.plan_digest}`);
  return `${lines.join('\n')}\n`;
}
