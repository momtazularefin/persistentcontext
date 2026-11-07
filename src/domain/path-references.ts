import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface AbsolutePathReference {
  path: string;
  windows: boolean;
}

function assertPathText(value: string): void {
  if (value.trim().length === 0 || /\p{Cc}/u.test(value)) {
    throw new Error('A path reference must be nonempty and contain no control characters.');
  }
}

export function isFileReference(value: string): boolean {
  return /^file:/iu.test(value);
}

function absolutePath(value: string): AbsolutePathReference | undefined {
  const slashes = value.replaceAll('\\', '/');
  if (/^(?:\/\/[?.]\/|\/\?\?\/)/u.test(slashes)) {
    throw new Error('Windows device paths are not supported path references.');
  }
  if (/^[A-Za-z]:[\\/]/u.test(value)) {
    return { path: path.win32.normalize(value), windows: true };
  }
  if (/^[A-Za-z]:/u.test(value)) {
    throw new Error('A Windows drive path must be absolute.');
  }
  if (value.startsWith('//') || value.startsWith('\\\\')) {
    const normalized = path.win32.normalize(value);
    if (!/^\\\\[^\\]+\\[^\\]+(?:\\|$)/u.test(normalized)) {
      throw new Error('A UNC path must include a server and share.');
    }
    return { path: normalized, windows: true };
  }
  if (value.startsWith('/')) return { path: path.posix.normalize(value), windows: false };
  if (value.startsWith('\\')) {
    throw new Error('A root-relative Windows path has no explicit drive.');
  }
  return undefined;
}

/** Decode an explicit absolute reference without consulting the current host. */
export function parseFileReference(value: string): AbsolutePathReference {
  assertPathText(value);
  if (!/^file:\/\//iu.test(value) || value !== value.trim() || /[\\\s]/u.test(value)) {
    throw new Error('An absolute file reference must use an encoded file:// URI.');
  }
  if (/%2f/iu.test(value)) {
    throw new Error('A file reference cannot contain encoded path separators.');
  }
  if (/[?#]/u.test(value) || /^file:\/\/[A-Za-z]:/iu.test(value)) {
    throw new Error('A file reference must use an unambiguous absolute URL path.');
  }
  const url = new URL(value);
  if (url.username || url.password || url.port || url.search || url.hash) {
    throw new Error('A file reference cannot contain credentials, a port, query, or fragment.');
  }
  const windows = url.hostname.length > 0 || /^\/[A-Za-z]:/u.test(url.pathname);
  if (windows && /%5c/iu.test(value)) {
    throw new Error('A Windows file reference cannot contain encoded path separators.');
  }
  const decoded = fileURLToPath(url, { windows });
  assertPathText(decoded);
  const result = absolutePath(decoded);
  if (result === undefined || result.windows !== windows) {
    throw new Error('A file reference must identify an unambiguous absolute path.');
  }
  return result;
}

/**
 * Internal paths remain relative. Explicit external paths become file URIs.
 * This lexical operation grants no access and never follows filesystem links.
 */
export function normalizePathReference(projectRoot: string, value: string): string {
  assertPathText(projectRoot);
  assertPathText(value);
  const root = isFileReference(projectRoot)
    ? parseFileReference(projectRoot)
    : absolutePath(projectRoot);
  if (root === undefined) throw new Error('The project root must be an absolute path.');

  let target = isFileReference(value) ? parseFileReference(value) : absolutePath(value);
  if (target === undefined) {
    if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value.trim())) {
      throw new Error('Only file:// URIs can identify absolute filesystem references.');
    }
    const relative = path.posix.normalize(value.trim().replaceAll('\\', '/'));
    if (path.posix.isAbsolute(relative)) {
      throw new Error('A relative reference cannot become absolute during normalization.');
    }
    if (relative === '..' || relative.startsWith('../')) {
      throw new Error('An external reference requires an explicit absolute path.');
    }
    const flavor = root.windows ? path.win32 : path.posix;
    target = { path: flavor.resolve(root.path, relative), windows: root.windows };
  }

  if (target.windows === root.windows) {
    const flavor = root.windows ? path.win32 : path.posix;
    const relative = flavor.relative(root.path, target.path);
    if (relative === '') return '.';
    if (
      relative !== '..' &&
      !relative.startsWith(`..${flavor.sep}`) &&
      !flavor.isAbsolute(relative)
    ) {
      return root.windows ? relative.replaceAll('\\', '/') : relative;
    }
  }
  // Node's Windows drive-root serialization adds an extra slash on some POSIX
  // hosts even with windows:true. Spell this root explicitly across hosts.
  const uri =
    target.windows && /^[A-Za-z]:\\$/u.test(target.path)
      ? `file:///${target.path[0]}:/`
      : pathToFileURL(target.path, { windows: target.windows }).href;
  if (target.windows && !parseFileReference(uri).windows) {
    throw new Error(
      'A localhost UNC reference requires an explicit machine hostname or drive path.',
    );
  }
  // Preserve a POSIX first component such as /C:/ instead of allowing the URI
  // decoder to reinterpret it as a Windows drive on the next read.
  return target.windows ? uri : uri.replace(/^file:\/\/\/([A-Za-z]):/u, 'file:///$1%3A');
}
