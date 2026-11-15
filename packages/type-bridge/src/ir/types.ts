/**
 * The language-neutral type model every conversion passes through.
 *
 * Python and TypeScript sources are each lowered to a {@link TypeModule}; the emitters print a module in either
 * language. The model is deliberately a little richer than either language, so that distinctions one language makes
 * and the other does not (Python's `int` vs `float`, TypeScript's `null` vs `undefined`, a missing key vs a `None`
 * value) survive the trip and each emitter decides how to express them.
 */

/** 1-based position in the source text. */
export interface SourceLocation {
  line: number;
  column: number;
}

export type SourceLanguage = 'python' | 'typescript';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Primitive types.
 *
 * - `number` is TypeScript's `number`, which says nothing about integrality. Python's `int` and `float` stay distinct.
 * - `none` is Python's `None`. `null` and `undefined` are TypeScript's two empty values; `void` is a return type.
 * - `unknown` is the safe top type (TypeScript `unknown`, Python `object`); `any` opts out of checking in both.
 * - `object` is TypeScript's non-primitive `object` type.
 */
export type PrimitiveName =
  | 'string'
  | 'int'
  | 'float'
  | 'number'
  | 'complex'
  | 'boolean'
  | 'bigint'
  | 'bytes'
  | 'none'
  | 'null'
  | 'undefined'
  | 'void'
  | 'any'
  | 'unknown'
  | 'never'
  | 'object'
  | 'symbol';

export interface PrimitiveType {
  kind: 'primitive';
  name: PrimitiveName;
}

export type LiteralValue = string | number | boolean | bigint;

export interface LiteralType {
  kind: 'literal';
  value: LiteralValue;
  /** True for a number literal written with a fraction or exponent (`1.5`, `1e3`). Python's `Literal` rejects them. */
  float?: boolean;
}

/** A TypeScript template literal type. `parts` alternate text and types: `` `id-${number}` ``. */
export interface TemplateLiteralType {
  kind: 'template';
  parts: (string | TypeNode)[];
}

/** `T[]` / `list[T]`. `readonly` is `readonly T[]` / `Sequence[T]`. */
export interface ArrayType {
  kind: 'array';
  element: TypeNode;
  readonly: boolean;
}

export interface TupleElement {
  type: TypeNode;
  /** TypeScript labeled tuple member name (`[x: number]`), or a NamedTuple field. */
  name?: string;
  /** `[string, number?]`. */
  optional?: boolean;
  /**
   * `repeat`: zero or more of `type` (`...number[]`, `tuple[int, ...]`).
   * `spread`: the elements of a tuple-typed `type` (`...T`, `*Ts`, `*tuple[int, str]`).
   */
  rest?: 'repeat' | 'spread';
}

export interface TupleType {
  kind: 'tuple';
  elements: TupleElement[];
  readonly: boolean;
}

/** `Set<T>` / `set[T]`. `readonly` is `ReadonlySet<T>` / `frozenset[T]` / `AbstractSet[T]`. */
export interface SetType {
  kind: 'set';
  element: TypeNode;
  readonly: boolean;
}

/** A plain-object dictionary: `Record<K, V>`, `{ [key: string]: V }`, `dict[K, V]`. */
export interface RecordType {
  kind: 'record';
  key: TypeNode;
  value: TypeNode;
  readonly: boolean;
}

/** A JavaScript `Map` (or `WeakMap` when `weak`). Python has only `dict`. */
export interface MapType {
  kind: 'map';
  key: TypeNode;
  value: TypeNode;
  readonly: boolean;
  weak?: boolean;
}

/**
 * A reference to a named type.
 *
 * `target` says what the name resolves to: a declaration in this module, a type parameter in scope, an imported
 * name, or nothing the converter knows (`unresolved`), which is emitted as written.
 */
export interface ReferenceType {
  kind: 'reference';
  name: string;
  args: TypeNode[];
  target: 'declaration' | 'type-param' | 'import' | 'unresolved';
}

/**
 * Library types with a counterpart in both languages, or one the emitter must choose a representation for.
 *
 * Argument order follows Python: `generator` is `[yield, send, return]` and `async-generator` is `[yield, send]`.
 */
export type WellKnownName =
  | 'datetime'
  | 'date'
  | 'time'
  | 'timedelta'
  | 'uuid'
  | 'decimal'
  | 'path'
  | 'url'
  | 'email'
  | 'ip-address'
  | 'secret'
  | 'regex'
  | 'error'
  | 'iterable'
  | 'iterator'
  | 'async-iterable'
  | 'async-iterator'
  | 'generator'
  | 'async-generator'
  | 'awaitable';

export interface WellKnownType {
  kind: 'well-known';
  name: WellKnownName;
  args: TypeNode[];
}

export interface UnionType {
  kind: 'union';
  members: TypeNode[];
}

export interface IntersectionType {
  kind: 'intersection';
  members: TypeNode[];
}

export type ParameterKind = 'positional' | 'positional-only' | 'keyword-only' | 'var-positional' | 'var-keyword';

