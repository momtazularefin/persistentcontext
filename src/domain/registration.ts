import { monotonicFactory, ulid } from 'ulid';

export const ACTOR_TYPES = ['agent', 'human'] as const;
export const ACTOR_CLIENTS = [
  'antigravity',
  'codex',
  'claude',
  'copilot',
  'cursor',
  'human',
] as const;

export const LEGACY_ACTOR_CLIENTS = [
  'claude-code-desktop',
  'github-copilot-vscode',
  'other',
] as const;

export type ActorType = (typeof ACTOR_TYPES)[number];
export type ActorClient = string;

export interface ActorProfile {
  schema_version: 1;
  actor_id: string;
  actor_type: ActorType;
  client: ActorClient;
  machine_label: string;
  first_seen: string;
  checkpoint_paths: string[];
}

export interface ActorIdentityCache {
  schema_version: 1;
  actor_id: string;
  actor_type: ActorType;
  client: ActorClient;
  machine_label: string;
}

export interface RegisterActorInput {
  actor_type?: string;
  client?: string;
  machine_label: string;
  actor_id?: string;
}

export interface NormalizedActorIdentity {
  actor_type: ActorType;
  client: ActorClient;
  machine_label: string;
  actor_id?: string;
}

export interface ActorRegistrationResult {
  schema_version: 1;
  command: 'register';
  status: 'created' | 'recovered';
  actor_id: string;
  actor_type: ActorType;
  client: ActorClient;
  machine_label: string;
  profile_path: string;
  execution_id: string;
  profile_created: boolean;
  cache_created: boolean;
  event_created: false;
  mutated: boolean;
}

export class RegistrationError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly mutated = false,
  ) {
    super(message);
    this.name = 'RegistrationError';
  }
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const APP_LABEL_PATTERN = /^[a-z0-9]+$/u;
const ACTOR_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9A-HJKMNP-TV-Z]{10}$/u;
const MAX_APP_LABEL_LENGTH = 48;
const nextExecutionId = monotonicFactory();

const canonicalClientByLegacyClient = {
  'claude-code-desktop': 'claude',
  'github-copilot-vscode': 'copilot',
} as const satisfies Record<Exclude<(typeof LEGACY_ACTOR_CLIENTS)[number], 'other'>, string>;

function isActorType(value: string): value is ActorType {
  return ACTOR_TYPES.some((candidate) => candidate === value);
}

export function isActorClient(value: string): value is ActorClient {
  return (
    value.length <= MAX_APP_LABEL_LENGTH &&
    APP_LABEL_PATTERN.test(value) &&
    value !== 'human' &&
    value !== 'other'
  );
}

function canonicalAgentClient(value: string): string {
  return (
    canonicalClientByLegacyClient[value as keyof typeof canonicalClientByLegacyClient] ?? value
  );
}

export function actorLabelsForStoredClient(actorType: ActorType, client: string): string[] {
  if (actorType === 'human') return ['human'];
  const canonical = canonicalAgentClient(client);
  return canonical === client ? [canonical] : [canonical, client];
}

export function storedClientNamesForIdentity(actorType: ActorType, client: string): string[] {
  if (actorType === 'human') return ['human'];
  const legacyAliases = Object.entries(canonicalClientByLegacyClient)
    .filter(([, canonical]) => canonical === client)
    .map(([legacy]) => legacy);
  return [client, ...legacyAliases];
}

export function normalizeMachineLabel(hostname: string): string {
  const label = hostname
    .normalize('NFKD')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-+|-+$/gu, '')
    .slice(0, 128)
    .replaceAll(/-+$/gu, '');
  if (label.length === 0) {
    throw new RegistrationError(
      'PCP_REGISTRATION_MACHINE_LABEL_INVALID',
      'The system hostname cannot be converted to a PCP machine label.',
    );
  }
  return label;
}

export function normalizeActorIdentity(input: RegisterActorInput): NormalizedActorIdentity {
  const actorType = input.actor_type ?? 'agent';
  if (!isActorType(actorType)) {
    throw new RegistrationError(
      'PCP_REGISTRATION_ACTOR_TYPE_INVALID',
      `Actor type must be one of: ${ACTOR_TYPES.join(', ')}.`,
    );
  }

  const requestedClient = input.client ?? (actorType === 'human' ? 'human' : undefined);
  if (requestedClient === undefined) {
    throw new RegistrationError(
      'PCP_REGISTRATION_CLIENT_REQUIRED',
      `Agent registration requires --client (${ACTOR_CLIENTS.filter((item) => item !== 'human').join(', ')}, or a one-word app name).`,
    );
  }
  const client = actorType === 'agent' ? canonicalAgentClient(requestedClient) : requestedClient;
  if (actorType === 'human' && requestedClient !== 'human') {
    throw new RegistrationError(
      'PCP_REGISTRATION_CLIENT_MISMATCH',
      'Human registration must use the human client.',
    );
  }
  if (actorType === 'agent' && requestedClient === 'human') {
    throw new RegistrationError(
      'PCP_REGISTRATION_CLIENT_MISMATCH',
      'Agent registration cannot use the human client.',
    );
  }
  const legacyOtherRecovery = requestedClient === 'other' && input.actor_id !== undefined;
  if (actorType === 'agent' && !isActorClient(client) && !legacyOtherRecovery) {
    throw new RegistrationError(
      'PCP_REGISTRATION_CLIENT_INVALID',
      `Client must be one of ${ACTOR_CLIENTS.filter((item) => item !== 'human').join(', ')}, or an undefined app's one-word lowercase name.`,
    );
  }

  if (!SLUG_PATTERN.test(input.machine_label) || input.machine_label.length > 128) {
    throw new RegistrationError(
      'PCP_REGISTRATION_MACHINE_LABEL_INVALID',
      'The normalized system hostname must be a lowercase kebab-case slug with at most 128 characters.',
    );
  }
  if (input.actor_id !== undefined && !ACTOR_ID_PATTERN.test(input.actor_id)) {
    throw new RegistrationError(
      'PCP_REGISTRATION_ACTOR_ID_INVALID',
      'Actor ID must end in a 10-character uppercase Crockford suffix.',
    );
  }

  return {
    actor_type: actorType,
    client,
    machine_label: input.machine_label,
    ...(input.actor_id === undefined ? {} : { actor_id: input.actor_id }),
  };
}

export function createActorId(identity: NormalizedActorIdentity): string {
  const actorLabel = identity.actor_type === 'human' ? 'human' : identity.client;
  return `${actorLabel}-${identity.machine_label}-${ulid().slice(-10)}`;
}

export function createExecutionId(): string {
  return nextExecutionId();
}

export function actorIdentityMatches(
  profile: ActorProfile,
  identity: NormalizedActorIdentity,
): boolean {
  return (
    profile.actor_type === identity.actor_type &&
    actorLabelsForStoredClient(profile.actor_type, profile.client).includes(identity.client) &&
    profile.machine_label === identity.machine_label
  );
}
