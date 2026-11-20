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
