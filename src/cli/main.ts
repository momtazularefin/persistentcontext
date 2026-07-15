import { pathToFileURL } from 'node:url';
import { hostname } from 'node:os';

import { Command } from 'commander';

import { adoptProject } from '../application/adopt-project.js';
import { inspectRepository } from '../application/inspect-repository.js';
import { mutateWorkstream, validateWorkstreamRegistry } from '../application/manage-workstreams.js';
import { recordEvent } from '../application/record-event.js';
import { registerActor } from '../application/register-actor.js';
import { repairProject } from '../application/repair-project.js';
import { reportStatus } from '../application/report-status.js';
import { renderCanonicalViews } from '../application/render-canonical-views.js';
import { validateCanonicalLayer } from '../application/validate-canonical-layer.js';
import {
  PCP_COMMANDS,
  PCP_NAME,
  PCP_RELEASE_STAGE,
  PCP_VERSION,
  type PcpCommandName,
} from '../domain/release.js';
import { AdoptionError } from '../domain/adoption.js';
import { InspectionError } from '../domain/inspection.js';
import { RecordingError } from '../domain/recording.js';
import { normalizeMachineLabel, RegistrationError } from '../domain/registration.js';
import { ReconciliationError } from '../domain/reconciliation.js';
import { RepairError } from '../domain/repair.js';
import { WorkstreamError } from '../domain/workstreams.js';
import { formatAdoption } from '../presentation/format-adoption.js';
import {
  formatCanonicalRender,
  formatCanonicalValidation,
} from '../presentation/format-canonical.js';
import { formatInspection } from '../presentation/format-inspection.js';
import { formatRecording } from '../presentation/format-recording.js';
import { formatRegistration } from '../presentation/format-registration.js';
import { formatRepair } from '../presentation/format-repair.js';
import { formatStatus } from '../presentation/format-status.js';
import { formatWorkstream } from '../presentation/format-workstream.js';

