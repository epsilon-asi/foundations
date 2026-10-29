import { redact } from '../utils/redact.js';
import type { Logger, LogLevel } from './Logger.js';

export class ConsoleLogger implements Logger {
  constructor(private readonly minimumLevel: LogLevel = 'info') {}

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
    if (!this.shouldWrite(level)) return;

    const safeMeta = meta === undefined ? undefined : redact(meta);
    const payload = safeMeta === undefined ? '' : ` ${JSON.stringify(safeMeta)}`;
    const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${payload}`;

    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }

  private shouldWrite(level: LogLevel): boolean {
    const weights: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    return weights[level] >= weights[this.minimumLevel];
  }
}
