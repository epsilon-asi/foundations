import { randomUUID } from 'node:crypto';
import { createChainBinding, type ChainCleanup, type ChainNext, type ChainStep } from '@epsilon-asi/foundation';
import express, { type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod/v4';
import { ApiDefinitionError } from '../endpoints/ApiDefinitionError.js';
import { hasJsonRequestBody, type HttpEndpoint } from '../endpoints/httpEndpoint.js';
import { decodeBracketQuery } from '../query/bracketQuery.js';
import { AUTHENTICATION_ERRORS } from '../responses/authenticationFailure.js';
import { DomainError } from '../responses/defineErrors.js';
import { isFailure } from '../responses/failure.js';
import type { ValidationFailureResponse } from '../responses/validationFailure.js';
import type { TenantScope, UnitOfWork } from '../runtime/unitOfWork.js';
import type { MembershipResolver, TenantMembership, TokenVerifier, UserPrincipal } from './auth.js';
import type { BoundRoute } from './routes.js';

/** Maximum number of request body bytes accepted by a resource route. */
export const DEFAULT_BODY_LIMIT = 1024 * 1024;

export interface PipelineOptions {
  readonly verifiers?: readonly TokenVerifier[];
  readonly membership?: MembershipResolver;
  readonly roles: readonly string[];
  /** Optional storage binding shared by all resource routes in this app. */
  readonly unitOfWork?: UnitOfWork;
  /** Maximum request body size in bytes. Default: DEFAULT_BODY_LIMIT. */
  readonly bodyLimit?: number;
}

interface RequestContext {
  readonly traceId: string;
  readonly raw: { readonly req: Request; readonly res: Response };
}

/** Trusted context of a tenant-scoped HTTP handler. */
export interface HttpContext extends RequestContext, TenantScope {
  readonly principal: UserPrincipal;
  readonly membership: TenantMembership;
  /** Request-scoped manager supplied by the configured unit of work. */
  readonly em?: object;
  readonly defer: (cleanup: ChainCleanup) => void;
}

interface Reply {
  readonly status: number;
  readonly body: unknown;
}

type Next = ChainNext<{ readonly reply: Reply }>;
type Issues = ValidationFailureResponse['issues'];
type WireError = `${string}.${string}`;

class HttpFailure extends Error {
  constructor(readonly code: number, readonly error: WireError, readonly issues?: Issues) {
    super(error);
  }
}

const chain = createChainBinding<ChainStep, Reply, { readonly reply: Reply }>({
  subject: 'request',
  reservedKeys: ['raw', 'traceId'],
  wrap: reply => ({ reply }),
  isStop: (_value): _value is Reply => false,
  successful: reply => reply.status < 400,
});

const forbidden = () => new HttpFailure(403, 'Auth.FORBIDDEN');
const notFound = () => new HttpFailure(404, 'Resource.NOT_FOUND');
const internal = () => new HttpFailure(500, 'Server.INTERNAL');

/** Expose field names relative to the flat request, including each rejected extra key. */
function validationFailure(error: z.ZodError, endpoint: HttpEndpoint): HttpFailure {
  const issues = error.issues.flatMap(issue => {
    const [section, ...fieldPath] = issue.path;
    const key = fieldPath[0];
    const mapping = endpoint.Route.paramFields;
    if (section === 'params' && typeof key === 'string' && mapping && Object.hasOwn(mapping, key)) {
      fieldPath[0] = mapping[key];
    }
    const paths = issue.code === 'unrecognized_keys' ? issue.keys.map(key => [...fieldPath, key]) : [fieldPath];
    return paths.map(path => ({ path: path.map(String).join('.'), message: issue.message, code: issue.code }));
  });
  return new HttpFailure(422, 'Request.INVALID', issues);
}

function jsonBody(req: Request): unknown {
  if (!Buffer.isBuffer(req.body) || !req.is(['application/json', 'application/*+json'])) {
    throw new HttpFailure(400, 'Request.INVALID_JSON');
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(req.body));
  } catch {
    throw new HttpFailure(400, 'Request.INVALID_JSON');
  }
}

function emptyBody(req: Request) {
  if (req.body?.length) throw new HttpFailure(400, 'Request.UNEXPECTED_BODY');
  return {};
}

