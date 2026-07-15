import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { registerActor } from '../../src/application/register-actor.js';
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

  it('fails closed for a lifecycle operation that remains unavailable', async () => {
    const errorOutput = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;

    try {
      await createProgram().parseAsync(['node', 'pcp', 'record', '--input', 'event.yaml']);
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

  it('registers an actor with structured JSON output', async () => {
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;
    const root = await mkdtemp(path.join(tmpdir(), 'pcp-program-registration-'));
    const template = fileURLToPath(new URL('../../templates/core/.pcp/', import.meta.url));
    await cp(template, path.join(root, '.pcp'), { recursive: true });

    try {
      await createProgram().parseAsync([
        'node',
        'pcp',
        'register',
        root,
        '--client',
        'codex',
        '--machine-label',
        'cli-machine',
        '--json',
      ]);
      const serialized = String(output.mock.calls.at(-1)?.[0]);
      expect(JSON.parse(serialized)).toMatchObject({
        command: 'register',
        status: 'created',
        client: 'codex',
        machine_label: 'cli-machine',
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

  it('previews and acknowledges scoped status with structured JSON', async () => {
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;
    const root = await mkdtemp(path.join(tmpdir(), 'pcp-program-status-'));
    const template = fileURLToPath(new URL('../../templates/core/.pcp/', import.meta.url));
    await cp(template, path.join(root, '.pcp'), { recursive: true });
    const actor = await registerActor(root, { client: 'codex', machine_label: 'cli-machine' });

    try {
      await createProgram().parseAsync([
        'node',
        'pcp',
        'status',
        root,
        '--actor-id',
        actor.actor_id,
        '--scope',
        'implementation',
        '--json',
      ]);
      const preview = JSON.parse(String(output.mock.calls.at(-1)?.[0])) as Record<string, unknown>;
      expect(preview).toMatchObject({
        command: 'status',
        mode: 'preview',
        mutated: false,
        event_created: false,
      });
      expect(preview.status_digest).toMatch(/^[a-f0-9]{64}$/u);

      await createProgram().parseAsync([
        'node',
        'pcp',
        'status',
        root,
        '--actor-id',
        actor.actor_id,
        '--scope',
        'implementation',
        '--acknowledge',
        String(preview.status_digest),
        '--json',
      ]);
      expect(JSON.parse(String(output.mock.calls.at(-1)?.[0]))).toMatchObject({
        command: 'status',
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
