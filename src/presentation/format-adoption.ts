import type { AdoptionApplyResult, AdoptionPreview } from '../domain/adoption.js';

function line(value = ''): string {
  return `${value}\n`;
}

export function formatAdoption(result: AdoptionPreview | AdoptionApplyResult): string {
  let output = line('PCP adoption');
  output += line(`State: ${result.classification}`);

  if (result.mutated) {
    output += line(`Plan digest: ${result.plan_digest}`);
    output += line(`Applied operations: ${result.applied_operations}`);
    output += line(`Validated canonical files: ${result.validation.checked_files}`);
    output += line('Clean genesis: 0 actor profiles, 0 active events, 0 archived events');
    output += line('Recovery material: cleaned');
    output += line('Mutation: applied');
    return output;
  }

  output += line(`Confidence: ${result.confidence}`);
  output += line(`Applicable: ${result.applicable ? 'yes' : 'no'}`);
  output += line(`Suggested project id: ${result.baseline.suggested_project_id}`);
  if (result.baseline.evidence_groups.length > 0) {
    output += line('Evidence inputs:');
    for (const group of result.baseline.evidence_groups) {
      output += line(`- ${group.category}: ${group.paths.join(', ') || '(none)'}`);
    }
  }
  if (result.questions.length > 0) {
    output += line('Required inputs:');
    for (const question of result.questions) {
      output += line(`- ${question.id}: ${question.prompt}`);
      if (question.when !== undefined) output += line(`  when: ${question.when}`);
    }
  }
  if (result.plan !== undefined) {
    output += line(`Plan digest: ${result.plan.plan_digest}`);
    output += line('Operations:');
    for (const operation of result.plan.operations) {
      const digest =
        operation.content_digest === undefined ? '' : ` sha256:${operation.content_digest}`;
      const source = operation.source_path === undefined ? '' : ` from:${operation.source_path}`;
      output += line(
        `- ${operation.operation_id} ${operation.action} ${operation.path}${source}${digest}`,
      );
    }
    output += line(`Validations: ${result.plan.validations.join(', ')}`);
  }
  output += line('Mutation: none');
  return output;
}
