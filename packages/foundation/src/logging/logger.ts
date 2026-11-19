import { prepareLogFields, type LogRedactionOptions } from './fields.js';
import { DEFAULT_LOG_LEVEL, LOG_LEVELS, type LogLevel } from './levels.js';

export type { LogRedactionOptions } from './fields.js';
export type LogFields = Readonly<Record<string, unknown>>;

/** One message that met the logger's threshold. */
export interface LogRecord {
  readonly level: Exclude<LogLevel, 'silent'>;
  readonly message: string;
  readonly fields?: LogFields;
}

export interface Logger {
  /** The minimum level this logger writes. */
  readonly level: LogLevel;
  /** Bind fields for this logger's descendants. Fields on an individual call take precedence. */
  child(bindings: LogFields): Logger;
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

export interface CreateLoggerOptions {
  /** Default: `DEFAULT_LOG_LEVEL` (`info`). */
  readonly level?: LogLevel;
  /** Field redaction policy shared by this logger and its children. */
  readonly redaction?: LogRedactionOptions;
  readonly write: (record: LogRecord) => void;
}

function mergeFields(bindings?: LogFields, fields?: LogFields): LogFields {
  const merged: Record<string, unknown> = Object.create(null);
  for (const source of [bindings, fields]) {
    if (source === undefined) continue;
    for (const key of Object.keys(source)) {
      // Redaction decides whether a getter may be read, even on bound fields.
      const descriptor = Object.getOwnPropertyDescriptor(source, key)!;
      descriptor.configurable = true;
      if (descriptor.get) descriptor.get = descriptor.get.bind(source);
      Object.defineProperty(merged, key, descriptor);
    }
  }
  return merged;
}

export function createLogger({ level = DEFAULT_LOG_LEVEL, write, redaction }: CreateLoggerOptions): Logger {
  const threshold = LOG_LEVELS.indexOf(level);

  function bind(bindings?: LogFields): Logger {
    const at = (level: LogRecord['level']) => (message: string, fields?: LogFields): void => {
      if (LOG_LEVELS.indexOf(level) < threshold) return;
      const merged = bindings && fields ? mergeFields(bindings, fields) : bindings ?? fields;
      const record = { level, message };
      write(merged === undefined ? record : { ...record, fields: prepareLogFields(merged, redaction) });
    };

    return Object.freeze({
      level,
      child: (fields: LogFields) => bind(Object.freeze(mergeFields(bindings, fields))),
      debug: at('debug'),
      info: at('info'),
      warn: at('warn'),
      error: at('error'),
    });
  }

  return bind();
}
