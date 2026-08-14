import type { UpgradeCheckResult } from '../domain/update-check.js';

export function formatUpgradeCheck(result: UpgradeCheckResult): string {
  return `${[
    `PCP canonical-source update check: ${result.availability}`,
    `Installed version: ${result.installed_version}`,
    `Available version: ${result.available_version}`,
    `Source revision: ${result.source_revision_url}`,
    ...result.next_actions.map((action) => `- ${action}`),
  ].join('\n')}\n`;
}