function decodeRequest(endpoint: HttpEndpoint, req: Request, body: unknown) {
  try {
    const start = req.url.indexOf('?');
    const query = endpoint.Route.operation === 'List'
      ? decodeBracketQuery(start < 0 ? '' : req.url.slice(start + 1)) : req.query;
    return endpoint.fromContent({ params: req.params, query, headers: {}, body });
  } catch (error) {
    if (error instanceof z.ZodError) throw validationFailure(error, endpoint);
    throw error;
  }
}

function compileAccess(endpoint: HttpEndpoint, roles: readonly string[]) {
  const ranks = new Map(roles.map((role, rank) => [role, rank]));
  const requiredRank = (rule: unknown) => {
    const rank = typeof rule === 'string' ? ranks.get(rule) : undefined;
    if (rank === undefined) throw new ApiDefinitionError(`Endpoint "${endpoint.Name}" requires a declared role for each HTTP access rule.`);
    return rank;
  };
  const floor = requiredRank(endpoint.Access);
  const fields = Object.entries(endpoint.FieldAccess ?? {}).map(([name, settings]) => {
    if (!settings || typeof settings !== 'object' || Object.keys(settings).some(key => key !== 'write')) {
      throw new ApiDefinitionError(`Unsupported HTTP field access rule on "${endpoint.Name}.${name}".`);
    }
    return { name, rank: requiredRank(settings.write) };
  });
  return {
    checkFloor(membership: TenantMembership) {
      if ((ranks.get(membership.role) ?? -1) < floor) throw forbidden();
    },
    checkFields(membership: TenantMembership, request: unknown) {
      for (const field of fields) {
        if (Object.hasOwn(request as object, field.name) && (ranks.get(membership.role) ?? -1) < field.rank) throw forbidden();
      }
    },
  };
}

async function authenticate(req: Request, verifiers: readonly TokenVerifier[]) {
  const token = /^Bearer +([^\s,]+)$/i.exec(req.get('Authorization') ?? '')?.[1];
  if (token) {
    try {
      for (const verifier of verifiers) {
        const principal = await verifier.verify(token);
        if (principal?.kind === 'user' && typeof principal.userId === 'string' && principal.userId.length) return principal;
      }
    } catch {
      throw new HttpFailure(503, 'Session.UNAVAILABLE');
    }
  }
  throw new HttpFailure(401, AUTHENTICATION_ERRORS.Unauthenticated);
}

function sendFailure(res: Response, traceId: string, cause: unknown, endpoint: HttpEndpoint) {
  let problem = cause instanceof HttpFailure || cause instanceof DomainError ? cause : internal();
  const envelope = (error: typeof problem) => ({
    code: error.code, error: error.error, traceId,
    ...(error instanceof HttpFailure && error.issues ? { issues: error.issues } : {}),
  });
  if (problem instanceof DomainError && !endpoint.ResponseTypeUnion.safeParse(envelope(problem)).success) problem = internal();
  if (problem.code === 503) res.set('Retry-After', '1');
  res.status(problem.code).json(envelope(problem));
}

