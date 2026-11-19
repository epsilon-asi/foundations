import { toCamelCase } from '@epsilon-asi/foundation';

export interface TenantNamesOptions {
  /** Singular PascalCase name declared by the tenant resource. */
  resource: string;
  /** Tenant ID header. Defaults to X-<Resource>-Id. */
  header?: string;
  /** Tenant property on the request context. Defaults to the camelCase resource name. */
  context?: string;
  /** Tenant ID field on owned resources. Defaults to the camelCase resource name followed by Id. */
  field?: string;
}

/** Resolves the names shared by tenant-aware clients, request contexts and resource models. */
export function tenantNames({ resource, header, context, field }: TenantNamesOptions) {
  const name = toCamelCase(resource);
  return {
    header: header ?? `X-${resource}-Id`,
    context: context ?? name,
    field: field ?? `${name}Id`,
  };
}
