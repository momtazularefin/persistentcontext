import { compareCodeUnits } from './ordering.js';
import { normalizePathReference } from './path-references.js';

// These are descriptive references. Operational targets use separate relative
// path schemas and never pass through this normalizer.
const REFERENCE_ARRAYS = new Set(['affected_paths', 'related_paths', 'evidence_paths', 'paths']);

export function normalizeInputPathReferences(value: unknown, projectRoot: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => normalizeInputPathReferences(item, projectRoot));
  }
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]: [string, unknown]) => {
      if (REFERENCE_ARRAYS.has(key) && Array.isArray(item)) {
        const references = item.map((reference: unknown) =>
          typeof reference === 'string'
            ? normalizePathReference(projectRoot, reference)
            : reference,
        );
        if (references.every((reference): reference is string => typeof reference === 'string')) {
          return [key, [...new Set(references)].sort(compareCodeUnits)];
        }
        return [key, references];
      }
      return [key, normalizeInputPathReferences(item, projectRoot)];
    }),
  );
}
