import { describe, expect, it, vi } from 'vitest';

import { createProgram, runCli } from '../../src/cli/main.js';
import { PCP_COMMANDS } from '../../src/domain/release.js';

describe('pcp command surface', () => {
  it('exposes every planned lifecycle command', () => {
    const names = createProgram().commands.map((command) => command.name());
    expect(names).toEqual(PCP_COMMANDS);
  });

  it('shows help without changing the process exit code', async () => {
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;

    try {
      await runCli(['node', 'pcp']);
      expect(process.exitCode).toBeUndefined();
      expect(output).toHaveBeenCalled();
    } finally {
      process.exitCode = previousExitCode;
      output.mockRestore();
    }
  });

  it('fails closed for an unimplemented lifecycle operation', async () => {
    const errorOutput = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;

    try {
      await createProgram().parseAsync(['node', 'pcp', 'inspect']);
      expect(process.exitCode).toBe(2);
      expect(errorOutput).toHaveBeenCalledWith(
        expect.stringContaining('"code":"PCP_OPERATION_UNAVAILABLE"'),
      );
      expect(errorOutput).toHaveBeenCalledWith(expect.stringContaining('"mutated":false'));
    } finally {
      process.exitCode = previousExitCode;
      errorOutput.mockRestore();
    }
  });
});
