export interface AutomationErrorMeta {
  actorId?: string;
  taskName?: string;
  url?: string;
  screenshotPath?: string;
  cause?: unknown;
  details?: Record<string, unknown>;
}

export class AutomationError extends Error {
  readonly actorId: string | undefined;
  readonly taskName: string | undefined;
  readonly url: string | undefined;
  readonly screenshotPath: string | undefined;
  readonly details: Record<string, unknown> | undefined;

  constructor(message: string, meta: AutomationErrorMeta = {}) {
    super(message, meta.cause instanceof Error ? { cause: meta.cause } : undefined);
    this.name = new.target.name;
    this.actorId = meta.actorId;
    this.taskName = meta.taskName;
    this.url = meta.url;
    this.screenshotPath = meta.screenshotPath;
    this.details = meta.details;
  }
}