/** Compile the fixed route once. Every request receives a fresh chain context. */
export function compileResourceRoute({ endpoint, handle }: BoundRoute, options: PipelineOptions): RequestHandler[] {
  const { roles, membership, bodyLimit = DEFAULT_BODY_LIMIT } = options;
  const verifiers = [...options.verifiers ?? []];
  if (!verifiers.length) throw new ApiDefinitionError(`Endpoint "${endpoint.Name}" requires an authentication verifier.`);
  if (endpoint.Route.scope !== 'tenant' || !endpoint.Route.principals?.includes('user') || !endpoint.TenantHeader || !membership) {
    throw new ApiDefinitionError(`Endpoint "${endpoint.Name}" requires tenant-scoped user authentication, a tenant header and a membership resolver.`);
  }
  if (endpoint.ResourcePolicy?.tenancy !== 'owned' || endpoint.ResourcePolicy.owner !== undefined) {
    throw new ApiDefinitionError(`Endpoint "${endpoint.Name}" requires a tenant-owned resource without a separate owner field.`);
  }
  if (!Number.isSafeInteger(bodyLimit) || bodyLimit < 1) throw new ApiDefinitionError('bodyLimit must be a positive byte count.');
  const access = compileAccess(endpoint, roles);
  const header = endpoint.TenantHeader;
  if (['authorization', 'proxy-authorization', 'cookie', 'set-cookie'].includes(header.toLowerCase())) {
    throw new ApiDefinitionError(`Endpoint "${endpoint.Name}" cannot use credential header "${header}" as its tenant header.`);
  }
  const alias = endpoint.TenantContext;
  if (alias && ['principal', 'membership', 'raw', 'traceId', 'defer', 'em', '__proto__', 'constructor', 'prototype'].includes(alias)) {
    throw new ApiDefinitionError(`Endpoint "${endpoint.Name}" has a reserved tenant context name "${alias}".`);
  }
  const identity = chain.define({
    name: 'authenticate', provides: ['principal'],
    async handle(ctx: RequestContext, next: Next) { return next({ principal: await authenticate(ctx.raw.req, verifiers) }); },
  });
  const tenancy = chain.define({
    name: 'tenant', use: [identity], provides: ['tenant', 'membership'],
    async handle(ctx: RequestContext & Pick<HttpContext, 'principal'>, next: Next) {
      const id = ctx.raw.req.get(header);
      if (!id) throw new HttpFailure(400, 'Tenant.REQUIRED');
      let member: TenantMembership | undefined;
      try {
        member = await membership({ principal: ctx.principal, tenantId: id });
      } catch {
        throw new HttpFailure(503, 'Tenant.UNAVAILABLE');
      }
      if (!member) throw notFound();
      return next({ tenant: { id }, membership: member });
    },
  });
  const authorization = chain.define({
    name: 'access', use: [tenancy],
    handle(ctx: Pick<HttpContext, 'membership'>, next: Next) {
      access.checkFloor(ctx.membership);
      return next();
    },
  });
  const steps = chain.resolve([authorization]);
  // Handler cleanups run inside the storage boundary, before its transaction can commit.
  const handlerSteps = chain.resolve([]);
  const readBody = express.raw({ type: () => true, inflate: false, limit: bodyLimit });
  const decodeBody = hasJsonRequestBody(endpoint.Method) ? jsonBody : emptyBody;
  return [async (req, res) => {
    const traceId = randomUUID();
    try {
      // Read bounded bytes first. JSON decoding and field validation both run behind authentication.
      await new Promise<void>((resolve, reject) => readBody(req, res, error => {
        if (error) reject(new HttpFailure(400, error.type === 'entity.too.large' ? 'Request.BODY_TOO_LARGE' : 'Request.INVALID_BODY'));
        else resolve();
      }));
      const reply = await chain.run({
        chain: steps, base: { raw: { req, res }, traceId },
        async run(context) {
          // These keys are provided by the mandatory identity and tenancy dependencies above.
          const trusted = context as typeof context & Pick<HttpContext, 'tenant' | 'membership' | 'principal'>;
          const request = decodeRequest(endpoint, req, decodeBody(req));
          access.checkFields(trusted.membership, request);
          const invoke = (em?: object) => chain.run({
            chain: handlerSteps, base: { ...trusted, ...(alias && { [alias]: trusted.tenant }), ...(em && { em }) },
            async run(ctx, defer) {
              const data = await handle(request, { ...ctx, defer });
              if (isFailure(data)) throw notFound();
              const status = endpoint.Route.code;
              const envelope = data === undefined ? { code: status } : { code: status, data };
              return { status, body: endpoint.Response.encode(envelope) };
            },
          });
          return options.unitOfWork
            ? options.unitOfWork.run({ tenant: trusted.tenant, write: endpoint.Method !== 'get', handle: invoke })
            : invoke();
        },
      });
      if (res.headersSent || res.destroyed) return;
      res.status(reply.status);
      // An authenticated, no-store read always returns its declared envelope. Express
      // send/json can otherwise turn the GET into an empty 304 based on cache headers.
      if (endpoint.Method === 'get') res.type('application/json').end(JSON.stringify(reply.body));
      else res.json(reply.body);
    } catch (error) {
      if (!res.headersSent && !res.destroyed) sendFailure(res, traceId, error, endpoint);
    }
  }];
}
