import type { z } from 'zod/v4';
import type { CrudOperation } from '../endpoints/enabledCrudOperations.js';
import { hasJsonRequestBody, type HttpEndpoint } from '../endpoints/httpEndpoint.js';
import { isItemPathValue, pathParameterNames } from '../endpoints/pathParameterNames.js';
import { encodeBracketQuery, type BracketQuery } from '../query/bracketQuery.js';
import type { EndpointScope } from '../tenancy/endpointScope.js';
import { apiVersionHeaders } from './apiVersionHeaders.js';
import { tenantHeaders } from './tenantHeaders.js';

type StoredToken = { readonly accessToken: string } | null | undefined;

/** The read capability of a token store. The client reads the current token for each call. */
export interface AccessTokenSource {
  get(): StoredToken | Promise<StoredToken>;
}

export interface CreateClientOptions {
  /** API root, including any path prefix shared by its endpoints. */
  baseUrl: string | URL;
  /** Instance-owned default headers. Copied when the client is created. */
  headers?: HeadersInit;
  /** Supplies the current tenant ID for a tenant-scoped endpoint. */
  tenant?: () => string | undefined;
  /** Supplies the bearer token. Omitting the store leaves credentials to the caller's headers. */
  tokens?: AccessTokenSource;
  /** Overrides the API version carried by the contract. */
  version?: string;
  /** Defaults to the environment's fetch implementation. */
  fetch?: typeof fetch;
}

/** A generated resource contract with its own wire conversions. */
export interface ClientEndpoint<Input, Reply extends { code: number }> {
  readonly Method: HttpEndpoint['Method'];
  readonly Path: string;
  readonly Route: { readonly scope: EndpointScope; readonly operation?: CrudOperation };
  readonly TenantHeader?: string;
  readonly ApiVersion?: string;
  readonly ResponseTypeUnion: z.ZodType<Reply>;
  toContent(request: Input): {
    params: Readonly<Record<string, string>>;
    query: BracketQuery;
    headers: Readonly<Record<string, string>>;
    body: object;
  };
}

export interface ResourceClient {
  call<Input, Reply extends { code: number }>(
    endpoint: ClientEndpoint<Input, Reply>, request: NoInfer<Input>,
  ): Promise<Reply>;
}

function itemPath(template: string, params: Readonly<Record<string, string>>): string {
  const names = pathParameterNames(template);
  const [name] = names;
  if (names.length !== 1 || !template.endsWith('/:' + name) || Object.keys(params).length !== 1 || !Object.hasOwn(params, name)) {
    throw new TypeError('An item request requires the single path parameter declared by its endpoint.');
  }
  const value = params[name];
  if (!isItemPathValue(value)) {
    throw new TypeError('An item path parameter must identify one nonempty, non-dot segment.');
  }
  return template.slice(0, -(name.length + 1)) + encodeURIComponent(value);
}

/** Calls a generated endpoint with its flat input and returns its decoded success or failure envelope. */
export function createClient({ baseUrl, headers, tenant, tokens, version, fetch: send = globalThis.fetch }: CreateClientOptions): ResourceClient {
  const base = new URL(baseUrl, globalThis.location?.href);
  base.pathname = base.pathname.replace(/\/?$/, '/');
  const defaults = new Headers(headers);

  return {
    async call(endpoint, request) {
      const content = endpoint.toContent(request);
      const hasBody = hasJsonRequestBody(endpoint.Method);
      const list = endpoint.Method === 'get' && endpoint.Route.operation === 'List';
      const collection = endpoint.Method === 'post' || list;
      const path = collection ? endpoint.Path : itemPath(endpoint.Path, content.params);
      const url = new URL(path.slice(1), base);
      if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') ||
          url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
        throw new TypeError('An endpoint must declare a path within the API base URL.');
      }

      if (collection && Object.keys(content.params).length) throw new TypeError(`A collection ${endpoint.Method.toUpperCase()} expects empty path parameters.`);
      if (!hasBody && Object.keys(content.body).length) throw new TypeError(`${endpoint.Method.toUpperCase()} expects an empty body.`);
      if (list) url.search = encodeBracketQuery(content.query);
      else if (Object.keys(content.query).length) throw new TypeError('This resource request expects empty query fields.');
      const requestHeaders = new Headers(defaults);
      for (const [key, value] of Object.entries(content.headers)) requestHeaders.set(key, value);
      if (hasBody) requestHeaders.set('Content-Type', 'application/json');
      const resolvedHeaders = {
        ...apiVersionHeaders({ apiVersion: endpoint.ApiVersion, version }),
        ...(endpoint.Route.scope === 'tenant' && endpoint.TenantHeader !== undefined
          ? tenantHeaders({ header: endpoint.TenantHeader, tenant }) : {}),
      };
      for (const [key, value] of Object.entries(resolvedHeaders)) requestHeaders.set(key, value);
      const token = await tokens?.get();
      if (token) requestHeaders.set('Authorization', `Bearer ${token.accessToken}`);

      const response = await send(url, {
        method: endpoint.Method.toUpperCase(),
        headers: requestHeaders,
        ...(hasBody && { body: JSON.stringify(content.body) }),
        credentials: 'omit',
      });
      const reply = endpoint.ResponseTypeUnion.parse(await response.json());
      if (reply.code !== response.status) {
        throw new TypeError(`Endpoint response status ${response.status} does not match envelope code ${reply.code}.`);
      }
      return reply;
    },
  };
}
