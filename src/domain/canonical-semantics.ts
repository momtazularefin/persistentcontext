import type { CanonicalDiagnostic } from './canonical-validation.js';

export interface CanonicalRecord {
  path: string;
  value: unknown;
}

export interface CanonicalSemanticRecords {
  project?: CanonicalRecord;
  project_registry?: CanonicalRecord;
  workstreams?: CanonicalRecord;
  vcs_policy?: CanonicalRecord;
  actors: CanonicalRecord[];
  events: CanonicalRecord[];
  checkpoints: CanonicalRecord[];
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function objectArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.map(objectValue).filter((item): item is Record<string, unknown> => item !== undefined)
    : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function error(code: string, path: string, message: string): CanonicalDiagnostic {
  return { severity: 'error', code, path, message };
}

function validateProjectIdentity(records: CanonicalSemanticRecords): CanonicalDiagnostic[] {
  const diagnostics: CanonicalDiagnostic[] = [];
  const seen = new Map<string, string>();
  const rootProject = objectValue(records.project?.value);
  const rootId = stringValue(rootProject?.project_id);
  if (rootId !== undefined && records.project !== undefined) seen.set(rootId, records.project.path);

  const registry = objectValue(records.project_registry?.value);
  for (const project of objectArray(registry?.projects)) {
    const projectId = stringValue(project.project_id);
    if (projectId === undefined || records.project_registry === undefined) continue;
    const previous = seen.get(projectId);
    if (previous !== undefined) {
      diagnostics.push(
        error(
          'identity.duplicate-project',
          records.project_registry.path,
          `Project ID ${projectId} duplicates ${previous}.`,
        ),
      );
    } else {
      seen.set(projectId, records.project_registry.path);
    }
  }
  return diagnostics;
}

function validateWorkstreams(records: CanonicalSemanticRecords): CanonicalDiagnostic[] {
  if (records.workstreams === undefined) return [];
  const diagnostics: CanonicalDiagnostic[] = [];
  const root = objectValue(records.workstreams.value);
  const workstreams = objectArray(root?.workstreams);
  const byId = new Map<string, Record<string, unknown>>();

  for (const workstream of workstreams) {
    const id = stringValue(workstream.workstream_id);
    if (id === undefined) continue;
    if (byId.has(id)) {
      diagnostics.push(
        error(
          'identity.duplicate-workstream',
          records.workstreams.path,
          `Workstream ID ${id} is not unique.`,
        ),
      );
    } else {
      byId.set(id, workstream);
    }
  }

  for (const [id, workstream] of byId) {
    for (const dependency of stringArray(workstream.dependencies)) {
      if (dependency === id) {
        diagnostics.push(
          error(
            'workstream.self-dependency',
            records.workstreams.path,
            `Workstream ${id} depends on itself.`,
          ),
        );
      } else if (!byId.has(dependency)) {
        diagnostics.push(
          error(
            'workstream.missing-dependency',
            records.workstreams.path,
            `Workstream ${id} depends on unknown workstream ${dependency}.`,
          ),
        );
      }
    }

    const completion = objectValue(workstream.completion);
    if (workstream.status === 'complete' && stringArray(completion?.evidence).length === 0) {
      diagnostics.push(
        error(
          'workstream.completion-without-evidence',
          records.workstreams.path,
          `Complete workstream ${id} has no completion evidence.`,
        ),
      );
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string, trail: string[]): void {
    if (visiting.has(id)) {
      const start = trail.indexOf(id);
      const cycle = [...trail.slice(Math.max(start, 0)), id];
      diagnostics.push(
        error(
          'workstream.dependency-cycle',
          records.workstreams?.path ?? 'state/workstreams.yaml',
          `Workstream dependency cycle: ${cycle.join(' -> ')}.`,
        ),
      );
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    const workstream = byId.get(id);
    for (const dependency of stringArray(workstream?.dependencies)) {
      if (byId.has(dependency)) visit(dependency, [...trail, id]);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of byId.keys()) visit(id, []);

  return diagnostics;
}

function validateActors(records: CanonicalSemanticRecords): CanonicalDiagnostic[] {
  const diagnostics: CanonicalDiagnostic[] = [];
  const seen = new Map<string, string>();
  for (const record of records.actors) {
    const profile = objectValue(record.value);
    const id = stringValue(profile?.actor_id);
    if (id === undefined) continue;
    const expectedName = `${id}.yaml`;
    if (!record.path.endsWith(`/${expectedName}`)) {
      diagnostics.push(
        error(
          'identity.actor-filename-mismatch',
          record.path,
          `Actor profile filename must be ${expectedName}.`,
        ),
      );
    }
    const actorType = stringValue(profile?.actor_type);
    const client = stringValue(profile?.client);
    const machineLabel = stringValue(profile?.machine_label);
    const actorLabel = actorType === 'human' ? 'human' : client;
    if (
      actorLabel !== undefined &&
      machineLabel !== undefined &&
      !id.startsWith(`${actorLabel}-${machineLabel}-`)
    ) {
      diagnostics.push(
        error(
          'identity.actor-id-components',
          record.path,
          `Actor ID must start with ${actorLabel}-${machineLabel}-.`,
        ),
      );
    }
    const previous = seen.get(id);
    if (previous !== undefined) {
      diagnostics.push(
        error('identity.duplicate-actor', record.path, `Actor ID ${id} duplicates ${previous}.`),
      );
    } else {
      seen.set(id, record.path);
    }
  }
  return diagnostics;
}

function validateEvents(records: CanonicalSemanticRecords): CanonicalDiagnostic[] {
  const diagnostics: CanonicalDiagnostic[] = [];
  const seen = new Map<string, string>();
  const actorTypes = new Map(
    records.actors
      .map((record) => {
        const profile = objectValue(record.value);
        return [stringValue(profile?.actor_id), stringValue(profile?.actor_type)] as const;
      })
      .filter(
        (entry): entry is readonly [string, string] =>
          entry[0] !== undefined && entry[1] !== undefined,
      ),
  );
  const workstreamRoot = objectValue(records.workstreams?.value);
  const workstreamIds = new Set(
    objectArray(workstreamRoot?.workstreams)
      .map((workstream) => stringValue(workstream.workstream_id))
      .filter((id): id is string => id !== undefined),
  );
  for (const record of records.events) {
    const event = objectValue(record.value);
    const id = stringValue(event?.event_id);
    if (id === undefined) continue;
    const expectedName = `${id}.yaml`;
    if (!record.path.endsWith(`/${expectedName}`)) {
      diagnostics.push(
        error('event.filename-mismatch', record.path, `Event filename must be ${expectedName}.`),
      );
    }
    const previous = seen.get(id);
    if (previous !== undefined) {
      diagnostics.push(
        error('event.duplicate', record.path, `Event ID ${id} duplicates ${previous}.`),
      );
    } else {
      seen.set(id, record.path);
    }

    const actor = objectValue(event?.actor);
    const recorder = objectValue(event?.recorded_by);
    const actorType = stringValue(actor?.type);
    const actorId = stringValue(actor?.id);
    const recorderType = stringValue(recorder?.type);
    const recorderId = stringValue(recorder?.id);
    const basis = stringValue(event?.basis);

    for (const [role, referenceType, referenceId] of [
      ['actor', actorType, actorId],
      ['recorder', recorderType, recorderId],
    ] as const) {
      if ((referenceType === 'human' || referenceType === 'agent') && referenceId !== undefined) {
        const profileType = actorTypes.get(referenceId);
        if (profileType === undefined) {
          diagnostics.push(
            error(
              `event.unknown-${role}`,
              record.path,
              `Event ${role} references unknown ${referenceType} ${referenceId}.`,
            ),
          );
        } else if (profileType !== referenceType) {
          diagnostics.push(
            error(
              `event.${role}-type-mismatch`,
              record.path,
              `Event ${role} type ${referenceType} does not match profile type ${profileType}.`,
            ),
          );
        }
      }
    }

    const sameIdentity = actorType === recorderType && actorId === recorderId;
    if (basis === 'self' && !sameIdentity) {
      diagnostics.push(
        error(
          'event.self-recorder-mismatch',
          record.path,
          'A self-recorded event must name the same actor and recorder.',
        ),
      );
    }
    if ((basis === 'reported' || basis === 'observed') && sameIdentity) {
      diagnostics.push(
        error(
          'event.external-basis-self-recorded',
          record.path,
          `A ${basis} event must be recorded by a different actor.`,
        ),
      );
    }
    if (basis === 'system' && (actorType !== 'system' || recorderType !== 'system')) {
      diagnostics.push(
        error(
          'event.system-basis-mismatch',
          record.path,
          'A system-basis event must name system as both actor and recorder.',
        ),
      );
    }
    for (const workstreamId of stringArray(event?.workstreams)) {
      if (!workstreamIds.has(workstreamId)) {
        diagnostics.push(
          error(
            'event.unknown-workstream',
            record.path,
            `Event references unknown workstream ${workstreamId}.`,
          ),
        );
      }
    }
  }
  return diagnostics;
}

function validateCheckpoints(records: CanonicalSemanticRecords): CanonicalDiagnostic[] {
  const diagnostics: CanonicalDiagnostic[] = [];
  const checkpointIdentities = new Map<string, string>();
  const actorTypes = new Map(
    records.actors
      .map((record) => {
        const profile = objectValue(record.value);
        return [stringValue(profile?.actor_id), stringValue(profile?.actor_type)] as const;
      })
      .filter(
        (entry): entry is readonly [string, string] =>
          entry[0] !== undefined && entry[1] !== undefined,
      ),
  );
  const eventIds = new Set(
    records.events
      .map((record) => stringValue(objectValue(record.value)?.event_id))
      .filter((id): id is string => id !== undefined),
  );
  const workstreamRoot = objectValue(records.workstreams?.value);
  const workstreamIds = new Set(
    objectArray(workstreamRoot?.workstreams)
      .map((workstream) => stringValue(workstream.workstream_id))
      .filter((id): id is string => id !== undefined),
  );

  for (const record of records.checkpoints) {
    const checkpoint = objectValue(record.value);
    const checkpointId = stringValue(checkpoint?.checkpoint_id);
    if (checkpointId !== undefined && !record.path.endsWith(`/${checkpointId}.yaml`)) {
      diagnostics.push(
        error(
          'checkpoint.filename-mismatch',
          record.path,
          `Checkpoint filename must be ${checkpointId}.yaml.`,
        ),
      );
    }
    const actorId = stringValue(checkpoint?.actor_id);
    if (actorId !== undefined) {
      const actorType = actorTypes.get(actorId);
      if (actorType === undefined) {
        diagnostics.push(
          error(
            'checkpoint.unknown-actor',
            record.path,
            `Checkpoint references unknown actor ${actorId}.`,
          ),
        );
      } else if (actorType !== 'agent') {
        diagnostics.push(
          error(
            'checkpoint.human-actor',
            record.path,
            `Checkpoint actor ${actorId} must be an agent.`,
          ),
        );
      }
    }
    const workstreamId = stringValue(checkpoint?.workstream_id);
    if (workstreamId !== undefined && !workstreamIds.has(workstreamId)) {
      diagnostics.push(
        error(
          'checkpoint.unknown-workstream',
          record.path,
          `Checkpoint references unknown workstream ${workstreamId}.`,
        ),
      );
    }
    for (const dependency of stringArray(checkpoint?.dependencies)) {
      if (!workstreamIds.has(dependency)) {
        diagnostics.push(
          error(
            'checkpoint.unknown-dependency',
            record.path,
            `Checkpoint references unknown dependency workstream ${dependency}.`,
          ),
        );
      }
    }
    const eventId = stringValue(checkpoint?.last_event_id);
    if (eventId !== undefined && !eventIds.has(eventId)) {
      diagnostics.push(
        error(
          'checkpoint.unknown-event',
          record.path,
          `Checkpoint references unknown event ${eventId}.`,
        ),
      );
    }

    if (actorId !== undefined) {
      const identity = JSON.stringify({
        actor_id: actorId,
        workstream_id: workstreamId ?? null,
        scopes: stringArray(checkpoint?.scopes).sort(),
        paths: stringArray(checkpoint?.paths).sort(),
        dependencies: stringArray(checkpoint?.dependencies).sort(),
      });
      const previous = checkpointIdentities.get(identity);
      if (previous !== undefined) {
        diagnostics.push(
          error(
            'checkpoint.duplicate-scope',
            record.path,
            `Checkpoint duplicates the actor and scope identity in ${previous}.`,
          ),
        );
      } else {
        checkpointIdentities.set(identity, record.path);
      }
    }
  }
  return diagnostics;
}

function validateVcsPolicy(records: CanonicalSemanticRecords): CanonicalDiagnostic[] {
  if (records.vcs_policy === undefined) return [];
  const policy = objectValue(records.vcs_policy.value);
  const responsibilities = objectValue(policy?.responsibilities);
  if (responsibilities?.manage_credentials === 'agent') {
    return [
      error(
        'vcs.agent-credential-management',
        records.vcs_policy.path,
        'Agents cannot be assigned credential management; use a human, external system, or prohibited.',
      ),
    ];
  }
  return [];
}

export function validateCanonicalSemantics(
  records: CanonicalSemanticRecords,
): CanonicalDiagnostic[] {
  return [
    ...validateProjectIdentity(records),
    ...validateWorkstreams(records),
    ...validateActors(records),
    ...validateEvents(records),
    ...validateCheckpoints(records),
    ...validateVcsPolicy(records),
  ];
}
