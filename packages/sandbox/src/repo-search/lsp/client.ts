import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { isRecord, omitUndefined } from '../../shared/objects.js';
import { LspError } from '../errors.js';
import type { LspClientOptions, LspDocumentSymbol, LspLocation, LspPosition } from './types.js';

const DEFAULT_TIMEOUT_MS = 20_000;
/** Upper bound on how long `shutdown` waits for the server to exit before killing it. */
const SHUTDOWN_GRACE_MS = 2_000;
const HEADER_DELIMITER = '\r\n\r\n';
const CONTENT_LENGTH = /Content-Length:\s*(\d+)/i;
/** JSON-RPC error code for requests the receiver does not implement. */
const METHOD_NOT_FOUND = -32601;

interface PendingRequest {
  method: string;
  resolve: (result: unknown) => void;
  reject: (error: LspError) => void;
  timer: NodeJS.Timeout;
}

/**
 * Minimal local Language Server Protocol client.
 *
 * Spawns a language server on this machine (directly, not through a `CommandExecutor`: the session is a long-lived
 * stdio stream rather than a run-to-completion command) and speaks JSON-RPC over stdio: initialize, open document,
 * definition, references, document symbols, and shutdown. Requests start the server on demand (again, if it
 * exited). Dispose it with `shutdown()` or `await using`.
 */
export class LocalLspClient implements AsyncDisposable {
  private readonly options: LspClientOptions;
  private readonly timeoutMs: number;
  private readonly pending = new Map<number, PendingRequest>();
  private child: ChildProcessWithoutNullStreams | undefined;
  private startup: Promise<void> | undefined;
  private buffer: Buffer = Buffer.alloc(0);
  private nextId = 1;

