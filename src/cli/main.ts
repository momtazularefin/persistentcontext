import { pathToFileURL } from 'node:url';

import { Command } from 'commander';

import { inspectRepository } from '../application/inspect-repository.js';
import {
  PCP_COMMANDS,
  PCP_NAME,
  PCP_RELEASE_STAGE,
  PCP_VERSION,
  type PcpCommandName,
} from '../domain/release.js';
import { InspectionError } from '../domain/inspection.js';
import { formatInspection } from '../presentation/format-inspection.js';

const commandDescriptions: Record<PcpCommandName, string> = {
  inspect: 'Inspect and classify a candidate project without mutation',
  adopt: 'Preview or apply adoption into the canonical .pcp layer',
  register: 'Create or recover a stable project agent identity',
  status: 'Report project state and scoped reconciliation changes',
  record: 'Append one meaningful immutable journal event',
  validate: 'Validate an installed PCP layer and its projections',
  render: 'Render generated views and platform adapters',
  workstream: 'Create, update, validate, or complete a workstream',
  upgrade: 'Preview or apply an ownership-aware PCP upgrade',
  repair: 'Preview or apply a mechanically safe PCP repair',
};

function reportUnavailable(commandName: PcpCommandName): void {
  const message = {
    code: 'PCP_OPERATION_UNAVAILABLE',
    command: commandName,
    releaseStage: PCP_RELEASE_STAGE,
    message: `${commandName} has not reached a verified release milestone.`,
    mutated: false,
  };

  process.stderr.write(`${JSON.stringify(message)}\n`);
  process.exitCode = 2;
}

interface InspectOptions {
  candidate?: string;
  json?: boolean;
}

function reportInspectionError(error: unknown): void {
  const code = error instanceof InspectionError ? error.code : 'PCP_INSPECTION_FAILED';
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${JSON.stringify({ code, message, mutated: false })}\n`);
  process.exitCode = 2;
}

function addInspectCommand(program: Command): Command {
  return program
    .command('inspect')
    .description(commandDescriptions.inspect)
    .argument('[directory]', 'candidate project root')
    .option('--candidate <directory>', 'candidate project root')
    .option('--json', 'emit stable structured JSON')
    .action(async (directory: string | undefined, options: InspectOptions) => {
      try {
        const result = await inspectRepository(options.candidate ?? directory ?? '.');
        process.stdout.write(
          options.json === true ? `${JSON.stringify(result, null, 2)}\n` : formatInspection(result),
        );
      } catch (error) {
        reportInspectionError(error);
      }
    });
}

function addUnavailableCommand(program: Command, commandName: PcpCommandName): Command {
  const command = program.command(commandName).description(commandDescriptions[commandName]);

  switch (commandName) {
    case 'adopt':
      command
        .option('--candidate <directory>', 'candidate project root', '.')
        .option('--apply <digest>', 'apply only the matching preview digest');
      break;
    case 'record':
      command.requiredOption('--input <event.yaml>', 'event candidate to validate and record');
      break;
    case 'render':
      command.option('--check', 'check generated output without writing');
      break;
    case 'upgrade':
    case 'repair':
      command.option('--apply <digest>', 'apply only the matching preview digest');
      break;
    case 'workstream':
      command.argument('[operation]', 'create, update, validate, or complete');
      break;
    default:
      break;
  }

  command.action(() => {
    reportUnavailable(commandName);
  });

  return command;
}

export function createProgram(): Command {
  const program = new Command();
  program
    .name('pcp')
    .description(`${PCP_NAME} project-local engine`)
    .version(PCP_VERSION)
    .showHelpAfterError();

  for (const commandName of PCP_COMMANDS) {
    if (commandName === 'inspect') {
      addInspectCommand(program);
    } else {
      addUnavailableCommand(program, commandName);
    }
  }

  return program;
}

export async function runCli(argv: readonly string[] = process.argv): Promise<void> {
  const program = createProgram();
  if (argv.length <= 2) {
    program.outputHelp();
    return;
  }

  await program.parseAsync([...argv]);
}

const entryPath = process.argv[1];
if (entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href) {
  await runCli();
}
