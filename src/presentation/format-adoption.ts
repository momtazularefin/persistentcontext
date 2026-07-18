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
  if (result.foreign_roots !== undefined) {
    output += line('Detected foreign roots:');
    for (const root of result.foreign_roots) {
      output += line(`- ${root.root}: ${root.disposition}`);
    }
  }
  if (result.coverage !== undefined) {
    output += line(`Foreign coverage records: ${result.coverage.records.length}`);
    output += line(`Unresolved coverage records: ${result.coverage.unresolved_count}`);
  }
  if (result.coverage_status !== undefined) {
    output += line(`Coverage review: ${result.coverage_status}`);
  }
  if (result.adapters !== undefined) {
    output += line('Generated platform adapters:');
    for (const adapter of result.adapters) {
      output += line(`- ${adapter.adapter_id}: ${adapter.target_path}`);
    }
  }
  if (result.coverage_issues !== undefined && result.coverage_issues.length > 0) {
    output += line('Blocking foreign-source issues:');
    for (const issue of result.coverage_issues) {
      output += line(`- ${issue.code} ${issue.path}: ${issue.message}`);
    }
  }
  if (result.plan !== undefined) {
    output += line(`Plan digest: ${result.plan.plan_digest}`);
    if (result.plan.coverage_digest !== undefined) {
      output += line(`Coverage digest: ${result.plan.coverage_digest}`);
    }
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