export interface Parameter {
  name: string;
  type: TypeNode;
  /** May be omitted by the caller: `x?: T` or a Python parameter with a default. */
  optional: boolean;
  kind: ParameterKind;
  /** Source text of a Python default value, kept for stubs and docs. */
  defaultText?: string;
  /** `**kwargs: Unpack[TD]`: the keyword arguments are the keys of a TypedDict. */
  unpacked?: boolean;
}

export interface FunctionType {
  kind: 'function';
  params: Parameter[];
  returns: TypeNode;
  typeParams: TypeParam[];
  /** `Callable[..., R]`: any arguments. */
  anyParams?: boolean;
  /** `Callable[P, R]` or `Callable[Concatenate[A, P], R]`: the parameters of a ParamSpec follow `params`. */
  paramSpec?: string;
  /** A `new (...) => T` construct signature. */
  construct?: boolean;
  /** An `async def` (Python) method: the declared return is wrapped in an awaitable. */
  async?: boolean;
}

/** An anonymous object type: a TypeScript type literal. Python has no counterpart, so it is hoisted to a class. */
export interface ObjectType {
  kind: 'object';
  members: Member[];
  indexSignatures: IndexSignature[];
  callSignatures: FunctionType[];
  /** A name to use if this type must be declared, e.g. `PartialUser` for an evaluated `Partial<User>`. */
  nameHint?: string;
}

/** A single enum member as a type: `Color.Red`, `Literal[Color.RED]`. */
export interface EnumMemberType {
  kind: 'enum-member';
  enumName: string;
  member: string;
}

/** The class object rather than an instance: `type[T]` / `typeof T` / `new (...args) => T`. */
export interface ClassOfType {
  kind: 'class-of';
  type: TypeNode;
}

/** `Self` / `this`. */
export interface SelfType {
  kind: 'self';
}

/**
 * Source syntax the model cannot represent (a conditional type, a generic mapped type, ...). It prints verbatim in
 * its own language and degrades to `Any` in the other. A diagnostic was recorded when it was created.
 */
export interface OpaqueType {
  kind: 'opaque';
  text: string;
  language: SourceLanguage;
}

/** Text in the *target* language from a `typeMap` override, printed verbatim. */
export interface RawType {
  kind: 'raw';
  text: string;
  /** Import lines the text needs, e.g. `from bson import ObjectId` or `import type { ObjectId } from 'bson'`. */
  imports: string[];
}

export type TypeNode =
  | PrimitiveType
  | LiteralType
  | TemplateLiteralType
  | ArrayType
  | TupleType
  | SetType
  | RecordType
  | MapType
  | ReferenceType
  | WellKnownType
  | UnionType
  | IntersectionType
  | FunctionType
  | ObjectType
  | EnumMemberType
  | ClassOfType
  | SelfType
  | OpaqueType
  | RawType;

export type TypeKind = TypeNode['kind'];

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export interface DocTag {
  name: string;
  text: string;
}

/** Documentation carried between JSDoc and docstrings. */
export interface Doc {
  /** Free text, already dedented, without comment markers. */
  text: string;
  /** Present when deprecated; the message may be empty. */
  deprecated?: string;
  /** Other JSDoc tags (`@example`, `@see`, ...), kept in order. */
  tags: DocTag[];
}

export type DefaultValue =
  | { kind: 'literal'; value: string | number | boolean | null; text: string }
  /** Any other expression, in its source language. */
  | { kind: 'expression'; text: string; language: SourceLanguage }
  /** A value built per instance: `field(default_factory=list)`, `Field(default_factory=dict)`. */
  | { kind: 'factory'; text: string };

export interface PropertyMember {
  kind: 'property';
  name: string;
  type: TypeNode;
  /** The key may be absent: `x?: T`, `NotRequired[T]`, a `total=False` TypedDict key. Not the same as nullable. */
  optional: boolean;
  readonly: boolean;
  /** A class-level attribute: TypeScript `static`, Python `ClassVar`. Not part of an instance's shape. */
  static?: boolean;
  doc?: Doc;
  /** Python has a default for this attribute, so a constructor may omit it while instances always have it. */
  default?: DefaultValue;
  /** The name used on the wire when it differs from `name`: pydantic `Field(alias=...)`, an alias generator. */
  alias?: string;
  /** Not part of the serialized form: pydantic `Field(exclude=True)`, a plain `@property`. */
  excludeFromJson?: boolean;
  loc?: SourceLocation;
}

export interface MethodMember {
  kind: 'method';
  name: string;
  /** More than one signature means overloads. */
  signatures: FunctionType[];
  optional: boolean;
  static?: boolean;
  doc?: Doc;
  loc?: SourceLocation;
}

export type Member = PropertyMember | MethodMember;

export interface IndexSignature {
  key: TypeNode;
  value: TypeNode;
  readonly: boolean;
}

// ---------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------

export type Variance = 'invariant' | 'covariant' | 'contravariant' | 'inferred';

