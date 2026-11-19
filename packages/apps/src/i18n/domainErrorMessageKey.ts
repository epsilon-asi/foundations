/** Returns the catalog key for a namespaced domain error from a response. */
export function domainErrorMessageKey<WireError extends `${string}.${string}`>(wireError: WireError): `errors.${WireError}` {
  return `errors.${wireError}`;
}
