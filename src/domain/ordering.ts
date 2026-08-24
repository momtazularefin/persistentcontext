/**
 * Deterministic ordering for identifiers, slugs, and repository-relative paths.
 *
 * `String.prototype.localeCompare` resolves through ICU collation, so its result
 * depends on the host locale and ICU build. That is correct for presenting words
 * to a reader and wrong for every ordering PCP relies on, because PCP orders
 * ULIDs to decide which events are newer, orders paths to build reproducible
 * content digests, and compares those results across machines. Czech collation
 * alone reorders `CHANGELOG.md` against `CONTRIBUTING.md`, which is enough to
 * give one unchanged tree two different identity digests.
 *
 * Comparing UTF-16 code units is total, stable, and identical everywhere.
 */
export function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** Compares two values by a derived string key using {@link compareCodeUnits}. */
export function byCodeUnits<T>(key: (value: T) => string): (left: T, right: T) => number {
  return (left, right) => compareCodeUnits(key(left), key(right));
}
