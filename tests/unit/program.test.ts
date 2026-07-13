import { describe, expect, it, vi } from 'vitest';
import { fileURLToPath } from 'node:url';

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
      await createProgram().parseAsync(['node', 'pcp', 'adopt']);
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

  it('runs read-only inspect with structured JSON output', async () => {
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;
    const fixture = fileURLToPath(new URL('../fixtures/inspection/conventional/', import.meta.url));

    try {
      await createProgram().parseAsync(['node', 'pcp', 'inspect', fixture, '--json']);
      const serialized = String(output.mock.calls.at(-1)?.[0]);
      expect(JSON.parse(serialized)).toMatchObject({ state: 'B', mutated: false });
      expect(process.exitCode).toBeUndefined();
    } finally {
      process.exitCode = previousExitCode;
      output.mockRestore();
    }
  });

  it('validates a clean canonical layer with structured JSON output', async () => {
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;
    const fixture = fileURLToPath(new URL('../../templates/core/', import.meta.url));

    try {
      await createProgram().parseAsync([
        'node',
        'pcp',
        'validate',
        fixture,
        '--clean-genesis',
        '--json',
      ]);
      const serialized = String(output.mock.calls.at(-1)?.[0]);
      expect(JSON.parse(serialized)).toMatchObject({
        command: 'validate',
        valid: true,
        mutated: false,
      });
      expect(process.exitCode).toBeUndefined();
    } finally {
      process.exitCode = previousExitCode;
      output.mockRestore();
    }
  });

  it('checks canonical rendering without mutation', async () => {
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;
    const fixture = fileURLToPath(new URL('../../templates/core/', import.meta.url));

    try {
      await createProgram().parseAsync(['node', 'pcp', 'render', fixture, '--check', '--json']);
      const serialized = String(output.mock.calls.at(-1)?.[0]);
      expect(JSON.parse(serialized)).toMatchObject({
        command: 'render',
        valid: true,
        mode: 'check',
        mutated: false,
      });
      expect(process.exitCode).toBeUndefined();
    } finally {
      process.exitCode = previousExitCode;
      output.mockRestore();
    }
  });
});
