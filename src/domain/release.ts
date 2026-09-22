export const PCP_NAME = 'Persistent Context Protocol';
export const PCP_VERSION = '0.3.2';
export const PCP_RELEASE_STAGE = 'deterministic-identity';
export const PCP_UPDATE_PROVIDER = 'github';
export const PCP_UPDATE_REPOSITORY = 'momtazularefin/persistentcontext';
export const PCP_UPDATE_CHANNEL = 'main';
export const PCP_UPDATE_MANIFEST_PATH = 'templates/core/.pcp/pcp.yaml';

/**
 * Update discovery resolves the mainline channel to its latest *published
 * release*, not to the current tip of `main`.
 *
 * A branch tip is not a version. `main` carries development between releases, so
 * reading its manifest advertises whatever happens to be in progress and tells
 * every installation that an update is available for work nobody has released.
 * Resolving the newest published release and then pinning that release's tag to
 * an immutable commit keeps "available" meaning "released", and still gives the
 * upgrade path an exact revision to verify against.
 */
export const PCP_RELEASE_API_URL = `https://api.github.com/repos/${PCP_UPDATE_REPOSITORY}/releases/latest`;
export const pcpCommitApiUrl = (ref: string): string =>
  `https://api.github.com/repos/${PCP_UPDATE_REPOSITORY}/commits/${ref}`;

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
