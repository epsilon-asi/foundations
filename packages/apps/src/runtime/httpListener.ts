import { createServer, type RequestListener } from 'node:http';
import { isIPv6 } from 'node:net';

export const DEFAULT_PORT = 3000;
export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;
// Node schedules larger timeout values after one millisecond.
const MAX_TIMER_MS = 2 ** 31 - 1;

export interface HttpListenerOptions {
  handle: RequestListener;
  /** Bind address. Defaults to loopback. */
  host?: string;
  /** Maximum time allowed for active requests to finish. Defaults to ten seconds. */
  shutdownTimeoutMs?: number;
}

/** Owns one listener, from its first successful bind through its final drain. */
export function createHttpListener({ handle, host = DEFAULT_HOST, shutdownTimeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS }: HttpListenerOptions) {
  if (!Number.isInteger(shutdownTimeoutMs) || shutdownTimeoutMs < 0 || shutdownTimeoutMs > MAX_TIMER_MS) {
    throw new RangeError(`shutdownTimeoutMs must be an integer between 0 and ${MAX_TIMER_MS}.`);
  }
  const server = createServer(handle);
  let starting: Promise<URL> | undefined;
  let closing: Promise<void> | undefined;
  server.prependListener('request', (_req, res) => {
    res.once('finish', () => { if (closing) server.closeIdleConnections(); });
  });

  function listen(port = DEFAULT_PORT): Promise<URL> {
    if (closing) return Promise.reject(new Error('The HTTP listener is closed.'));
    if (starting) return starting;
    starting = new Promise<URL>((resolve, reject) => {
      const onError = (error: Error) => {
        server.off('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        server.off('error', onError);
        const address = server.address();
        if (!address || typeof address === 'string') return reject(new Error('Expected a TCP listening address.'));
        const hostname = isIPv6(address.address) ? '[' + address.address + ']' : address.address;
        resolve(new URL('http://' + hostname + ':' + address.port));
      };
      server.once('error', onError);
      server.once('listening', onListening);
      try { server.listen(port, host); }
      catch (error) {
        server.off('error', onError);
        server.off('listening', onListening);
        reject(error);
      }
    }).catch(error => { starting = undefined; throw error; });
    return starting;
  }

  function close(): Promise<void> {
    return closing ??= (async () => {
      await starting?.catch(() => {});
      if (!server.listening) return;
      await new Promise<void>((resolve, reject) => {
        const deadline = setTimeout(() => server.closeAllConnections(), shutdownTimeoutMs);
        deadline.unref();
        server.close(error => {
          clearTimeout(deadline);
          if (error) reject(error);
          else resolve();
        });
        server.closeIdleConnections();
      });
    })();
  }
  return { listen, close, get draining() { return closing !== undefined; } };
}
