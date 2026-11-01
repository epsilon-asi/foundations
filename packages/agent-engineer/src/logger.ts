import { LOG_LEVELS, type LogLevel } from './config.js';

export type Logger = Readonly<Record<LogLevel, (message: string) => void>>;

/** Creates a logger that drops messages below `minimumLevel`. */
export function createLogger(minimumLevel: LogLevel, write: (text: string) => void): Logger {
  const threshold = LOG_LEVELS.indexOf(minimumLevel);

  const at =
    (level: LogLevel) =>
    (message: string): void => {
      if (LOG_LEVELS.indexOf(level) >= threshold) write(`[${level}] ${message}\n`);
    };

  return {
    debug: at('debug'),
    info: at('info'),
    warn: at('warn'),
    error: at('error'),
  };
}
