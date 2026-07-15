import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

import { SCHEMA_NAMES, type SchemaName } from '../../src/domain/schema-catalog.js';
import { ACTOR_CLIENTS } from '../../src/domain/registration.js';
import { SchemaRegistry } from '../../src/infrastructure/schema-validator.js';

interface InvalidFixture {
  name: string;
  operation: 'set' | 'delete';
  path: string;
  profile?: string;
  value?: unknown;
}

interface SchemaFixture {
  schema: SchemaName;
  valid: unknown;
  profiles?: Record<string, unknown>;
  invalid: InvalidFixture[];
}

const fixtureRoot = fileURLToPath(new URL('../fixtures/schemas/', import.meta.url));

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null;
}

function applyInvalidFixture(source: unknown, fixture: InvalidFixture): unknown {
  const result: unknown = structuredClone(source);
  const segments = fixture.path.split('.');
  const finalSegment = segments.pop();
  if (finalSegment === undefined || !isContainer(result)) {
    throw new Error(`Invalid fixture patch path: ${fixture.path}`);
  }

  let parent: Record<string, unknown> | unknown[] = result;
  for (const segment of segments) {
    const key = Array.isArray(parent) ? Number(segment) : segment;
    const child: unknown = parent[key as never];
    if (!isContainer(child)) throw new Error(`Fixture patch path not found: ${fixture.path}`);
    parent = child;
  }

  const key = Array.isArray(parent) ? Number(finalSegment) : finalSegment;
  if (fixture.operation === 'delete') {
    if (Array.isArray(parent)) {
      parent.splice(key as number, 1);
    } else {
      Reflect.deleteProperty(parent, key);
    }
  } else {
    parent[key as never] = fixture.value as never;
  }
  return result;
}

async function loadFixture(name: SchemaName): Promise<SchemaFixture> {
  const contents = await readFile(path.join(fixtureRoot, `${name}.yaml`), 'utf8');
  return parse(contents) as SchemaFixture;
}

describe('canonical schema catalogue', () => {
  it('compiles every release schema in strict draft 2020-12 mode', () => {
    expect(() => new SchemaRegistry()).not.toThrow();
    expect(SCHEMA_NAMES).toHaveLength(14);
  });

  it.each(SCHEMA_NAMES)('accepts the valid %s fixture', async (name) => {
    const fixture = await loadFixture(name);
    const result = new SchemaRegistry().validate(name, fixture.valid);

    expect(fixture.schema).toBe(name);
    expect(result).toEqual({ valid: true, diagnostics: [] });
  });

  it('accepts every explicit VCS responsibility profile', async () => {
    const fixture = await loadFixture('vcs-policy');
    expect(Object.keys(fixture.profiles ?? {}).sort()).toEqual([
      'agent-managed',
      'custom',
      'human-commit',
      'human-owned',
      'none',
    ]);

    const registry = new SchemaRegistry();
    for (const [profile, value] of Object.entries(fixture.profiles ?? {})) {
      expect(registry.validate('vcs-policy', value), profile).toEqual({
        valid: true,
        diagnostics: [],
      });
    }
  });

  it('accepts every declared actor client', async () => {
    const fixture = await loadFixture('actor-profile');
    const registry = new SchemaRegistry();

    for (const client of ACTOR_CLIENTS) {
      const profile = structuredClone(fixture.valid) as Record<string, unknown>;
      profile.actor_id = `${client}-laptop-01ARZ3NDEK`;
      profile.actor_type = client === 'human' ? 'human' : 'agent';
      profile.client = client;
      if (client === 'human') profile.checkpoint_paths = [];
      expect(registry.validate('actor-profile', profile), client).toEqual({
        valid: true,
        diagnostics: [],
      });
    }
  });

  it.each(SCHEMA_NAMES)('rejects invalid %s fixtures with path diagnostics', async (name) => {
    const fixture = await loadFixture(name);
    expect(fixture.invalid.length).toBeGreaterThanOrEqual(2);

    const registry = new SchemaRegistry();
    for (const invalid of fixture.invalid) {
      const source =
        invalid.profile === undefined ? fixture.valid : fixture.profiles?.[invalid.profile];
      if (source === undefined) throw new Error(`Unknown fixture profile: ${invalid.profile}`);
      const result = registry.validate(name, applyInvalidFixture(source, invalid));
      expect(result.valid, invalid.name).toBe(false);
      expect(result.diagnostics.length, invalid.name).toBeGreaterThan(0);
      expect(
        result.diagnostics.every((item) => item.path.startsWith('/')),
        invalid.name,
      ).toBe(true);
    }
  });
});