  constructor(options: LspClientOptions) {
    this.options = options;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Spawns the server and completes the `initialize` handshake. Concurrent and repeated calls share one start. */
  start(): Promise<void> {
    this.startup ??= this.launch().catch((error: unknown) => {
      this.startup = undefined;
      this.child?.kill();
      throw error;
    });
    return this.startup;
  }

  /** Sends `textDocument/didOpen`, reading the file when `text` is not given. */
  async openDocument(filePath: string, languageId: string, text?: string, version = 1): Promise<void> {
    await this.start();
    const content = text ?? (await fs.readFile(filePath, 'utf8'));
    this.notify('textDocument/didOpen', {
      textDocument: { uri: fileUri(filePath), languageId, version, text: content },
    });
  }

  async definition(filePath: string, position: LspPosition): Promise<LspLocation[]> {
    const result = await this.call('textDocument/definition', { textDocument: { uri: fileUri(filePath) }, position });
    return normalizeLocations(result);
  }

  async references(filePath: string, position: LspPosition, includeDeclaration = true): Promise<LspLocation[]> {
    const result = await this.call('textDocument/references', {
      textDocument: { uri: fileUri(filePath) },
      position,
      context: { includeDeclaration },
    });
    return normalizeLocations(result);
  }

  async documentSymbols(filePath: string): Promise<LspDocumentSymbol[]> {
    const result = await this.call('textDocument/documentSymbol', { textDocument: { uri: fileUri(filePath) } });
    return Array.isArray(result) ? result.filter(isDocumentSymbol) : [];
  }

  /** Sends `shutdown` and `exit`, waits briefly for the server to exit, then kills it. No-op when not running. */
  async shutdown(): Promise<void> {
    const startup = this.startup;
    if (!startup) return;
    try {
      await startup;
    } catch {
      return;
    }
    const child = this.child;
    if (!child) return;
    try {
      await this.request('shutdown', null);
    } catch {
      // The server may already be gone; `exit` and the kill below still apply.
    }
    this.notify('exit');
    child.stdin.end();
    await waitForExit(child, Math.min(this.timeoutMs, SHUTDOWN_GRACE_MS));
    this.terminate(child, new LspError('Language server was shut down'));
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.shutdown();
  }

  private async launch(): Promise<void> {
    const child = spawn(this.options.command, this.options.args ?? [], { cwd: this.options.cwd, stdio: 'pipe' });
    this.child = child;
    this.buffer = Buffer.alloc(0);
    child.stdout.on('data', (chunk: Buffer) => {
      this.handleData(chunk);
    });
    child.stderr.resume();
    // Writes after the server exits fail with EPIPE; pending requests are rejected through 'exit' instead.
    child.stdin.on('error', () => undefined);
    child.on('error', (error) => {
      this.terminate(child, new LspError(`Language server failed: ${error.message}`, { cause: error }));
    });
    child.on('exit', (code, signal) => {
      const status = code === null ? `signal ${signal ?? 'unknown'}` : `code ${code}`;
      this.terminate(child, new LspError(`Language server exited with ${status}`));
    });

    await this.request('initialize', {
      processId: process.pid,
      rootUri: this.options.rootUri ?? pathToFileURL(this.options.cwd).toString(),
      capabilities: {
        textDocument: {
          definition: { dynamicRegistration: false },
          references: { dynamicRegistration: false },
          documentSymbol: { dynamicRegistration: false, hierarchicalDocumentSymbolSupport: true },
        },
        workspace: { workspaceFolders: true },
      },
      initializationOptions: this.options.initializationOptions ?? {},
    });
    this.notify('initialized', {});
  }

  private async call(method: string, params: unknown): Promise<unknown> {
    await this.start();
    return this.request(method, params);
  }

  private request(method: string, params: unknown): Promise<unknown> {
    const child = this.child;
    if (!child) return Promise.reject(new LspError(`Language server is not running (${method})`));
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new LspError(`LSP request timed out: ${method}`));
      }, this.timeoutMs);
      this.pending.set(id, { method, resolve, reject, timer });
      send(child, { jsonrpc: '2.0', id, method, params });
    });
  }

  private notify(method: string, params?: unknown): void {
    if (this.child) send(this.child, { jsonrpc: '2.0', method, ...omitUndefined({ params }) });
  }

  /** Rejects everything pending on `child` with `error` and forgets it, unless a newer process replaced it. */
  private terminate(child: ChildProcessWithoutNullStreams, error: LspError): void {
    if (this.child !== child) return;
    this.child = undefined;
    this.startup = undefined;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  /** Splits the stdout byte stream into `Content-Length`-framed JSON-RPC messages. */
  private handleData(chunk: Buffer): void {
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const headerEnd = this.buffer.indexOf(HEADER_DELIMITER);
      if (headerEnd === -1) return;
      const bodyStart = headerEnd + HEADER_DELIMITER.length;
      const lengthText = CONTENT_LENGTH.exec(this.buffer.subarray(0, headerEnd).toString('ascii'))?.[1];
      if (lengthText === undefined) {
        // A header block without Content-Length cannot be framed; drop it and resynchronize on the next header.
        this.buffer = this.buffer.subarray(bodyStart);
        continue;
      }
      const bodyEnd = bodyStart + Number(lengthText);
      if (this.buffer.length < bodyEnd) return;
      const body = this.buffer.subarray(bodyStart, bodyEnd).toString('utf8');
      this.buffer = this.buffer.subarray(bodyEnd);
      this.handleMessage(parseJson(body));
    }
  }

  private handleMessage(message: unknown): void {
    if (!isRecord(message)) return;
    const { id, method } = message;
    if (typeof method === 'string') {
      // A server-to-client request: none are supported, so answer instead of leaving the server waiting.
      if (id !== undefined && this.child) {
        send(this.child, {
          jsonrpc: '2.0',
          id,
          error: { code: METHOD_NOT_FOUND, message: `Unsupported method: ${method}` },
        });
      }
      return;
    }
    if (typeof id !== 'number') return;
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(id);
    if (isRecord(message.error)) {
      const reason = typeof message.error.message === 'string' ? message.error.message : 'unknown error';
      pending.reject(new LspError(`LSP request ${pending.method} failed: ${reason}`));
    } else {
      pending.resolve(message.result);
    }
  }
}

function send(child: ChildProcessWithoutNullStreams, message: Record<string, unknown>): void {
  const body = JSON.stringify(message);
  child.stdin.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}${HEADER_DELIMITER}${body}`);
}

function waitForExit(child: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill();
      resolve();
    }, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function fileUri(filePath: string): string {
  return pathToFileURL(filePath).toString();
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** `Location | Location[] | null` → `Location[]`. */
function normalizeLocations(result: unknown): LspLocation[] {
  if (Array.isArray(result)) return result.filter(isLocation);
  return isLocation(result) ? [result] : [];
}

function isLocation(value: unknown): value is LspLocation {
  return isRecord(value) && typeof value.uri === 'string' && isRecord(value.range);
}

function isDocumentSymbol(value: unknown): value is LspDocumentSymbol {
  return isRecord(value) && typeof value.name === 'string' && typeof value.kind === 'number';
}
