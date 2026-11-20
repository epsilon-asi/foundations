/** Tenant selected by the authenticated binding, before opening a unit of work. */
export interface TenantScope {
  readonly tenant: { readonly id: string };
}

export interface UnitOfWorkOptions<Result, Manager extends object> extends TenantScope {
  readonly write: boolean;
  readonly handle: (em: Manager) => Promise<Result>;
}

/** Run a request with isolated storage state. A successful write resolves after commit. */
export interface UnitOfWork<Manager extends object = object> {
  run<Result>(options: UnitOfWorkOptions<Result, Manager>): Promise<Result>;
}
