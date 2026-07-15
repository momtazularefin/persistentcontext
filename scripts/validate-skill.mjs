import { access, readFile } from 'node:fs/promises';

import { parse } from 'yaml';

const skillRoot = new URL('../skills/build-pcp/', import.meta.url);
const skillPath = new URL('SKILL.md', skillRoot);
const skill = await readFile(skillPath, 'utf8');

if (skill.includes('TODO')) {
  throw new Error('SKILL.md still contains a TODO placeholder.');
}

const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skill);
if (frontmatter?.[1] === undefined) {
  throw new Error('SKILL.md has invalid YAML frontmatter.');
}

const metadata = parse(frontmatter[1]);
if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
  throw new Error('SKILL.md metadata must be a mapping.');
}

const keys = Object.keys(metadata).sort();
if (keys.join(',') !== 'description,name') {
  throw new Error(`SKILL.md frontmatter must contain only name and description; found ${keys}.`);
}

if (metadata.name !== 'build-pcp') {
  throw new Error('SKILL.md name must be build-pcp.');
}

if (skill.split(/\r?\n/u).length > 500) {
  throw new Error('SKILL.md must remain under 500 lines.');
}

const requiredReferences = [
  'adoption.md',
  'operation.md',
  'migration-and-repair.md',
  'capabilities.md',
];

for (const reference of requiredReferences) {
  if (!skill.includes(`references/${reference}`)) {
    throw new Error(`SKILL.md does not route to references/${reference}.`);
  }
  await access(new URL(`references/${reference}`, skillRoot));
}

const openAiMetadata = parse(await readFile(new URL('agents/openai.yaml', skillRoot), 'utf8'));
const defaultPrompt = openAiMetadata?.interface?.default_prompt;
if (typeof defaultPrompt !== 'string' || !defaultPrompt.includes('$build-pcp')) {
  throw new Error('agents/openai.yaml default_prompt must mention $build-pcp.');
}

const requiredAssets = [
  'pcp-assets.sha256',
  'schemas/v1/adoption-input.schema.json',
  'schemas/v1/event-input.schema.json',
  'schemas/v1/pcp-manifest.schema.json',
  'schemas/v1/workstream-operation-input.schema.json',
  'templates/core/.pcp/pcp.yaml',
  'templates/core/.pcp/views/10-status.generated.md',
];
for (const asset of requiredAssets) {
  await access(new URL(`assets/${asset}`, skillRoot));
}

if (!skill.includes('assets/pcp-assets.sha256')) {
  throw new Error('SKILL.md must explain bundled asset verification.');
}

process.stdout.write('build-pcp skill structure is valid.\n');
