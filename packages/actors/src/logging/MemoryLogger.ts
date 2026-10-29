import { redact } from '../utils/redact.js';
import type { Logger, LogLevel, LogRecord } from './Logger.js';

export class MemoryLogger implements Logger {
  readonly records: LogRecord[] = [];

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write('error', message, meta);
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const record: LogRecord = {
      level,
      message,
      timestamp: new Date().toISOString()
    };
    if (meta !== undefined) {
      record.meta = redact(meta);
    }
    this.records.push(record);
  }
}
