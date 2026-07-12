export const PCP_NAME = 'Persistent Context Protocol';
export const PCP_VERSION = '0.1.0';
export const PCP_RELEASE_STAGE = 'canonical-layer';

export const PCP_COMMANDS = [
  'inspect',
  'adopt',
  'register',
  'status',
  'record',
  'validate',
  'render',
  'workstream',
  'upgrade',
  'repair',
] as const;

export type PcpCommandName = (typeof PCP_COMMANDS)[number];
