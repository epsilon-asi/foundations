import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LocalLspClient,
  LspError,
  RepoSearchError,
  SandboxError,
  type LspClientOptions,
} from '../../src/repo-search/lsp/index.js';
import { makeTempRoot, writeFile } from './helpers.js';

const FAKE_SERVER = fileURLToPath(new URL('./fixtures/fake-lsp-server.mjs', import.meta.url));
const clients: LocalLspClient[] = [];

function fakeClient(options: Partial<LspClientOptions> = {}): LocalLspClient {
  const client = new LocalLspClient({
    command: process.execPath,
    args: [FAKE_SERVER],
    cwd: path.dirname(FAKE_SERVER),
    ...options,
  });
  clients.push(client);
  return client;
}

const position = { line: 0, character: 0 };

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.shutdown()));
});

describe('LocalLspClient', () => {
  it('starts once, tolerates protocol noise, and answers definition/references/documentSymbol', async () => {
    const root = await makeTempRoot();
    await writeFile(root, 'src/main.ts', '  mainSymbol  \n');
    const file = path.join(root, 'src/main.ts');
    const client = fakeClient({ rootUri: pathToFileURL(root).toString(), initializationOptions: { a: 1 } });

    await Promise.all([client.start(), client.start()]);
    await client.start();

    expect(await client.definition(file, position)).toEqual([
      { uri: pathToFileURL(file).toString(), range: { start: position, end: { line: 0, character: 1 } } },
    ]);
    const references = await client.references(file, position, false);
    expect(references.map((location) => location.uri)).toEqual([
      pathToFileURL(file).toString(),
      `${pathToFileURL(file).toString()}#2`,
    ]);

    expect(await client.documentSymbols(file)).toEqual([]);
    await client.openDocument(file, 'typescript');
    const [symbol] = await client.documentSymbols(file);
    expect(symbol).toMatchObject({ name: 'mainSymbol', detail: 'client-replies:1', kind: 12 });

    await client.openDocument(path.join(root, 'inline.ts'), 'typescript', 'inlineSymbol', 2);
    expect((await client.documentSymbols(path.join(root, 'inline.ts')))[0]?.name).toBe('inlineSymbol');
  });

  it('normalizes empty and scalar results to empty lists', async () => {
    const client = fakeClient();
    expect(await client.definition('/tmp/none.ts', position)).toEqual([]);
    expect(await client.definition('/tmp/scalar.ts', position)).toEqual([]);
  });

  it('rejects server errors and timeouts with LspError', async () => {
    const client = fakeClient({ timeoutMs: 200 });
    const failed = await client.definition('/tmp/error.ts', position).catch((error: unknown) => error);
    expect(failed).toBeInstanceOf(LspError);
    expect(failed).toBeInstanceOf(RepoSearchError);
    expect(failed).toBeInstanceOf(SandboxError);
    expect((failed as Error).message).toBe('LSP request textDocument/definition failed: boom');
    await expect(client.definition('/tmp/silent.ts', position)).rejects.toThrow(
      'LSP request timed out: textDocument/definition',
    );
  });

  it('rejects pending requests when the server exits and restarts on the next request', async () => {
    const client = fakeClient();
    await expect(client.definition('/tmp/crash.ts', position)).rejects.toThrow('Language server exited with code 3');
    expect(await client.definition('/tmp/ok.ts', position)).toHaveLength(1);
  });

  it('rejects start when the server cannot be spawned', async () => {
    const client = fakeClient({ command: path.join(path.dirname(FAKE_SERVER), 'missing-language-server') });
    const failure = await client.start().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(LspError);
    expect((failure as Error).message).toMatch(/^Language server failed: .*ENOENT/);
    expect((failure as Error).cause).toBeInstanceOf(Error);
    await expect(client.shutdown()).resolves.toBeUndefined();
  });

  it('shuts down idempotently, via asyncDispose, and kills servers that ignore exit', async () => {
    const idle = fakeClient();
    await expect(idle.shutdown()).resolves.toBeUndefined();

    const disposable = fakeClient();
    await disposable.start();
    await disposable[Symbol.asyncDispose]();
    await disposable.shutdown();
    expect(await disposable.definition('/tmp/again.ts', position)).toHaveLength(1);

    const stubborn = fakeClient({ args: [FAKE_SERVER, '--ignore-exit'], timeoutMs: 300 });
    await stubborn.start();
    const started = Date.now();
    await stubborn.shutdown();
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
  });
});
