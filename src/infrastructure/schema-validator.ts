import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsModule, { type FormatsPlugin } from 'ajv-formats';

import {
  SCHEMA_CATALOG,
  SCHEMA_NAMES,
  SUPPORTING_SCHEMAS,
  type SchemaName,
} from '../domain/schema-catalog.js';

export interface SchemaDiagnostic {
  path: string;
  keyword: string;
  message: string;
  params: Record<string, unknown>;
}

export interface SchemaValidationResult {
  valid: boolean;
  diagnostics: SchemaDiagnostic[];
}

function schemaId(schema: object): string {
  const id = (schema as { $id?: unknown }).$id;
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('Every PCP schema must define a non-empty $id.');
  }
  return id;
}

function compareDiagnostics(left: SchemaDiagnostic, right: SchemaDiagnostic): number {
  const leftKey = `${left.path}\u0000${left.keyword}\u0000${left.message}`;
  const rightKey = `${right.path}\u0000${right.keyword}\u0000${right.message}`;
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

function diagnostic(error: ErrorObject): SchemaDiagnostic {
  return {
    path: error.instancePath === '' ? '/' : error.instancePath,
    keyword: error.keyword,
    message: error.message ?? 'Schema validation failed.',
    params: error.params as Record<string, unknown>,
  };
}

export class SchemaRegistry {
  readonly #validators = new Map<SchemaName, ValidateFunction>();

  public constructor() {
    const ajv = new Ajv2020({
      allErrors: true,
      strict: true,
      validateFormats: true,
      coerceTypes: false,
      removeAdditional: false,
      useDefaults: false,
    });
    const addFormats = addFormatsModule as unknown as FormatsPlugin;
    addFormats(ajv);

    for (const schema of SUPPORTING_SCHEMAS) {
      ajv.addSchema(schema, schemaId(schema));
    }
    for (const name of SCHEMA_NAMES) {
      const schema = SCHEMA_CATALOG[name];
      ajv.addSchema(schema, schemaId(schema));
    }
    for (const name of SCHEMA_NAMES) {
      const validator = ajv.getSchema(schemaId(SCHEMA_CATALOG[name]));
      if (validator === undefined) {
        throw new Error(`PCP schema did not compile: ${name}`);
      }
      this.#validators.set(name, validator);
    }
  }

  public validate(name: SchemaName, value: unknown): SchemaValidationResult {
    const validator = this.#validators.get(name);
    if (validator === undefined) {
      throw new Error(`Unknown PCP schema: ${name}`);
    }

    const valid = validator(value);
    const diagnostics = (validator.errors ?? []).map(diagnostic).sort(compareDiagnostics);
    return { valid, diagnostics };
  }
}

let defaultRegistry: SchemaRegistry | undefined;

export function validateSchema(name: SchemaName, value: unknown): SchemaValidationResult {
  defaultRegistry ??= new SchemaRegistry();
  return defaultRegistry.validate(name, value);
}
