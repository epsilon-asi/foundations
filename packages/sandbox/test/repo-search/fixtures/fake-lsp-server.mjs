// Minimal language server for LocalLspClient tests: Content-Length framed JSON-RPC over stdio.
// Behaviour is selected by the document URI's file name (error.ts, crash.ts, silent.ts, none.ts, scalar.ts).
// `--ignore-exit` keeps the process alive after the `exit` notification.
const ignoreExit = process.argv.includes('--ignore-exit');
// Stay alive even after stdin closes, like a server that never honours `exit`.
if (ignoreExit) setInterval(() => undefined, 60_000);
const opened = new Map();
let clientReplies = 0;
let buffer = Buffer.alloc(0);

const range = { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } };
const location = (uri) => ({ uri, range });

function send(message) {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function handle(message) {
  const { id, method, params } = message;
  if (method === undefined) {
    if (message.error?.code === -32601) clientReplies += 1;
    return;
  }
  const uri = params?.textDocument?.uri ?? '';
  switch (method) {
    case 'initialize':
      // Noise the client must tolerate before the real response: a notification, a header block without
      // Content-Length, and a body that is not JSON.
      send({ jsonrpc: '2.0', method: 'window/logMessage', params: { type: 3, message: 'starting' } });
      process.stdout.write('X-Noise: no length\r\n\r\n');
      process.stdout.write('Content-Length: 9\r\n\r\nnot json!');
      reply(id, { capabilities: { definitionProvider: true } });
      return;
    case 'textDocument/didOpen':
      opened.set(uri, params.textDocument.text);
      return;
    case 'textDocument/definition':
      if (uri.endsWith('error.ts')) return send({ jsonrpc: '2.0', id, error: { code: -32603, message: 'boom' } });
      if (uri.endsWith('crash.ts')) return process.exit(3);
      if (uri.endsWith('silent.ts')) return;
      if (uri.endsWith('none.ts')) return reply(id, null);
      if (uri.endsWith('scalar.ts')) return reply(id, 42);
      // A server-to-client request reusing the pending request id must not be mistaken for the response.
      send({ jsonrpc: '2.0', id, method: 'workspace/configuration', params: { items: [] } });
      return reply(id, location(uri));
    case 'textDocument/references':
      return reply(id, [location(uri), location(`${uri}#2`)]);
    case 'textDocument/documentSymbol': {
      const text = opened.get(uri);
      if (text === undefined) return reply(id, null);
      return reply(id, [
        { name: text.trim(), detail: `client-replies:${clientReplies}`, kind: 12, range, selectionRange: range },
      ]);
    }
    case 'shutdown':
      return reply(id, null);
    case 'exit':
      if (!ignoreExit) process.exit(0);
      return;
    default:
      if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: `unknown ${method}` } });
  }
}

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (;;) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;
    const length = Number(/Content-Length: (\d+)/i.exec(buffer.subarray(0, headerEnd).toString())?.[1]);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + length) return;
    const body = buffer.subarray(bodyStart, bodyStart + length).toString();
    buffer = buffer.subarray(bodyStart + length);
    handle(JSON.parse(body));
  }
});
