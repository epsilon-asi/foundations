import { toScreamingSnakeCase } from './naming.js';
import type { Logger, LoggerFactory, LogLevel, Writer } from './types.js';

/** Every log level, least to most severe. `silent` suppresses all output. */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const satisfies readonly LogLevel[];

export const DEFAULT_LOG_LEVEL: LogLevel = 'info';
export const DEFAULT_LOG_LEVEL_FLAGS = '-l, --log-level <level>';
export const DEFAULT_LOG_LEVEL_DESCRIPTION = 'minimum severity of log output';

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value);
}

/** The environment variable a CLI reads its log level from: `agent-engineer` → `AGENT_ENGINEER_LOG_LEVEL`. */
export function logLevelEnvName(cliName: string): string {
  return `${toScreamingSnakeCase(cliName)}_LOG_LEVEL`;
}

type MessageLevel = Exclude<LogLevel, 'silent'>;

/** Creates a logger that drops messages below `level` and writes the rest as `[level] message` lines. */
export function createLogger(level: LogLevel, write: Writer): Logger {
  const threshold = LOG_LEVELS.indexOf(level);

  const at =
    (messageLevel: MessageLevel) =>
    (message: string): void => {
      if (LOG_LEVELS.indexOf(messageLevel) >= threshold) write(`[${messageLevel}] ${message}\n`);
    };

  return Object.freeze({
    level,
    debug: at('debug'),
    info: at('info'),
    warn: at('warn'),
    error: at('error'),
  });
}

/** What every CLI uses unless `buildCli` is given a `logger`: `createLogger` writing to stderr. */
export const defaultLoggerFactory: LoggerFactory = ({ level, io }) => createLogger(level, io.stderr);
