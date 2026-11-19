const reservedNames = new Set(['bulk', 'restore']);

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
