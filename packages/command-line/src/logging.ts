import { createLogger as createFoundationLogger, type Logger } from '@epsilon-asi/foundation';
import { toScreamingSnakeCase } from './naming.js';
import type { LoggerOptions, LogLevel, Writer } from './types.js';

export { DEFAULT_LOG_LEVEL, LOG_LEVELS, isLogLevel } from '@epsilon-asi/foundation';

export const DEFAULT_LOG_LEVEL_FLAGS = '-l, --log-level <level>';
export const DEFAULT_LOG_LEVEL_DESCRIPTION = 'minimum severity of log output';

/** The environment variable a CLI reads its log level from: `agent-engineer` → `AGENT_ENGINEER_LOG_LEVEL`. */
export function logLevelEnvName(cliName: string): string {
  return `${toScreamingSnakeCase(cliName)}_LOG_LEVEL`;
}

/** Creates a logger that drops messages below `level` and writes the rest as `[level] message` lines. */
export function createLogger(level: LogLevel, write: Writer): Logger {
  return createFoundationLogger({
    level,
    write: (record) => write(`[${record.level}] ${record.message}\n`),
  });
}

/** What every CLI uses unless `buildCli` is given a `logger`: `createLogger` writing to stderr. */
export const defaultLoggerFactory = ({ level, io }: LoggerOptions): Logger => createLogger(level, io.stderr);
