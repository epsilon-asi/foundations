type SymbolConstructorWithMetadata = SymbolConstructor & {
  metadata?: symbol;
};

export function ensureSymbolMetadata(): symbol {
  const symbolConstructor = Symbol as SymbolConstructorWithMetadata;

  if (symbolConstructor.metadata === undefined) {
    Object.defineProperty(symbolConstructor, 'metadata', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Symbol('Symbol.metadata'),
    });
  }

  return symbolConstructor.metadata;
}

export const symbolMetadata = ensureSymbolMetadata();
