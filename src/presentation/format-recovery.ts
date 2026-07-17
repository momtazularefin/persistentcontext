export interface RecoveryDetails {
  recovery_retained: boolean;
  recovery_path: string | null;
  recovery_paths?: string[];
}

export function formatRecoveryDetails(paths: readonly string[]): RecoveryDetails {
  const uniquePaths = [...new Set(paths)];
  return {
    recovery_retained: uniquePaths.length > 0,
    recovery_path: uniquePaths[0] ?? null,
    ...(uniquePaths.length > 1 ? { recovery_paths: uniquePaths } : {}),
  };
}
