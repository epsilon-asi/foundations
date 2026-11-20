/** A verified user identity. Its current tenant role comes from the membership resolver. */
export interface UserPrincipal {
  readonly kind: 'user';
  readonly userId: string;
}

export interface TokenVerifier {
  /** A test verifier may only be registered by an application running in the test environment. */
  readonly testOnly?: true;
  /** Return undefined for an unrecognized or invalid token. Throw if verification is unavailable. */
  verify(token: string): UserPrincipal | undefined | Promise<UserPrincipal | undefined>;
}

export interface TenantMembership {
  readonly role: string;
}

export interface MembershipLookup {
  readonly principal: UserPrincipal;
  readonly tenantId: string;
}

/** Look up a live membership for this exact user and tenant on each request. */
export type MembershipResolver = (lookup: MembershipLookup) =>
  TenantMembership | undefined | Promise<TenantMembership | undefined>;
