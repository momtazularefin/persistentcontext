export const PCP_NAME = 'Persistent Context Protocol';
export const PCP_VERSION = '0.2.0';
export const PCP_RELEASE_STAGE = 'mandatory-global-sync';
export const PCP_UPDATE_PROVIDER = 'github';
export const PCP_UPDATE_REPOSITORY = 'momtazularefin/persistentcontext';
export const PCP_UPDATE_CHANNEL = 'main';
export const PCP_UPDATE_MANIFEST_PATH = 'templates/core/.pcp/pcp.yaml';
export const PCP_UPDATE_API_URL = `https://api.github.com/repos/${PCP_UPDATE_REPOSITORY}/commits/${PCP_UPDATE_CHANNEL}`;

export const PCP_COMMANDS = [
  'inspect',
  'adopt',
  'register',
  'sync',
  'record',
  'validate',
  'render',
  'workstream',
  'upgrade',
  'purge-history',
  'repair',
] as const;

export type PcpCommandName = (typeof PCP_COMMANDS)[number];
