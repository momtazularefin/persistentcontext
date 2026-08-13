export const PCP_NAME = 'Persistent Context Protocol';
export const PCP_VERSION = '0.2.0';
export const PCP_RELEASE_STAGE = 'mandatory-global-sync';

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
  'repair',
] as const;

export type PcpCommandName = (typeof PCP_COMMANDS)[number];
