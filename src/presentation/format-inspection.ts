import type { InspectionResult } from '../domain/inspection.js';

export function formatInspection(result: InspectionResult): string {
  const lines = [
    'PCP repository inspection',
    `State: ${result.state}`,
    `Confidence: ${result.confidence}`,
    `Inventory: ${result.inventory.counts.files} files, ${result.inventory.counts.directories} directories, ${result.inventory.counts.symlinks} symlinks`,
    `Digest: ${result.inventory.digest}`,
  ];

  if (result.signals.length === 0) {
    lines.push('Signals: none (seed or empty project)');
  } else {
    lines.push('Signals:');
    for (const signal of result.signals) {
      lines.push(`- [${signal.category}] ${signal.path}: ${signal.reason}`);
    }
  }

  if (result.foreignCandidates.length > 0) {
    lines.push('Foreign context candidates:');
    for (const candidate of result.foreignCandidates) {
      lines.push(`- ${candidate.root}: ${candidate.categories.join(', ')}`);
    }
  }

  if (result.inventory.exclusions.length > 0) {
    lines.push('Exclusions:');
    for (const exclusion of result.inventory.exclusions) {
      lines.push(`- [${exclusion.reason}] ${exclusion.path}`);
    }
  }

  if (result.ambiguities.length > 0) {
    lines.push('Review before adoption:');
    for (const ambiguity of result.ambiguities) {
      lines.push(`- ${ambiguity.code}: ${ambiguity.message}`);
    }
  }

  lines.push('Mutation: none');
  return `${lines.join('\n')}\n`;
}
