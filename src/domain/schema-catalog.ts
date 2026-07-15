import adapterSchema from '../../schemas/v1/adapter.schema.json' with { type: 'json' };
import adoptionInputSchema from '../../schemas/v1/adoption-input.schema.json' with { type: 'json' };
import actorProfileSchema from '../../schemas/v1/actor-profile.schema.json' with { type: 'json' };
import checkpointSchema from '../../schemas/v1/checkpoint.schema.json' with { type: 'json' };
import commonSchema from '../../schemas/v1/common.schema.json' with { type: 'json' };
import coverageSchema from '../../schemas/v1/coverage.schema.json' with { type: 'json' };
import eventSchema from '../../schemas/v1/event.schema.json' with { type: 'json' };
import eventInputSchema from '../../schemas/v1/event-input.schema.json' with { type: 'json' };
import frontmatterSchema from '../../schemas/v1/frontmatter.schema.json' with { type: 'json' };
import mutationPlanSchema from '../../schemas/v1/mutation-plan.schema.json' with { type: 'json' };
import pcpManifestSchema from '../../schemas/v1/pcp-manifest.schema.json' with { type: 'json' };
import projectRegistrySchema from '../../schemas/v1/project-registry.schema.json' with { type: 'json' };
import projectSchema from '../../schemas/v1/project.schema.json' with { type: 'json' };
import vcsPolicySchema from '../../schemas/v1/vcs-policy.schema.json' with { type: 'json' };
import workstreamsSchema from '../../schemas/v1/workstreams.schema.json' with { type: 'json' };

export const SCHEMA_CATALOG = {
  adapter: adapterSchema,
  'adoption-input': adoptionInputSchema,
  'actor-profile': actorProfileSchema,
  checkpoint: checkpointSchema,
  coverage: coverageSchema,
  event: eventSchema,
  'event-input': eventInputSchema,
  frontmatter: frontmatterSchema,
  'mutation-plan': mutationPlanSchema,
  'pcp-manifest': pcpManifestSchema,
  'project-registry': projectRegistrySchema,
  project: projectSchema,
  'vcs-policy': vcsPolicySchema,
  workstreams: workstreamsSchema,
} as const;

export const SUPPORTING_SCHEMAS = [commonSchema] as const;

export type SchemaName = keyof typeof SCHEMA_CATALOG;

export const SCHEMA_NAMES = Object.keys(SCHEMA_CATALOG).sort() as SchemaName[];
