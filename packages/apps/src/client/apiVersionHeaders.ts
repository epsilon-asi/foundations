import { apiVersionSchema } from '../model/apiVersion.js';

export interface ApiVersionHeadersOptions {
  /** API version declared by the contract. Defaults to unversioned. */
  apiVersion?: string;
  /** Client version override. Defaults to the contract's API version. */
  version?: string;
}

/** Resolves the version header for a client request. */
export function apiVersionHeaders({ apiVersion, version = apiVersion }: ApiVersionHeadersOptions = {}): {
  'X-Api-Version'?: string;
} {
  const selected = apiVersionSchema.parse(version);
  return selected === undefined ? {} : { 'X-Api-Version': selected };
}
