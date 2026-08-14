import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { registerActor } from '../../src/application/register-actor.js';
import { createProgram, runCli } from '../../src/cli/main.js';
import { normalizeMachineLabel } from '../../src/domain/registration.js';
import { PCP_COMMANDS } from '../../src/domain/release.js';

describe('pcp command surface', () => {
  it('exposes every planned lifecycle command', () => {
    const program = createProgram();
    const names = program.commands.map((command) => command.name());
    expect(names).toEqual(PCP_COMMANDS);
    const register = program.commands.find((command) => command.name() === 'register');
    expect(register?.options.map((option) => option.long)).not.toContain('--machine-label');
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

  it('fails closed when upgrade is requested outside a managed PCP project', async () => {
    const errorOutput = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;

    try {
      await createProgram().parseAsync(['node', 'pcp', 'upgrade']);
      expect(process.exitCode).toBe(2);
      expect(errorOutput).toHaveBeenCalledWith(
        expect.stringContaining('"code":"PCP_UPGRADE_NOT_MANAGED"'),
      );
      expect(errorOutput).toHaveBeenCalledWith(expect.stringContaining('"mutated":false'));
      expect(errorOutput).toHaveBeenCalledWith(expect.stringContaining('"recovery_path":null'));
    } finally {
      process.exitCode = previousExitCode;
      errorOutput.mockRestore();
    }
  });

  it('keeps remote update checking separate from upgrade apply', async () => {
    const errorOutput = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;

    try {
      await createProgram().parseAsync([
        'node',
        'pcp',
        'upgrade',
        '--check',
        '--apply',
        'a'.repeat(64),
      ]);
      expect(process.exitCode).toBe(2);
      expect(errorOutput).toHaveBeenCalledWith(
        expect.stringContaining('"code":"PCP_UPGRADE_CHECK_OPTION_CONFLICT"'),
      );
      expect(errorOutput).toHaveBeenCalledWith(expect.stringContaining('"mutated":false'));
    } finally {
      process.exitCode = previousExitCode;
      errorOutput.mockRestore();
    }
  });

  it('previews an already empty history repository without mutation', async () => {
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;
    const root = await mkdtemp(path.join(tmpdir(), 'pcp-program-purge-'));
    const template = fileURLToPath(new URL('../../templates/core/.pcp/', import.meta.url));
    await cp(template, path.join(root, '.pcp'), { recursive: true });
    await mkdir(path.join(root, 'docs'));

    try {
      await createProgram().parseAsync(['node', 'pcp', 'purge-history', root, '--json']);
      expect(JSON.parse(String(output.mock.calls.at(-1)?.[0]))).toMatchObject({
        command: 'purge-history',
        applicable: false,
        event_created: false,
        mutated: false,
      });
      expect(process.exitCode).toBeUndefined();
    } finally {
      process.exitCode = previousExitCode;
      output.mockRestore();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('registers an actor with structured JSON output', async () => {
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;
    const root = await mkdtemp(path.join(tmpdir(), 'pcp-program-registration-'));
    const template = fileURLToPath(new URL('../../templates/core/.pcp/', import.meta.url));
    await cp(template, path.join(root, '.pcp'), { recursive: true });
    await mkdir(path.join(root, 'docs'));

    try {
      await createProgram().parseAsync([
        'node',
        'pcp',
        'register',
        root,
        '--client',
        'codex',
        '--json',
      ]);
      const serialized = String(output.mock.calls.at(-1)?.[0]);
      expect(JSON.parse(serialized)).toMatchObject({
        command: 'register',
        status: 'created',
        client: 'codex',
        machine_label: normalizeMachineLabel(hostname()),
        event_created: false,
        mutated: true,
      });
      expect(process.exitCode).toBeUndefined();
    } finally {
      process.exitCode = previousExitCode;
      output.mockRestore();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('previews and acknowledges per-execution sync with structured JSON', async () => {
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;
    const root = await mkdtemp(path.join(tmpdir(), 'pcp-program-status-'));
    const template = fileURLToPath(new URL('../../templates/core/.pcp/', import.meta.url));
    await cp(template, path.join(root, '.pcp'), { recursive: true });
    await mkdir(path.join(root, 'docs'));
    const actor = await registerActor(root, { client: 'codex', machine_label: 'cli-machine' });

    try {
      await createProgram().parseAsync([
        'node',
        'pcp',
        'sync',
        root,
        '--actor-id',
        actor.actor_id,
        '--execution-id',
        actor.execution_id,
        '--json',
      ]);
      const preview = JSON.parse(String(output.mock.calls.at(-1)?.[0])) as Record<string, unknown>;
      expect(preview).toMatchObject({
        command: 'sync',
        mode: 'preview',
        mutated: false,
        event_created: false,
      });
      expect(preview.sync_digest).toMatch(/^[a-f0-9]{64}$/u);

      await createProgram().parseAsync([
        'node',
        'pcp',
        'sync',
        root,
        '--actor-id',
        actor.actor_id,
        '--execution-id',
        actor.execution_id,
        '--acknowledge',
        String(preview.sync_digest),
        '--json',
      ]);
      expect(JSON.parse(String(output.mock.calls.at(-1)?.[0]))).toMatchObject({
        command: 'sync',
        mode: 'acknowledge',
        checkpoint: { state: 'current', previous_state: 'missing' },
        acknowledgement: { accepted: true },
        mutated: true,
        event_created: false,
      });
      expect(process.exitCode).toBeUndefined();
    } finally {
      process.exitCode = previousExitCode;
      output.mockRestore();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('runs read-only adoption intake with structured questions', async () => {
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;
    const fixture = fileURLToPath(new URL('../fixtures/inspection/title-only/', import.meta.url));

    try {
      await createProgram().parseAsync(['node', 'pcp', 'adopt', '--candidate', fixture, '--json']);
      const serialized = String(output.mock.calls.at(-1)?.[0]);
      expect(JSON.parse(serialized)).toMatchObject({
        command: 'adopt',
        classification: 'A',
        applicable: false,
        mutated: false,
      });
      expect(process.exitCode).toBeUndefined();
    } finally {
      process.exitCode = previousExitCode;
      output.mockRestore();
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
    const fixture = await mkdtemp(path.join(tmpdir(), 'pcp-program-validation-'));
    const template = fileURLToPath(new URL('../../templates/core/.pcp/', import.meta.url));
    await cp(template, path.join(fixture, '.pcp'), { recursive: true });
    await mkdir(path.join(fixture, 'docs'));

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
      await rm(fixture, { recursive: true, force: true });
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