export interface TypeParam {
  name: string;
  /** `TypeVar`, `ParamSpec` or `TypeVarTuple`. TypeScript only has the first; a tuple-constrained `T extends unknown[]` is the closest to the last. */
  kind: 'type' | 'param-spec' | 'type-var-tuple';
  /** Upper bound: `T extends B`, `TypeVar("T", bound=B)`. */
  bound?: TypeNode;
  /** Python value-constrained TypeVar: `TypeVar("T", int, str)`. TypeScript can only approximate it with a union bound. */
  constraints?: TypeNode[];
  default?: TypeNode;
  variance: Variance;
  /** TypeScript `const T`. */
  const?: boolean;
}

/** Which construct an object declaration came from, or should become. */
export type ObjectFlavor =
  | 'interface'
  | 'type-literal'
  | 'class'
  | 'typeddict'
  | 'dataclass'
  | 'pydantic'
  | 'attrs'
  | 'msgspec'
  | 'namedtuple'
  | 'protocol'
  | 'plain-class';

interface DeclarationBase {
  name: string;
  typeParams: TypeParam[];
  doc?: Doc;
  /** TypeScript `export`; a Python name without a leading underscore, or one listed in `__all__`. */
  exported: boolean;
  loc?: SourceLocation;
}

export interface ObjectDeclaration extends DeclarationBase {
  kind: 'object';
  flavor: ObjectFlavor;
  /** `extends` / base classes, as references (possibly with type arguments). */
  bases: TypeNode[];
  members: Member[];
  indexSignatures: IndexSignature[];
  callSignatures: FunctionType[];
  /** TypedDict `total=`. Default true. */
  total?: boolean;
  /** Every field is read-only: a frozen dataclass or model, a NamedTuple. */
  frozen?: boolean;
  /** Keys not declared are an error (PEP 728 `closed=True`, pydantic `extra="forbid"`). */
  closed?: boolean;
  /** TypedDict `extra_items=`, pydantic `extra="allow"`. */
  extraItems?: TypeNode;
  abstract?: boolean;
}

export interface AliasDeclaration extends DeclarationBase {
  kind: 'alias';
  type: TypeNode;
}

export interface EnumMember {
  name: string;
  value: string | number | boolean | null;
  doc?: Doc;
  loc?: SourceLocation;
}

/**
 * - `string` / `number`: every value is of that type (TypeScript string or numeric enum; StrEnum / IntEnum).
 * - `flag`: an `enum.Flag` / `IntFlag`, or a numeric TypeScript enum of bit masks.
 * - `mixed`: anything else.
 */
export type EnumFlavor = 'string' | 'number' | 'flag' | 'mixed';

export interface EnumDeclaration extends DeclarationBase {
  kind: 'enum';
  flavor: EnumFlavor;
  members: EnumMember[];
  /** TypeScript `const enum`. */
  const?: boolean;
}

/** A distinct named type over another: Python `NewType`, a TypeScript branded type. */
export interface NewTypeDeclaration extends DeclarationBase {
  kind: 'newtype';
  type: TypeNode;
}

export type Declaration = ObjectDeclaration | AliasDeclaration | EnumDeclaration | NewTypeDeclaration;

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

/**
 * A module specifier both languages can express. `level` 0 is absolute (`pkg.sub`, `'pkg/sub'`); 1 is the current
 * package (`.sub`, `'./sub'`); 2 its parent (`..sub`, `'../sub'`), and so on.
 */
export interface ModuleSpecifier {
  level: number;
  segments: string[];
}

export interface ImportedName {
  name: string;
  /** Local name when imported `as` something else. */
  alias?: string;
}

/** An import of user types from another module (library imports such as `typing` are resolved, not recorded). */
export interface ModuleImport {
  module: ModuleSpecifier;
  names: ImportedName[];
  loc?: SourceLocation;
}

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: DiagnosticCode;
  message: string;
  loc?: SourceLocation;
  /** Dotted path of the declaration or member involved: `User.address`. */
  path?: string;
}

/**
 * Every diagnostic code. `warning` codes mean the output is less precise than the input; `info` codes record a
 * deliberate, documented choice.
 */
export type DiagnosticCode =
  /** The target language has no counterpart; a looser type was emitted. */
  | 'unsupported-type'
  /** The type was converted, but something the source said is lost (an `int`, a template pattern, ...). */
  | 'lossy-conversion'
  /** A name the converter does not know; it is emitted as written. */
  | 'unresolved-reference'
  /** A name is not a valid identifier in the target language and was renamed. */
  | 'renamed-identifier'
  /** A construct the converter recognizes but does not convert. */
  | 'unsupported-syntax'
  /** A statement with no type meaning (a function body, an expression) was skipped. */
  | 'skipped-statement'
  /** An anonymous type was given a name so the target language can express it. */
  | 'synthesized-declaration'
  /** A structural rewrite to satisfy a target-language rule (field order, functional TypedDict syntax, ...). */
  | 'restructured'
  /** The source is valid but questionable (a duplicate name, a non-literal enum value, ...). */
  | 'suspicious-source';

export interface TypeModule {
  language: SourceLanguage;
  declarations: Declaration[];
  imports: ModuleImport[];
  diagnostics: Diagnostic[];
}
