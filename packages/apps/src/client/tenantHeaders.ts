export interface TenantHeadersOptions {
  /** Tenant header name resolved by the contract. */
  header: string;
  /** Supplies the current tenant ID for this request. Omit to send no tenant header. */
  tenant?: () => string | undefined;
}

/** Resolves the tenant header for one client request. */
export function tenantHeaders({ header, tenant }: TenantHeadersOptions): Record<string, string> {
  const id = tenant?.();
  return id === undefined ? {} : { [header]: id };
}
