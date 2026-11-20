import { randomUUID } from 'node:crypto';
import { createClient, type ResourceClient } from '../client/createClient.js';
import { createApi, type CreateApiOptions } from '../express/createApi.js';
import type { UserPrincipal } from '../express/auth.js';
import { DEFAULT_HOST } from '../runtime/httpListener.js';

export interface CreateTestAppOptions extends Omit<CreateApiOptions, 'host' | 'verifiers' | 'membership'> {
  /** Optional observer for requests. The default client uses real fetch. */
  fetch?: typeof fetch;
}

export interface TestActor {
  /** Default: a new user. */
  user?: string;
  /** Leave unset to exercise requests with no tenant selected. */
  tenant?: string;
  /** Default: the lowest declared role. */
  role?: string;
}

export interface TestApp {
  /** The unauthenticated client for this app. */
  readonly client: ResourceClient;
  as(actor?: TestActor): ResourceClient;
  close(): Promise<void>;
}

/** Starts the production dispatcher on loopback with a private token and membership store. Requires APP_ENV=test. */
export async function createTestApp({ fetch, ...options }: CreateTestAppOptions): Promise<TestApp> {
  const identities = new Map<string, UserPrincipal>();
  const memberships = new Map<string, Map<string, string>>();
  const api = await createApi({
    ...options, host: DEFAULT_HOST,
    verifiers: [{ testOnly: true, verify: token => identities.get(token) }],
    membership: ({ principal, tenantId }) => {
      const role = memberships.get(principal.userId)?.get(tenantId);
      return role === undefined ? undefined : { role };
    },
  });
  try {
    const baseUrl = await api.listen(0);
    return {
      client: createClient({ baseUrl, fetch }),
      as({ user = randomUUID(), tenant, role = options.resources.roles[0] } = {}) {
        if (tenant !== undefined) {
          if (!role || !options.resources.roles.includes(role)) throw new Error('Select a declared tenant role for the test actor.');
          const assignments = memberships.get(user) ?? new Map<string, string>();
          assignments.set(tenant, role);
          memberships.set(user, assignments);
        }
        const accessToken = randomUUID();
        identities.set(accessToken, { kind: 'user', userId: user });
        return createClient({ baseUrl, fetch, tenant: () => tenant, tokens: { get: () => ({ accessToken }) } });
      },
      async close() {
        try { await api.close(); }
        finally { identities.clear(); memberships.clear(); }
      },
    };
  } catch (error) {
    await api.close();
    throw error;
  }
}
