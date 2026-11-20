import { createHttpListener } from '@epsilon-asi/apps/runtime';
import express from 'express';
import type { Server, ServerResponse } from 'node:http';

const shutdownTimeoutMs = Number(process.argv[2]);
const app = express();
let server: Server;
let pendingProbe: (() => void) | undefined;
let work: ServerResponse | undefined;

const listener = createHttpListener({
  shutdownTimeoutMs,
  handle(this: Server, req, res) {
    server = this;
    // An idle socket must outlive the test deadline unless the runtime drains it.
    server.keepAliveTimeout = 60_000;
    app(req, res);
  },
});

app.get('/health/ready', (req, res) => {
  const reply = () => res.status(listener.draining ? 503 : 200).end();
  if (req.query.at === 'drain') {
    pendingProbe = () => {
      process.send!({ listeningAtReadinessChange: server.listening });
      reply();
    };
    process.send!('probe armed');
  } else {
    reply();
  }
});

app.get('/work', (_req, res) => {
  work = res;
  res.write('started\n');
  process.once('message', () => res.end('completed\n'));
});

async function close() {
  const stopped = listener.close();
  pendingProbe?.();
  await stopped;
  process.send!(work?.writableFinished ? 'drained' : 'deadline');
  process.disconnect!();
}

process.once('SIGTERM', close);
process.once('SIGINT', close);
void listener.listen(0).then(address => process.send!(Number(address.port)));