const commandDescriptions: Record<PcpCommandName, string> = {
  inspect: 'Inspect and classify a candidate project without mutation',
  adopt: 'Preview or apply adoption into the canonical .pcp layer',
  register: 'Create or recover a stable project actor identity',
  status: 'Report project state and scoped reconciliation changes',
  record: 'Append one meaningful immutable continuity event',
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

interface AdoptOptions {
  candidate?: string;
  input?: string;
  apply?: string;
  json?: boolean;
}

interface RegisterOptions {
  candidate?: string;
  actorType?: string;
  client?: string;
  machineLabel?: string;
  actorId?: string;
  json?: boolean;
}

interface StatusOptions {
  candidate?: string;
  actorId: string;
  workstream?: string;
  scope?: string[];
  path?: string[];
  acknowledge?: string;
  json?: boolean;
}

interface RecordOptions {
  candidate?: string;
  input: string;
  json?: boolean;
}

interface ValidateOptions {
  cleanGenesis?: boolean;
  archiveIndexOnly?: boolean;
  json?: boolean;
}

interface RenderOptions {
  check?: boolean;
  json?: boolean;
}

interface RepairOptions {
  candidate?: string;
  apply?: string;
  json?: boolean;
}

interface WorkstreamOptions {
  candidate?: string;
  input: string;
  workstream?: string;
  json?: boolean;
}

function reportInspectionError(error: unknown): void {
  const code = error instanceof InspectionError ? error.code : 'PCP_INSPECTION_FAILED';
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${JSON.stringify({ code, message, mutated: false })}\n`);
  process.exitCode = 2;
}

function reportAdoptionError(error: unknown): void {
  const code = error instanceof AdoptionError ? error.code : 'PCP_ADOPTION_FAILED';
  const message = error instanceof Error ? error.message : String(error);
  const mutated = error instanceof AdoptionError ? error.mutated : false;
  const recoveryRetained = error instanceof AdoptionError && error.recoveryRoot !== undefined;
  process.stderr.write(
    `${JSON.stringify({ code, message, mutated, recovery_retained: recoveryRetained })}\n`,
  );
  process.exitCode = 2;
}

function reportRegistrationError(error: unknown): void {
  const code = error instanceof RegistrationError ? error.code : 'PCP_REGISTRATION_FAILED';
  const message = error instanceof Error ? error.message : String(error);
  const mutated = error instanceof RegistrationError ? error.mutated : false;
  process.stderr.write(`${JSON.stringify({ code, message, mutated })}\n`);
  process.exitCode = 2;
}

function reportStatusError(error: unknown): void {
  const code = error instanceof ReconciliationError ? error.code : 'PCP_STATUS_FAILED';
  const message = error instanceof Error ? error.message : String(error);
  const mutated = error instanceof ReconciliationError ? error.mutated : false;
  process.stderr.write(`${JSON.stringify({ code, message, mutated })}\n`);
  process.exitCode = 2;
}

function reportRecordingError(error: unknown): void {
  const code = error instanceof RecordingError ? error.code : 'PCP_RECORD_FAILED';
  const message = error instanceof Error ? error.message : String(error);
  const mutated = error instanceof RecordingError ? error.mutated : false;
  const recoveryRetained = error instanceof RecordingError ? error.recovery_retained : false;
  process.stderr.write(
    `${JSON.stringify({ code, message, mutated, recovery_retained: recoveryRetained })}\n`,
  );
  process.exitCode = 2;
}

function reportWorkstreamError(error: unknown): void {
  const code = error instanceof WorkstreamError ? error.code : 'PCP_WORKSTREAM_FAILED';
  const message = error instanceof Error ? error.message : String(error);
  const mutated = error instanceof WorkstreamError ? error.mutated : false;
  const recoveryRetained = error instanceof WorkstreamError ? error.recovery_retained : false;
  process.stderr.write(
    `${JSON.stringify({ code, message, mutated, recovery_retained: recoveryRetained })}\n`,
  );
  process.exitCode = 2;
}

function reportRepairError(error: unknown): void {
  const code = error instanceof RepairError ? error.code : 'PCP_REPAIR_FAILED';
  const message = error instanceof Error ? error.message : String(error);
  const mutated = error instanceof RepairError ? error.mutated : false;
  const recoveryRetained = error instanceof RepairError && error.recovery_root !== undefined;
  process.stderr.write(
    `${JSON.stringify({ code, message, mutated, recovery_retained: recoveryRetained })}\n`,
  );
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

function addAdoptCommand(program: Command): Command {
  return program
    .command('adopt')
    .description(commandDescriptions.adopt)
    .argument('[directory]', 'candidate project root')
    .option('--candidate <directory>', 'candidate project root')
    .option('--input <adoption.yaml>', 'external semantic adoption input')
    .option('--apply <digest>', 'apply only the matching fully recomputed preview digest')
    .option('--json', 'emit stable structured JSON')
    .action(async (directory: string | undefined, options: AdoptOptions) => {
      try {
        const result = await adoptProject(options.candidate ?? directory ?? '.', {
          ...(options.input === undefined ? {} : { input: options.input }),
          ...(options.apply === undefined ? {} : { apply: options.apply }),
        });
        process.stdout.write(
          options.json === true ? `${JSON.stringify(result, null, 2)}\n` : formatAdoption(result),
        );
      } catch (error) {
        reportAdoptionError(error);
      }
    });
}

function addRegisterCommand(program: Command): Command {
  return program
    .command('register')
    .description(commandDescriptions.register)
    .argument('[directory]', 'managed project root')
    .option('--candidate <directory>', 'managed project root')
    .option('--actor-type <agent|human>', 'durable actor type', 'agent')
    .option('--client <client>', 'agent client; omit only for a human')
    .option('--machine-label <slug>', 'stable lowercase machine label')
    .option('--actor-id <id>', 'recover one known profile when matches are ambiguous')
    .option('--json', 'emit stable structured JSON')
    .action(async (directory: string | undefined, options: RegisterOptions) => {
      try {
        const result = await registerActor(options.candidate ?? directory ?? '.', {
          machine_label: options.machineLabel ?? normalizeMachineLabel(hostname()),
          ...(options.actorType === undefined ? {} : { actor_type: options.actorType }),
          ...(options.client === undefined ? {} : { client: options.client }),
          ...(options.actorId === undefined ? {} : { actor_id: options.actorId }),
        });
        process.stdout.write(
          options.json === true
            ? `${JSON.stringify(result, null, 2)}\n`
            : formatRegistration(result),
        );
      } catch (error) {
        reportRegistrationError(error);
      }
    });
}

function addStatusCommand(program: Command): Command {
  return program
    .command('status')
    .description(commandDescriptions.status)
    .argument('[directory]', 'managed project root')
    .option('--candidate <directory>', 'managed project root')
    .requiredOption('--actor-id <id>', 'registered agent actor ID')
    .option('--workstream <id>', 'active workstream ID')
    .option('--scope <scope...>', 'additional semantic scopes')
    .option('--path <path...>', 'additional project-relative paths')
    .option('--acknowledge <digest>', 'advance only the matching recomputed status digest')
    .option('--json', 'emit stable structured JSON')
    .action(async (directory: string | undefined, options: StatusOptions) => {
      try {
        const result = await reportStatus(options.candidate ?? directory ?? '.', {
          actor_id: options.actorId,
          ...(options.workstream === undefined ? {} : { workstream_id: options.workstream }),
          ...(options.scope === undefined ? {} : { scopes: options.scope }),
          ...(options.path === undefined ? {} : { paths: options.path }),
          ...(options.acknowledge === undefined ? {} : { acknowledge: options.acknowledge }),
        });
        process.stdout.write(
          options.json === true ? `${JSON.stringify(result, null, 2)}\n` : formatStatus(result),
        );
      } catch (error) {
        reportStatusError(error);
      }
    });
}

function addRecordCommand(program: Command): Command {
  return program
    .command('record')
    .description(commandDescriptions.record)
    .argument('[directory]', 'managed project root')
    .option('--candidate <directory>', 'managed project root')
    .requiredOption('--input <event.yaml>', 'external continuity event input')
    .option('--json', 'emit stable structured JSON')
    .action(async (directory: string | undefined, options: RecordOptions) => {
      try {
        const result = await recordEvent(options.candidate ?? directory ?? '.', options.input);
        process.stdout.write(
          options.json === true ? `${JSON.stringify(result, null, 2)}\n` : formatRecording(result),
        );
      } catch (error) {
        reportRecordingError(error);
      }
    });
}

function addValidateCommand(program: Command): Command {
  return program
    .command('validate')
    .description(commandDescriptions.validate)
    .argument('[directory]', 'managed project root', '.')
    .option('--clean-genesis', 'require zero actor profiles and zero active or archived events')
    .option('--archive-index-only', 'validate archive filenames without reading archived content')
    .option('--json', 'emit stable structured JSON')
    .action(async (directory: string, options: ValidateOptions) => {
      try {
        const report = await validateCanonicalLayer(directory, {
          clean_genesis: options.cleanGenesis === true,
          archive_content: options.archiveIndexOnly === true ? 'filenames-only' : 'full',
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

function addWorkstreamCommand(program: Command): Command {
  const command = program.command('workstream').description(commandDescriptions.workstream);
  command.action(() => {
    command.outputHelp();
  });

  command
    .command('create')
    .description('Create one digest-bound canonical workstream')
    .argument('[directory]', 'managed project root')
    .option('--candidate <directory>', 'managed project root')
    .requiredOption('--input <workstream.yaml>', 'external workstream operation input')
    .option('--json', 'emit stable structured JSON')
    .action(async (directory: string | undefined, options: WorkstreamOptions) => {
      try {
        const result = await mutateWorkstream(
          options.candidate ?? directory ?? '.',
          'create',
          options.input,
        );
        process.stdout.write(
          options.json === true ? `${JSON.stringify(result, null, 2)}\n` : formatWorkstream(result),
        );
      } catch (error) {
        reportWorkstreamError(error);
      }
    });

  command
    .command('update')
    .description('Replace one nonterminal workstream using the current registry digest')
    .argument('[directory]', 'managed project root')
    .option('--candidate <directory>', 'managed project root')
    .requiredOption('--input <workstream.yaml>', 'external workstream operation input')
    .option('--json', 'emit stable structured JSON')
    .action(async (directory: string | undefined, options: WorkstreamOptions) => {
      try {
        const result = await mutateWorkstream(
          options.candidate ?? directory ?? '.',
          'update',
          options.input,
        );
        process.stdout.write(
          options.json === true ? `${JSON.stringify(result, null, 2)}\n` : formatWorkstream(result),
        );
      } catch (error) {
        reportWorkstreamError(error);
      }
    });

  command
    .command('validate')
    .description('Validate canonical workstreams and return the exact registry digest')
    .argument('[directory]', 'managed project root')
    .option('--candidate <directory>', 'managed project root')
    .option('--workstream <id>', 'select one workstream')
    .option('--json', 'emit stable structured JSON')
    .action(async (directory: string | undefined, options: WorkstreamOptions) => {
      try {
        const result = await validateWorkstreamRegistry(
          options.candidate ?? directory ?? '.',
          options.workstream,
        );
        process.stdout.write(
          options.json === true ? `${JSON.stringify(result, null, 2)}\n` : formatWorkstream(result),
        );
      } catch (error) {
        reportWorkstreamError(error);
      }
    });

  command
    .command('complete')
    .description('Complete one active or blocked workstream with criterion-bound evidence')
    .argument('[directory]', 'managed project root')
    .option('--candidate <directory>', 'managed project root')
    .requiredOption('--input <workstream.yaml>', 'external workstream operation input')
    .option('--json', 'emit stable structured JSON')
    .action(async (directory: string | undefined, options: WorkstreamOptions) => {
      try {
        const result = await mutateWorkstream(
          options.candidate ?? directory ?? '.',
          'complete',
          options.input,
        );
        process.stdout.write(
          options.json === true ? `${JSON.stringify(result, null, 2)}\n` : formatWorkstream(result),
        );
      } catch (error) {
        reportWorkstreamError(error);
      }
    });

  return command;
}

function addRepairCommand(program: Command): Command {
  return program
    .command('repair')
    .description(commandDescriptions.repair)
    .argument('[directory]', 'managed project root')
    .option('--candidate <directory>', 'managed project root')
    .option('--apply <digest>', 'apply only the matching fully recomputed preview digest')
    .option('--json', 'emit stable structured JSON')
    .action(async (directory: string | undefined, options: RepairOptions) => {
      try {
        const result = await repairProject(options.candidate ?? directory ?? '.', {
          ...(options.apply === undefined ? {} : { apply: options.apply }),
        });
        process.stdout.write(
          options.json === true ? `${JSON.stringify(result, null, 2)}\n` : formatRepair(result),
        );
      } catch (error) {
        reportRepairError(error);
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
    case 'upgrade':
      command.option('--apply <digest>', 'apply only the matching preview digest');
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
    } else if (commandName === 'adopt') {
      addAdoptCommand(program);
    } else if (commandName === 'register') {
      addRegisterCommand(program);
    } else if (commandName === 'status') {
      addStatusCommand(program);
    } else if (commandName === 'record') {
      addRecordCommand(program);
    } else if (commandName === 'validate') {
      addValidateCommand(program);
    } else if (commandName === 'render') {
      addRenderCommand(program);
    } else if (commandName === 'workstream') {
      addWorkstreamCommand(program);
    } else if (commandName === 'repair') {
      addRepairCommand(program);
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
