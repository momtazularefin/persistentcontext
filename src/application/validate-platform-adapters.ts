import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parseDocument } from 'yaml';

import { canonicalJson, sha256 } from '../domain/adoption.js';
import { SUPPORTED_ADAPTER_IDS, type AdapterManifest } from '../domain/adapters.js';
import { comparePortablePaths } from '../domain/inspection.js';
import { SchemaRegistry } from '../infrastructure/schema-validator.js';

export interface AdapterDiagnostic {
  code: string;
  path: string;
  message: string;
}

export interface AdapterValidationReport {
  valid: boolean;
  checked_adapters: number;
  diagnostics: AdapterDiagnostic[];
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function absoluteTarget(root: string, portablePath: string): string | undefined {
  const normalized = path.posix.normalize(portablePath);
  if (
    portablePath === '.' ||
    normalized !== portablePath ||
    portablePath.startsWith('/') ||
    portablePath.includes('\\')
  ) {
    return undefined;
  }
  const target = path.resolve(root, ...portablePath.split('/'));
  return isInside(root, target) && target !== path.resolve(root) ? target : undefined;
}

function compareDiagnostics(left: AdapterDiagnostic, right: AdapterDiagnostic): number {
  return comparePortablePaths(left.path, right.path) || comparePortablePaths(left.code, right.code);
}

async function validateRegularFile(
  root: string,
  portablePath: string,
  code: string,
  diagnostics: AdapterDiagnostic[],
): Promise<Buffer | undefined> {
  const target = absoluteTarget(root, portablePath);
  if (target === undefined) {
    diagnostics.push({ code: `${code}.path`, path: portablePath, message: 'Path escapes root.' });
    return undefined;
  }
  try {
    const metadata = await lstat(target);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      diagnostics.push({
        code: `${code}.type`,
        path: portablePath,
        message: 'Expected a regular file with no symbolic-link boundary.',
      });
      return undefined;
    }
    return await readFile(target);
  } catch (error) {
    diagnostics.push({
      code: `${code}.read`,
      path: portablePath,
      message: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

export async function validatePlatformAdapters(
  root: string,
  adapters: readonly AdapterManifest[],
): Promise<AdapterValidationReport> {
  const diagnostics: AdapterDiagnostic[] = [];
  const registry = new SchemaRegistry();
  const ids = new Set<string>();
  const targets = new Set<string>();

  if (
    canonicalJson(adapters.map((adapter) => adapter.adapter_id)) !==
    canonicalJson(SUPPORTED_ADAPTER_IDS)
  ) {
    diagnostics.push({
      code: 'adapter.set',
      path: '.pcp/pcp.yaml',
      message: 'Adapter manifests do not match the complete ordered platform contract.',
    });
  }

  for (const adapter of adapters) {
    const schema = registry.validate('adapter', adapter);
    diagnostics.push(
      ...schema.diagnostics.map((item) => ({
        code: `adapter.schema.${item.keyword}`,
        path: `${adapter.adapter_id}${item.path}`,
        message: item.message,
      })),
    );
    if (ids.has(adapter.adapter_id)) {
      diagnostics.push({
        code: 'adapter.id-duplicate',
        path: adapter.adapter_id,
        message: 'Adapter ID appears more than once.',
      });
    }
    if (targets.has(adapter.target_path)) {
      diagnostics.push({
        code: 'adapter.target-duplicate',
        path: adapter.target_path,
        message: 'Adapter target appears more than once.',
      });
    }
    ids.add(adapter.adapter_id);
    targets.add(adapter.target_path);

    const bytes = await validateRegularFile(
      root,
      adapter.target_path,
      'adapter.target',
      diagnostics,
    );
    if (bytes !== undefined && sha256(bytes) !== adapter.content_digest) {
      diagnostics.push({
        code: 'adapter.digest',
        path: adapter.target_path,
        message: 'Adapter content does not match its generated digest.',
      });
    }
    for (const source of adapter.source_paths) {
      await validateRegularFile(root, source, 'adapter.source', diagnostics);
    }
  }

  const manifestBytes = await validateRegularFile(
    root,
    '.pcp/pcp.yaml',
    'adapter.manifest',
    diagnostics,
  );
  if (manifestBytes !== undefined) {
    const document = parseDocument(manifestBytes.toString('utf8'), {
      prettyErrors: false,
      strict: true,
      uniqueKeys: true,
    });
    if (document.errors.length > 0) {
      diagnostics.push({
        code: 'adapter.manifest.parse',
        path: '.pcp/pcp.yaml',
        message: document.errors.map((error) => error.message).join('; '),
      });
    } else {
      let value: unknown;
      try {
        value = document.toJS({ mapAsMap: false, maxAliasCount: 50 });
      } catch (error) {
        diagnostics.push({
          code: 'adapter.manifest.decode',
          path: '.pcp/pcp.yaml',
          message: error instanceof Error ? error.message : String(error),
        });
      }
      if (value !== undefined) {
        const adapterIds =
          typeof value === 'object' && value !== null && !Array.isArray(value)
            ? (value as Record<string, unknown>).adapter_ids
            : undefined;
        const expected = adapters.map((adapter) => adapter.adapter_id);
        if (canonicalJson(adapterIds) !== canonicalJson(expected)) {
          diagnostics.push({
            code: 'adapter.manifest.ids',
            path: '.pcp/pcp.yaml',
            message: 'Manifest adapter_ids do not match the generated adapter set.',
          });
        }
      }
    }
  }

  diagnostics.sort(compareDiagnostics);
  return {
    valid: diagnostics.length === 0,
    checked_adapters: adapters.length,
    diagnostics,
  };
}
