export { createDecoratorRegistry, DecoratorModeError } from './decoratorRegistry.js';
export { ensureSymbolMetadata, symbolMetadata } from './symbolMetadata.js';
export * from "./types.js";

export type {
  AccessorDecoratorDefinition,
  AnyFunction,
  ClassDecoratorDefinition,
  Constructor,
  CreateDecoratorRegistryOptions,
  DecorationKind,
  DecorationRecord,
  DecoratorRegistry,
  DecoratorSchema,
  MethodDecoratorDefinition,
  MetadataOf,
  PropertyDecoratorDefinition,
  RegistryMetadataSnapshot,
  RegistryReadOptions,
  ScopedDecoratorBuilder,
  TargetOf,
} from './types.js';
