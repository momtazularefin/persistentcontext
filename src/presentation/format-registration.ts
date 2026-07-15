import type { ActorRegistrationResult } from '../domain/registration.js';

export function formatRegistration(result: ActorRegistrationResult): string {
  const verb = result.status === 'created' ? 'Created' : 'Recovered';
  return [
    `${verb} actor ${result.actor_id}.`,
    `Execution: ${result.execution_id}`,
    `Profile: ${result.profile_path}`,
    'Continuity event: none',
    '',
  ].join('\n');
}
