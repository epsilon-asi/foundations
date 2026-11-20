import type { z } from 'zod/v4';
import type { CrudRouteMetadata, CrudRouteMetadataOptions } from './crudRouteMetadata.js';

/** The parts of a generated contract the HTTP adapter consumes. */
export interface HttpEndpoint {
  readonly Name: string;
  readonly Method: 'post' | 'get' | 'patch' | 'delete';
  readonly Path: string;
  readonly Access: string | object;
  readonly FieldAccess?: object;
  /** Identity of the declaring resource model, scoped to its resource system. */
  readonly Resource?: object;
  /** Row ownership from the resource declaration, independent of the endpoint's scope. */
  readonly ResourcePolicy: Readonly<Pick<CrudRouteMetadataOptions, 'tenancy' | 'owner'>>;
  readonly Route: Pick<CrudRouteMetadata, 'name' | 'method' | 'path' | 'scope' | 'code' | 'principals' | 'paramFields'>
    & Partial<Pick<CrudRouteMetadata, 'operation'>>;
  readonly TenantHeader?: string;
  readonly TenantContext?: string;
  readonly Request: z.ZodType;
  readonly RequestContent: z.ZodType<{ body: unknown }>;
  fromContent(content: unknown): unknown;
  readonly ResponseData: z.ZodType | undefined;
  readonly Response: z.ZodType;
  readonly ResponseTypeUnion: z.ZodType;
}

/** The CRUD operations whose wire body is sent as JSON. */
export function hasJsonRequestBody(method: HttpEndpoint['Method']): boolean {
  return method === 'post' || method === 'patch';
}
