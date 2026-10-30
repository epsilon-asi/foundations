export interface TypeRegistryErrorDetails {
  typeName?: string;
  field?: string;
  extension?: string;
  cause?: unknown;
}

export class TypeRegistryError extends Error {
  public readonly typeName?: string;
  public readonly field?: string;
  public readonly extension?: string;

  public constructor(message: string, details: TypeRegistryErrorDetails = {}) {
    super(message, details.cause !== undefined ? { cause: details.cause } : undefined);
    this.name = 'TypeRegistryError';
    this.typeName = details.typeName;
    this.field = details.field;
    this.extension = details.extension;
  }
}
