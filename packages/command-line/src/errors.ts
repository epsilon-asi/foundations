/** A mistake in how a command class is declared. Thrown when the tree is described or built, never at parse time. */
export class CliDefinitionError extends Error {
  public readonly className: string;

  public constructor(target: Function, message: string) {
    const className = target.name === '' ? '<anonymous class>' : target.name;
    super(`${className}: ${message}`);
    this.name = 'CliDefinitionError';
    this.className = className;
  }
}

/**
 * A middleware that is defined or used wrongly: calling `next()` twice, not
 * awaiting it, providing a value someone else already provides, and so on.
 */
export class MiddlewareError extends Error {
  public readonly middlewareName: string;

  public constructor(middlewareName: string, message: string, options?: ErrorOptions) {
    super(`middleware "${middlewareName}" ${message}`, options);
    this.name = 'MiddlewareError';
    this.middlewareName = middlewareName;
  }
}
