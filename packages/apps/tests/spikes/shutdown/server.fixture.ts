import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

const shutdownTimeoutMs = Number(process.argv[2]);
const app = express();
const server = createServer(app);
const drain = new AbortController();

// Keep the idle timeout beyond the test deadline. A socket that stays open
// after its last response would otherwise make a graceful stop look successful.
server.keepAliveTimeout = 60_000;

app.use((_req, res, next) => {
  // A streaming request can become idle after the sweep at the start of drain.
  res.once('finish', () => {
    if (drain.signal.aborted) server.closeIdleConnections();
  });
  next();
});

app.get('/health/ready', (req, res) => {
  const reply = () => res.status(drain.signal.aborted ? 503 : 200).end();
  if (req.query.at === 'drain') {
    // Hold an actual probe until the readiness transition so the test can
    // observe its HTTP status and whether the listener is still accepting.
    drain.signal.addEventListener('abort', () => {
      process.send!({ listeningAtReadinessChange: server.listening });
      reply();
    }, { once: true });
    process.send!('probe armed');
  } else {
    reply();
  }
});

app.get('/work', (_req, res) => {
  res.write('started\n');
  process.once('message', () => res.end('completed\n'));
});

function close() {
  if (drain.signal.aborted) return;
  drain.abort();
  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    server.closeAllConnections();
  }, shutdownTimeoutMs);
  server.close(() => {
    clearTimeout(deadline);
    process.send!(timedOut ? 'deadline' : 'drained');
    process.disconnect!();
  });
  server.closeIdleConnections();
}

process.once('SIGTERM', close);
process.once('SIGINT', close);
server.listen(0, '127.0.0.1', () => process.send!((server.address() as AddressInfo).port));
