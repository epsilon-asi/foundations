import { prepareLogFields } from './fields.js';
import type { LogRecord } from './logger.js';

export type JsonLogFormat = 'generic' | 'gcp';

export const DEFAULT_JSON_LOG_FORMAT: JsonLogFormat = 'generic';

export interface JsonLogWriterOptions {
  /** Receives one complete JSON line, including the trailing newline. */
  readonly write: (line: string) => void;
  /** Default: 'generic'. */
  readonly format?: JsonLogFormat;
}

const gcpSeverity = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
} as const satisfies Record<LogRecord['level'], string>;

/** Write structured fields alongside the record's message and severity. */
export function createJsonLogWriter({
  write,
  format = DEFAULT_JSON_LOG_FORMAT,
}: JsonLogWriterOptions): (record: LogRecord) => void {
  return ({ level, message, fields }) => {
    const entry: Record<string, unknown> = Object.assign(
      Object.create(null), fields && prepareLogFields(fields),
    );
    // JSON.stringify invokes a top-level toJSON method before encoding the record.
    if (typeof entry.toJSON === 'function') delete entry.toJSON;
    if (format === 'gcp') entry.severity = gcpSeverity[level];
    else entry.level = level;
    entry.message = message;
    write(JSON.stringify(entry) + '\n');
  };
}
