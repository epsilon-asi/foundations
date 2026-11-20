export const DEFAULT_ENDPOINT_DOCS = true;

interface ResolveEndpointDocsOptions {
  name: string;
  settings?: { readonly docs?: boolean };
  fallback?: boolean;
}

/** Resolves OpenAPI visibility from the endpoint's own declaration. */
export function resolveEndpointDocs({ name, settings, fallback = DEFAULT_ENDPOINT_DOCS }: ResolveEndpointDocsOptions): boolean {
  const docs = settings && Object.hasOwn(settings, 'docs') ? settings.docs : undefined;
  if (docs !== undefined && typeof docs !== 'boolean') {
    throw new TypeError(`The docs option on "${name}" must be a boolean.`);
  }
  return docs ?? fallback;
}
