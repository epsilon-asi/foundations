import express, { type ErrorRequestHandler, type Express } from 'express';
import { randomUUID } from 'node:crypto';
import { ApiDefinitionError } from '../endpoints/ApiDefinitionError.js';
import type { ResourceSystem } from '../model/createResourceSystem.js';
import { createHttpListener, DEFAULT_PORT, type HttpListenerOptions } from '../runtime/httpListener.js';
import { compileResourceRoute, type PipelineOptions } from './pipeline.js';
import { routeSystem as defaultRouteSystem, type ResolveRoutesOptions, type RouteSystem } from './routes.js';

export interface ApiEnvironment {
  /** An absent APP_ENV selects production. */
  APP_ENV?: string;
  PORT?: string;
}

export interface CreateApiOptions extends Omit<PipelineOptions, 'roles'>,
  Pick<ResolveRoutesOptions, 'routes' | 'entry' | 'routesDir'>, Pick<HttpListenerOptions, 'host' | 'shutdownTimeoutMs'> {
  /** The application's independent endpoint inventory and declared role order. */
  resources: Pick<ResourceSystem, 'declaredEndpoints' | 'roles'>;
  /** Defaults to the route system that exports Routes and handler. */
  routeSystem?: RouteSystem;
  /** Defaults to the process environment. */
  env?: ApiEnvironment;
}

export interface Api {
  readonly app: Express;
  listen(port?: number): Promise<URL>;
  close(): Promise<void>;
}

/** Resolves the application contract and compiles its routes before opening a socket. */
export async function createApi(options: CreateApiOptions): Promise<Api> {
  const { resources, routes, entry, routesDir, routeSystem = defaultRouteSystem, env = process.env } = options;
  const verifiers = [...options.verifiers ?? []];
  if (verifiers.some(verifier => verifier.testOnly) && env.APP_ENV !== 'test') {
    throw new ApiDefinitionError('A test verifier requires APP_ENV=test.');
  }
  const bindings = await routeSystem.resolve({ endpoints: resources.declaredEndpoints, routes, entry, routesDir });
  const app = express();
  app.disable('x-powered-by');
  app.enable('case sensitive routing');
  app.enable('strict routing');
  const listener = createHttpListener({ handle: app, host: options.host, shutdownTimeoutMs: options.shutdownTimeoutMs });
  app.use((_req, res, next) => {
    res.set({
      'Strict-Transport-Security': 'max-age=31536000',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Cache-Control': 'no-store',
    });
    next();
  });
  app.get('/health/live', (_req, res) => { res.status(200).end(); });
  app.get('/health/ready', (_req, res) => { res.status(listener.draining ? 503 : 200).end(); });
  for (const binding of bindings) {
    const handlers = compileResourceRoute(binding, {
      roles: resources.roles, verifiers, membership: options.membership, bodyLimit: options.bodyLimit, unitOfWork: options.unitOfWork,
    });
    app[binding.endpoint.Method](binding.endpoint.Path, ...handlers);
  }
  app.use((_req, res) => {
    res.status(404).json({ code: 404, error: 'Route.NOT_FOUND', traceId: randomUUID() });
  });
  const onError: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) return next(error);
    // Express decodes path parameters while matching, before the route pipeline sees them.
    if (error instanceof URIError && 'status' in error && error.status === 400) {
      res.status(400).json({ code: 400, error: 'Request.INVALID_PATH', traceId: randomUUID() });
      return;
    }
    res.status(500).json({ code: 500, error: 'Server.INTERNAL', traceId: randomUUID() });
  };
  app.use(onError);
  return { app, listen: listener.listen, close: listener.close };
}

export interface RunApiOptions extends CreateApiOptions {
  /** Defaults to env.PORT or 3000. Pass zero for an ephemeral port. */
  port?: number;
}

/** Starts the API and drains its listener on SIGINT or SIGTERM. */
export async function runApi(options: RunApiOptions) {
  const api = await createApi(options);
  const env = options.env ?? process.env;
  const port = options.port ?? (env.PORT === undefined ? DEFAULT_PORT : Number(env.PORT));
  const close = async () => {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    await api.close();
  };
  const onSignal = () => { void close().catch(() => { process.exitCode = 1; }); };
  try {
    const url = await api.listen(port);
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
    return { ...api, url, close };
  } catch (error) {
    await close();
    throw error;
  }
}
