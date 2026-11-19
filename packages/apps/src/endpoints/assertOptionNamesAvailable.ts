const reservedOptionNames = ['softDelete', 'versioned', 'deprecated', 'suspended', 'impersonation'];

/** Rejects reserved options declared directly on a resource or endpoint. */
export function assertOptionNamesAvailable(options: object): void {
  for (const name of reservedOptionNames) {
    if (Object.hasOwn(options, name)) {
      throw new TypeError(`Declaration option "${name}" is reserved.`);
    }
  }
}
