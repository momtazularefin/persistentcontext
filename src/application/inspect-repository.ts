import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse } from 'yaml';

import {
  classifyRepository,
  type ManagedManifestAssessment,
  type TextDocument,
} from '../domain/classification.js';
import {
  INSPECTION_SCHEMA_VERSION,
  InspectionError,
  type InspectionResult,
  type RepositoryInventory,
} from '../domain/inspection.js';
import {
  inventoryRepository,
  resolveCandidateRoot,
} from '../infrastructure/filesystem-inventory.js';

const maximumSemanticFileBytes = 1_048_576;

function isText(buffer: Buffer): boolean {
  const sampleLength = Math.min(buffer.length, 8_192);
  for (let index = 0; index < sampleLength; index += 1) {
    if (buffer[index] === 0) return false;
  }
  return true;
}

function meritsSemanticReview(candidatePath: string, contents: string): boolean {
  if (candidatePath === '.pcp/pcp.yaml') return true;
  if (
    /(?:^|\/)(?:\.claude|\.cursor|\.github\/agents|agents?|ai|context|memory)(?:\/|$)/iu.test(
      candidatePath,
    )
  ) {
    return true;
  }
  return /\b(agent|assistant|continuity|handoff|checkpoint|workstream|journal|change ?log|working agreement|source of truth)\b/iu.test(
    contents,
  );
}

async function loadTextDocuments(
  root: string,
  inventory: RepositoryInventory,
): Promise<TextDocument[]> {
  const documents: TextDocument[] = [];

  for (const file of inventory.files) {
    if (file.size > maximumSemanticFileBytes) continue;
    const buffer = await readFile(path.join(root, ...file.path.split('/')));
    const observedDigest = createHash('sha256').update(buffer).digest('hex');
    if (observedDigest !== file.sha256) {
      throw new InspectionError(
        'PCP_SOURCE_CHANGED',
        `Candidate content changed after inventory: ${file.path}`,
      );
    }
    if (!isText(buffer)) continue;
    const contents = buffer.toString('utf8');
    if (meritsSemanticReview(file.path, contents)) {
      documents.push({ path: file.path, contents });
    }
  }

  return documents;
}

function manifestAssessment(
  inventory: RepositoryInventory,
  documents: readonly TextDocument[],
): ManagedManifestAssessment {
  const manifest = documents.find((document) => document.path === '.pcp/pcp.yaml');
  if (manifest === undefined) {
    const manifestEntryExists =
      inventory.files.some((file) => file.path === '.pcp/pcp.yaml') ||
      inventory.symlinks.some((link) => link.path === '.pcp/pcp.yaml');
    if (manifestEntryExists) {
      return {
        status: 'invalid',
        reason: 'The PCP manifest must be a regular UTF-8 text file no larger than 1 MiB.',
      };
    }
    return { status: 'absent', reason: 'No .pcp/pcp.yaml manifest was found.' };
  }

  try {
    const parsed: unknown = parse(manifest.contents);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { status: 'invalid', reason: 'The PCP manifest must be a YAML mapping.' };
    }

    const protocol = (parsed as Record<string, unknown>).protocol;
    if (typeof protocol !== 'object' || protocol === null || Array.isArray(protocol)) {
      return { status: 'invalid', reason: 'The PCP manifest must define a protocol mapping.' };
    }

    const identity = protocol as Record<string, unknown>;
    if (
      identity.name !== 'persistent-context-protocol' ||
      typeof identity.version !== 'string' ||
      !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(identity.version)
    ) {
      return {
        status: 'invalid',
        reason:
          'The PCP manifest protocol must identify persistent-context-protocol and a semantic version.',
      };
    }

    return {
      status: 'valid',
      reason: `Found managed PCP protocol version ${identity.version}.`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { status: 'invalid', reason: `The PCP manifest is not valid YAML: ${detail}` };
  }
}

export async function inspectRepository(candidate = '.'): Promise<InspectionResult> {
  const root = await resolveCandidateRoot(candidate);
  const inventory = await inventoryRepository(root);
  const documents = await loadTextDocuments(root, inventory);
  const classification = classifyRepository({
    inventory,
    documents,
    managedManifest: manifestAssessment(inventory, documents),
  });

  return {
    schemaVersion: INSPECTION_SCHEMA_VERSION,
    candidate: '.',
    state: classification.state,
    confidence: classification.confidence,
    signals: classification.signals,
    foreignCandidates: classification.foreignCandidates,
    ambiguities: classification.ambiguities,
    inventory,
    mutated: false,
  };
}
