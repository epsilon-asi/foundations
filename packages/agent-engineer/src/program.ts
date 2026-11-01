import { Command, CommanderError } from '@commander-js/extra-typings';
import { runInfo } from './commands/info.js';
import { CLI, commands, globalOptions } from './config.js';
import { processIO, type CliIO } from './context.js';
import { createLogger } from './logger.js';

/**
 * Builds the commander program from the declarations in `config.ts`.
 *
 * Global options must be added before `.command()` so subcommands inherit their
 * types, and `exitOverride`/`configureOutput` must be set first so subcommands
 * inherit those settings too.
 */
export function createProgram(io: CliIO = processIO) {
  const program = new Command()
    .name(CLI.name)
    .description(CLI.description)
    .version(CLI.version)
    .configureOutput({ writeOut: io.stdout, writeErr: io.stderr })
    .exitOverride()
    .addOption(globalOptions.logLevel());

  program
    .command(commands.info.name)
    .description(commands.info.description)
    .addOption(commands.info.options.format())
    .action((options, command) => {
      const { logLevel } = command.optsWithGlobals();
      runInfo(options, { io, logger: createLogger(logLevel, io.stderr) });
    });

  return program;
}

/**
 * Parses `args` (user arguments only, without the node and script paths) and
 * runs the matching command. Resolves to the process exit code instead of
 * exiting, so callers decide how to terminate.
 */
export async function run(args: readonly string[], io: CliIO = processIO): Promise<number> {
  try {
    await createProgram(io).parseAsync(args, { from: 'user' });
    return 0;
  } catch (error: unknown) {
    // Commander has already written its own message (or help/version output).
    if (error instanceof CommanderError) return error.exitCode;

    io.stderr(`error: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}
