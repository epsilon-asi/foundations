export interface StoredSession {
  cookies?: unknown[];
  localStorage?: Record<string, string>;
  savedAt: string;
}

export interface SessionStore {
  load(actorId: string, accountId?: string): Promise<StoredSession | null>;
  save(actorId: string, session: StoredSession, accountId?: string): Promise<void>;
  clear(actorId: string, accountId?: string): Promise<void>;
}

export class NoopSessionStore implements SessionStore {
  async load(): Promise<StoredSession | null> {
    return null;
  }

  async save(): Promise<void> {}

  async clear(): Promise<void> {}
}
