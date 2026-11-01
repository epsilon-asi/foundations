import { readFileSync } from 'node:fs';
import { Option } from '@commander-js/extra-typings';

/**
 * Every declaration the CLI is built from: program metadata, environment
 * variables, option definitions, and the option value types they produce.
 * `program.ts` only wires these declarations into commander.
 *
 * Options are exposed as factories because commander mutates an `Option` when
 * it is added to a command, so each program needs its own instances.
 */

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const OUTPUT_FORMATS = ['text', 'json'] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export const DEFAULT_LOG_LEVEL: LogLevel = 'info';
export const DEFAULT_OUTPUT_FORMAT: OutputFormat = 'text';

export const ENV_VARS = {
  logLevel: 'AGENT_ENGINEER_LOG_LEVEL',
} as const;

export interface CliMetadata {
  readonly name: string;
  readonly description: string;
  readonly version: string;
}

export const CLI: CliMetadata = {
  name: 'agent-engineer',
  description: 'Agent Engineer command-line interface.',
  version: readPackageVersion(),
};

/** Parsed values of the options available to every command. */
export interface GlobalOptions {
  logLevel: LogLevel;
}

export const globalOptions = {
  logLevel: () =>
    new Option('-l, --log-level <level>', 'minimum severity of log output')
      .choices(LOG_LEVELS)
      .default(DEFAULT_LOG_LEVEL)
      .env(ENV_VARS.logLevel),
} as const;

/** Parsed values of the `info` command's own options. */
export interface InfoOptions {
  format: OutputFormat;
}

export const commands = {
  info: {
    name: 'info',
    description: 'Print CLI and runtime information.',
    options: {
      format: () =>
        new Option('-f, --format <format>', 'output format')
          .choices(OUTPUT_FORMATS)
          .default(DEFAULT_OUTPUT_FORMAT),
    },
  },
} as const;

/** Reads the version from package.json so `--version` stays in sync with releases. */
function readPackageVersion(): string {
  // Resolves to the package root from both `src/` (tsx, vitest) and `dist/` (built).
  const packageJson: unknown = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

  if (typeof packageJson === 'object' && packageJson !== null && 'version' in packageJson && typeof packageJson.version === 'string') {
    return packageJson.version;
  }

  throw new Error('package.json is missing a string "version" field');
}
