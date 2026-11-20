const reservedNames = new Set(['bulk', 'restore']);

/** Checks a single literal resource or transition segment before composing a route. */
export function isStaticPathSegment(segment: string): boolean {
  return /^[\p{L}\p{M}\p{N}]+(?:-[\p{L}\p{M}\p{N}]+)*$/u.test(segment);
}

// Express matches static paths case-insensitively by default.
function isReservedRouteName(name: string): boolean {
  return reservedNames.has(name.toLowerCase());
}

export interface RouteNamesOptions {
  /** Declared route path, which can include parameter segments such as :offeringId. */
  path?: string;
  /** Declared state transition verb. */
  verb?: string;
}

/** Rejects route declarations that claim a reserved path segment or transition verb. */
export function assertRouteNamesAvailable({ path, verb }: RouteNamesOptions): void {
  const reservedSegment = path?.split('/').find(isReservedRouteName);
  if (reservedSegment !== undefined) {
    throw new TypeError(`Route "${path}" uses the reserved path segment "${reservedSegment}".`);
  }
  if (verb !== undefined && isReservedRouteName(verb)) {
    throw new TypeError(`Transition verb "${verb}" is reserved.`);
  }
}

/** Appends one declared transition verb to a resource's validated item path. */
export function appendTransitionVerb({ path, verb }: Required<RouteNamesOptions>): string {
  if (!isStaticPathSegment(verb)) {
    throw new TypeError(`Transition verb "${verb}" must be a single static path segment.`);
  }
  assertRouteNamesAvailable({ verb });
  return `${path}/${verb}`;
}
