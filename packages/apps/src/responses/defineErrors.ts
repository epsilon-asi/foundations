import { toPascalCase } from '@epsilon-asi/foundation';
import { ApiDefinitionError } from '../endpoints/ApiDefinitionError.js';
import { isFailureStatus, type FailureStatus } from './failureStatus.js';

type WireError = `${string}.${string}`;

export interface DomainErrorDefinitions {
  readonly [type: string]: { readonly code: FailureStatus };
}

/** A declared failure that HTTP adapters and workers can recognize with instanceof. */
export abstract class DomainError extends Error {
  protected constructor(readonly error: WireError, readonly code: FailureStatus) {
    super(error);
    this.name = new.target.name;
  }

  /** The worker discriminator, shared with the wire error and the domain's Types table. */
  get type(): WireError { return this.error; }
}

type Title<Word extends string> = Capitalize<Word extends Uppercase<Word> ? Lowercase<Word> : Word>;
type ClassName<Key extends string> = Key extends `${infer Head}_${infer Tail}`
  ? `${Title<Head>}${ClassName<Tail>}` : Title<Key>;

type ErrorClass<Name extends WireError, Code extends FailureStatus> = new () => DomainError & {
  readonly error: Name;
  readonly type: Name;
  readonly code: Code;
};

/** The named constructors and wire identifiers generated from one domain declaration. */
export type DefinedErrors<Domain extends string, Definitions extends DomainErrorDefinitions> = {
  readonly Types: { readonly [K in keyof Definitions & string]: `${Domain}.${K}` };
} & {
  readonly [K in keyof Definitions & string as ClassName<K>]: ErrorClass<`${Domain}.${K}`, Definitions[K]['code']>;
};

/** The union of the throwable instances in a defined error domain. */
export type DomainErrorsOf<Domain> = InstanceType<Extract<Domain[keyof Domain], new () => DomainError>>;

const identifier = /^[\p{L}][\p{L}\p{N}]*(?:_[\p{L}\p{N}]+)*$/u;

function classNameFor(type: string): string {
  return type.split('_').map(word => word === word.toUpperCase()
    ? toPascalCase(word.toLowerCase())
    : word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

/** Declares a domain's Error classes, their namespaced wire identifiers and their HTTP statuses. */
export function defineErrors<const Domain extends string, const Definitions extends DomainErrorDefinitions>(
  domain: Domain, definitions: Definitions,
): DefinedErrors<Domain, Definitions> {
  if (typeof domain !== 'string' || !identifier.test(domain)) {
    throw new ApiDefinitionError(`Invalid error domain "${String(domain)}". Expected a single identifier.`);
  }
  if (Object.prototype.toString.call(definitions) !== '[object Object]') {
    throw new ApiDefinitionError(`Error definitions for ${domain} must be an object.`);
  }
  const types: Record<string, WireError> = Object.create(null);
  const constructors: Record<string, new () => DomainError> = Object.create(null);
  for (const type of Reflect.ownKeys(definitions)) {
    if (typeof type !== 'string' || !identifier.test(type)) {
      throw new ApiDefinitionError(`Invalid error type "${String(type)}" in ${domain}.`);
    }
    const className = classNameFor(type);
    if (className === 'Types' || Object.hasOwn(constructors, className)) {
      throw new ApiDefinitionError(`Error ${domain}.${type} conflicts with the existing "${className}" member.`);
    }
    const code = definitions[type]?.code;
    if (!isFailureStatus(code)) {
      throw new ApiDefinitionError(`Error ${domain}.${type} requires a supported failure status, received "${String(code)}".`);
    }
    const wire: WireError = `${domain}.${type}`;
    types[type] = wire;
    const ErrorClass = class extends DomainError {
      constructor() { super(wire, code); }
    };
    Object.defineProperty(ErrorClass, 'name', { value: className });
    constructors[className] = ErrorClass;
  }
  return Object.freeze({ ...constructors, Types: Object.freeze(types) }) as DefinedErrors<Domain, Definitions>;
}
