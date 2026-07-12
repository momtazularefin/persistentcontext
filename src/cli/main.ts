import { pathToFileURL } from 'node:url';

import { Command } from 'commander';

import { inspectRepository } from '../application/inspect-repository.js';
import { renderCanonicalViews } from '../application/render-canonical-views.js';
import { validateCanonicalLayer } from '../application/validate-canonical-layer.js';
import {
  PCP_COMMANDS,
  PCP_NAME,
  PCP_RELEASE_STAGE,
  PCP_VERSION,
  type PcpCommandName,
} from '../domain/release.js';
import { InspectionError } from '../domain/inspection.js';
import {
  formatCanonicalRender,
  formatCanonicalValidation,
} from '../presentation/format-canonical.js';
import { formatInspection } from '../presentation/format-inspection.js';

const commandDescriptions: Record<PcpCommandName, string> = {
  inspect: 'Inspect and classify a candidate project without mutation',
  adopt: 'Preview or apply adoption into the canonical .pcp layer',
  register: 'Create or recover a stable project agent identity',
  status: 'Report project state and scoped reconciliation changes',
  record: 'Append one meaningful immutable journal event',
  validate: 'Validate an installed PCP layer and its projections',
  render: 'Render generated canonical views',
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

interface ValidateOptions {
  cleanGenesis?: boolean;
  json?: boolean;
}

interface RenderOptions {
  check?: boolean;
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

function addValidateCommand(program: Command): Command {
  return program
    .command('validate')
    .description(commandDescriptions.validate)
    .argument('[directory]', 'managed project root', '.')
    .option('--clean-genesis', 'require zero agent profiles and zero journal events')
    .option('--json', 'emit stable structured JSON')
    .action(async (directory: string, options: ValidateOptions) => {
      try {
        const report = await validateCanonicalLayer(directory, {
          clean_genesis: options.cleanGenesis === true,
        });
        const output = { ...report, command: 'validate', mutated: false };
        process.stdout.write(
          options.json === true
            ? `${JSON.stringify(output, null, 2)}\n`
            : formatCanonicalValidation(report),
        );
        if (!report.valid) process.exitCode = 1;
      } catch (error) {
        reportOperationError('PCP_VALIDATION_FAILED', error, false);
      }
    });
}

function addRenderCommand(program: Command): Command {
  return program
    .command('render')
    .description(commandDescriptions.render)
    .argument('[directory]', 'managed project root', '.')
    .option('--check', 'check generated output without writing')
    .option('--json', 'emit stable structured JSON')
    .action(async (directory: string, options: RenderOptions) => {
      try {
        const report = await renderCanonicalViews(directory, { check: options.check === true });
        const mutated = report.mode === 'write' && report.changed_paths.length > 0;
        const output = { ...report, command: 'render', mutated };
        process.stdout.write(
          options.json === true
            ? `${JSON.stringify(output, null, 2)}\n`
            : formatCanonicalRender(report),
        );
        if (!report.valid) process.exitCode = 1;
      } catch (error) {
        reportOperationError('PCP_RENDER_FAILED', error, options.check !== true);
      }
    });
}

function reportOperationError(code: string, error: unknown, mutationPossible: boolean): void {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${JSON.stringify({ code, message, mutated: false, mutationPossible })}\n`);
  process.exitCode = 2;
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
    } else if (commandName === 'validate') {
      addValidateCommand(program);
    } else if (commandName === 'render') {
      addRenderCommand(program);
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
