# @epsilon-asi/type-bridge

Convert Python type declarations to TypeScript, and TypeScript type declarations to Python.

The two type systems disagree in many small ways: a missing key is not a `None` value, `int` is not `float`,
TypedDicts are structural and dataclasses are not, forward references must sometimes be quoted, and a type checker
accepts things the interpreter rejects. This package maps each of those differences deliberately, picks the
construct the target language actually has for it, and reports every place where something could not be
carried across.

```ts
import { pythonToTypeScript, typeScriptToPython } from '@epsilon-asi/type-bridge';

const { code, diagnostics } = pythonToTypeScript(pythonSource);
const { code } = typeScriptToPython(typescriptSource, { objectStyle: 'pydantic' });
```

- Zero configuration for the common case; every default is exported by name.
- Python output targets 3.11 and newer, using each newer feature only where the target supports it.
- TypeScript is read with the TypeScript compiler, so utility, mapped, conditional, `keyof` and `typeof` types are
  resolved by the real type checker.
- Python is read by a purpose-built parser that understands typing, dataclasses, pydantic v2 (and v1 config),
  attrs, msgspec, enums, NamedTuple, Protocol and PEP 695 syntax, and skips code with no type meaning.
- Generated TypeScript is tested against `tsc --strict --exactOptionalPropertyTypes`; generated Python against
  `pyright --strict` and by executing it on real interpreters.

## Install

```sh
npm install @epsilon-asi/type-bridge typescript
```

`typescript` (5.x or 6.x) is a peer dependency: reading TypeScript uses its compiler API. TypeScript 7 has no
JavaScript API, so it cannot be used for this. ESM only; Node.js 20.19 or later.

## API

| Function                                          | Does                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `pythonToTypeScript(source, options?)`            | Python source → `{ code, diagnostics, module }`                                             |
| `typeScriptToPython(source, options?)`            | TypeScript source → `{ code, diagnostics, module }`                                         |
| `createConverter({ python?, typescript? })`       | Binds options shared by many calls; per-call options merge over them (including `typeMap`). |
| `parsePython(source)` / `parseTypeScript(source)` | Source → the language-neutral `TypeModule`                                                  |
| `emitTypeScript(module)` / `emitPython(module)`   | `TypeModule` → code, for custom pipelines                                                   |
| `formatDiagnostic(diagnostic)`                    | `warning[unsupported-type] User.tags (3:5): ...`                                            |

Invalid source throws a `ParseError` with `language`, `loc` and a code `frame`. With `strict: true`, any warning
throws a `ConversionError` listing them.

```ts
const convert = createConverter({ python: { objectStyle: 'pydantic', pythonVersion: '3.11' } });
convert.typeScriptToPython(source);
convert.typeScriptToPython(other, { objectStyle: 'dataclass' }); // only what differs
```

### Options both directions share

| Option           | Default          | Meaning                                                                                                                                                                                                                             |
| ---------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typeMap`        | none             | Replace a source type with target text: `{ 'bson.ObjectId': { type: 'string' } }` or with imports: `{ ObjectId: { type: 'ObjectId', imports: ['from bson import ObjectId'] } }`. Keys match the written name or its qualified name. |
| `propertyCase`   | `'preserve'`     | `'camelCase'`, `'snake_case'`, `'PascalCase'` or a function. Pydantic output keeps the wire name as `Field(alias=...)`.                                                                                                             |
| `header`         | `DEFAULT_HEADER` | Comment at the top, or `false`.                                                                                                                                                                                                     |
| `strict`         | `false`          | Throw `ConversionError` on warnings.                                                                                                                                                                                                |
| `includePrivate` | `false`          | Keep `_underscored` members of protocols and plain classes.                                                                                                                                                                         |

### Python → TypeScript options

| Option                            | Default                   | Meaning                                                                                                                                                                                                                                                                                           |
| --------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`                            | `'json'`                  | `'json'` describes what a value serializes to (pydantic, FastAPI, `json.dumps`): `datetime` and `UUID` are strings, sets are arrays, only serialized properties appear. `'runtime'` uses the nearest native JavaScript types: `Date`, `Set`, `Map` for non-string keys, `Uint8Array`, `Iterable`. |
| `enumStyle`                       | `'union'`                 | `'union'` (`'red' \| 'green'`, type-only and valid under `erasableSyntaxOnly`), `'enum'`, `'const-enum'`, or `'object'` (an `as const` object plus a type).                                                                                                                                       |
| `objectStyle`                     | `'interface'`             | `'interface'` or `'type'`.                                                                                                                                                                                                                                                                        |
| `int`                             | `'number'`                | `'bigint'` for arbitrary-precision ints.                                                                                                                                                                                                                                                          |
| `none`                            | `'null'`                  | What `None` becomes; JSON has `null`.                                                                                                                                                                                                                                                             |
| `useAliases`                      | `true`                    | Use pydantic serialization aliases and alias generators as property names, as FastAPI does.                                                                                                                                                                                                       |
| `defaultedFields`                 | `'required'`              | A field with a default is always present on instances. `'optional'` models input, where it may be omitted.                                                                                                                                                                                        |
| `quote` / `semicolons` / `indent` | `'single'` / `true` / `2` | Formatting.                                                                                                                                                                                                                                                                                       |
| `importExtension`                 | `'.js'`                   | Extension on relative imports; `.js` resolves under both NodeNext and bundlers.                                                                                                                                                                                                                   |

### TypeScript → Python options

| Option          | Default                                              | Meaning                                                                                                                                                                                                |
| --------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pythonVersion` | `'3.12'`                                             | `'3.11'` through `'3.14'`. See [Python versions](#python-versions).                                                                                                                                    |
| `objectStyle`   | `'typeddict'`                                        | What interfaces become: `'typeddict'` (structural, over dicts: the faithful match for JSON shapes), `'dataclass'`, `'pydantic'` (v2) or `'protocol'`. Interfaces with methods always become protocols. |
| `classStyle`    | `'dataclass'`, or `'pydantic'` when `objectStyle` is | What TypeScript classes become.                                                                                                                                                                        |
| `number`        | `'float'`                                            | `number` as `float` (PEP 484 accepts an `int` for it), `'int'` or `'int \| float'`.                                                                                                                    |
| `enumStyle`     | `'enum'`                                             | `'enum'` or `'literal'` (a `Literal[...]` alias).                                                                                                                                                      |
| `hoist`         | `true`                                               | Name anonymous object and callable types so they can be classes and protocols.                                                                                                                         |
| `dunderAll`     | when needed                                          | Emit `__all__`; by default only when some declarations are not exported.                                                                                                                               |

## How types map

### Python → TypeScript

| Python                                                             | TypeScript (`json`)                                              | TypeScript (`runtime`)                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------- |
| `str`, `int`, `float`, `bool`, `None`                              | `string`, `number`, `number`, `boolean`, `null`                  | same                                           |
| `bytes`                                                            | `string`                                                         | `Uint8Array`                                   |
| `object` / `Any`                                                   | `unknown` / `any`                                                | same                                           |
| `list[T]` / `Sequence[T]`                                          | `T[]` / `readonly T[]`                                           | same                                           |
| `tuple[A, B]` / `tuple[T, ...]`                                    | `readonly [A, B]` / `readonly T[]`                               | same                                           |
| `set[T]` / `frozenset[T]`                                          | `T[]` / `readonly T[]`                                           | `Set<T>` / `ReadonlySet<T>`                    |
| `dict[str, V]` / `Mapping[str, V]`                                 | `Record<string, V>` / `Readonly<Record<...>>`                    | same                                           |
| `dict[int, V]`                                                     | `Record<number, V>`                                              | same                                           |
| `dict[Literal['a', 'b'], V]`                                       | `Partial<Record<'a' \| 'b', V>>`: a dict need not have every key | same                                           |
| `dict[tuple[...], V]`                                              | `Record<string, V>` (JSON keys are strings)                      | `Map<..., V>`                                  |
| `datetime`, `date`                                                 | `string`                                                         | `Date`                                         |
| `UUID`, `Decimal`, `Path`, `timedelta`, `EmailStr`, `HttpUrl`, ... | `string`                                                         | `string`                                       |
| `Optional[T]`, `T \| None`                                         | `T \| null`                                                      | same                                           |
| `NotRequired[T]`, `total=False`                                    | `key?: T`                                                        | same                                           |
| `ReadOnly[T]`, `Final`, frozen dataclass/model, NamedTuple         | `readonly`                                                       | same                                           |
| `Literal['a', 1, True]`                                            | `'a' \| 1 \| true`                                               | same                                           |
| `Literal[Color.RED]`                                               | `'red'` (or `Color.RED` with `enumStyle: 'enum'`)                | same                                           |
| `Callable[[A, B], R]` / `Callable[..., R]`                         | `(arg0: A, arg1: B) => R` / `(...args: any[]) => R`              | same                                           |
| `Callable[P, R]` / `Concatenate[A, P]`                             | `(...args: P) => R` with `P extends unknown[]`                   | same                                           |
| `-> None`                                                          | `void`                                                           | same                                           |
| `Generator[Y, S, R]`                                               | `Y[]`                                                            | `Generator<Y, R, S>` (note the argument order) |
| `Awaitable[T]`, `Coroutine[..., T]`, `async def`                   | `Promise<T>`                                                     | same                                           |
| `type[T]` / `Self`                                                 | `abstract new (...args: any) => T` / `this`                      | same                                           |
| `NewType('UserId', str)`                                           | `string & { readonly __brand: 'UserId' }`                        | same                                           |
| `TypeVar('T', bound=B, covariant=True)`                            | `<T extends B>`; `out T` on protocols                            | same                                           |
| `TypeVar('T', int, str)` (constrained)                             | `T extends number \| string` (approximate, reported)             | same                                           |
| `*Ts` (TypeVarTuple)                                               | `...Ts` with `Ts extends unknown[]`                              | same                                           |
| `complex`                                                          | `unknown` (reported)                                             | same                                           |

Declarations:

- **TypedDict** → interface, with `total`, `Required` / `NotRequired` / `ReadOnly`, inheritance, and the functional
  syntax (`TypedDict("X", {"content-type": str})`).
- **dataclass / attrs / msgspec** → interface. `ClassVar`, `InitVar` and `KW_ONLY` are not instance fields. Properties
  appear only in `runtime` mode: `asdict()` does not include them.
- **pydantic** → interface using serialization aliases (`Field(alias=...)`, `serialization_alias`,
  `alias_generator=to_camel` including when inherited from a base model, msgspec `rename=`). `Field(exclude=True)`
  and private attributes are dropped; `@computed_field` properties are included, plain properties are not.
  `frozen=True` makes fields read-only; `extra="allow"` adds an index signature. `RootModel[T]` is an alias of `T`.
- **NamedTuple** → read-only labeled tuple, since it serializes as an array.
- **Protocol / plain class** → interface with methods (overloads kept), `@property` → `readonly`, `__call__` → call
  signature. A plain class's attributes are also read from `self.x = ...` in `__init__`, typed from the annotation, the
  parameter it is assigned from, or the literal.
- **Enum, StrEnum, IntEnum, Flag, IntFlag**, including the functional API, with CPython's `auto()` rules per base
  (StrEnum lowercases the name, Flag uses powers of two) and member expressions like `READ | WRITE`.
- **Aliases**: `type X = ...`, `X: TypeAlias = ...`, and PEP 484 implicit aliases (`X = list[int]`, but not
  `MAX = 10`). Generic aliases take their TypeVars in order of first appearance.
- **Docs**: class and attribute docstrings, `#:` comments, `Field(description=...)` and `@deprecated` become JSDoc;
  defaults become `@default`.
- **Imports**: relative imports of user types become `import type` statements. `typing`, `typing_extensions`,
  `collections.abc` and the other standard and pydantic modules are understood whether imported, aliased
  (`import typing as t`) or used bare in a snippet.

### TypeScript → Python

| TypeScript                                                                                             | Python                                                                                   |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `string`, `number`, `boolean`, `bigint`                                                                | `str`, `float` (see `number`), `bool`, `int`                                             |
| `null`, `undefined`, `void`                                                                            | `None`                                                                                   |
| `unknown` / `any` / `never`                                                                            | `object` (the safe top type) / `Any` / `Never`                                           |
| `object`, `symbol`                                                                                     | `object` (symbol is reported)                                                            |
| `T[]` / `readonly T[]`                                                                                 | `list[T]` / `Sequence[T]`                                                                |
| `[A, B]` / `[A, B?]` / `[A, ...B[]]`                                                                   | `tuple[A, B]` / `tuple[A] \| tuple[A, B]` / `tuple[A, *tuple[B, ...]]`                   |
| `Set<T>` / `ReadonlySet<T>`                                                                            | `set[T]` / `AbstractSet[T]`                                                              |
| `Map<K, V>`, `Record<K, V>`, `{ [k: string]: V }`                                                      | `dict[K, V]` (`Mapping` when read-only)                                                  |
| `Record<'a' \| 'b', V>`                                                                                | a TypedDict with keys `a` and `b`                                                        |
| `Date`, `RegExp`, `Uint8Array`, `Error`, `URL`                                                         | `datetime`, `re.Pattern[str]`, `bytes`, `Exception`, `str`                               |
| `Promise<T>`                                                                                           | `Awaitable[T]`                                                                           |
| `Generator<T, TReturn, TNext>`                                                                         | `Generator[T, TNext, TReturn]`                                                           |
| `x?: T`                                                                                                | `NotRequired[T]` (TypedDict) or `T \| None = None` (dataclass, pydantic)                 |
| `T \| null`, `T \| undefined`                                                                          | `T \| None`                                                                              |
| `readonly x`                                                                                           | `ReadOnly[T]`, `frozen=True`, `Field(frozen=True)`, or a `@property` on protocols        |
| `'a' \| 'b' \| 1`                                                                                      | `Literal["a", "b", 1]`                                                                   |
| `1.5` (float literal), `` `id-${number}` ``                                                            | `float`, `str` (reported)                                                                |
| `(a: A) => R`                                                                                          | `Callable[[A], R]`                                                                       |
| `(a: A, b?: B) => R`, generic or rest callables                                                        | a `Protocol` with `__call__` (positional-only)                                           |
| `A & B & { c: C }`                                                                                     | `class X(A, B)` adding `c`                                                               |
| `string & { __brand: 'Id' }`                                                                           | `NewType("Id", str)`                                                                     |
| `{ inline: object }`                                                                                   | a named class (`UserAddress`, `UserItem` for `items: {...}[]`)                           |
| `{ kind: 'a' } \| { kind: 'b' }`                                                                       | classes named after the tag (`ShapeCircle`); pydantic gets `Field(discriminator="kind")` |
| `Partial`, `Pick`, `Omit`, `Required`, `Readonly`, mapped types, `keyof`, `T['k']`, `typeof x[number]` | resolved by the checker, then converted                                                  |
| generic conditional types                                                                              | `Any` (reported)                                                                         |
| `<T extends B = D>`                                                                                    | PEP 695 `[T: B = D]` where supported, else a module-level `TypeVar`                      |
| `in T` / `out T`                                                                                       | inferred variance (PEP 695), or `contravariant=` / `covariant=`                          |

Declarations:

- **interface / type literal** → TypedDict by default; `dataclass`, `pydantic` or `protocol` by option. Interfaces with
  methods become protocols, with `/` making parameters positional-only, which is how TypeScript calls them.
- **Keys that are not identifiers** (`'content-type'`, `from`): TypedDict switches to the functional syntax, which keeps
  the exact keys; pydantic renames the attribute and keeps the key as an alias; dataclasses rename and report it.
- **Field names that shadow `BaseModel`** (`json`, `dict`, `copy`, `schema`, ...) are renamed with an alias.
- **Index signatures** become `extra_items=` (PEP 728) on TypedDicts, `extra="allow"` with a typed
  `__pydantic_extra__` on models, and `__getitem__` on protocols. An interface that is only an index signature is a
  `dict` alias.
- **class** → dataclass: initializers become defaults (`[]` → `field(default_factory=list[T])`), `static` →
  `ClassVar`, constructor parameter properties become fields, getters become read-only, `private`/`protected`/`#x` are
  dropped. `kw_only=True` is added when a required field follows a defaulted one, including an inherited one.
- **enum / const enum** → `StrEnum`, `IntEnum`, `IntFlag` (for `1 << n` members) or `Enum`, with the checker's
  constant values.
- **namespaces** are flattened (`Api.User` → `ApiUser`); interface declaration merging is honored.
- **Docs**: JSDoc becomes docstrings (with `@example` and other tags as sections); `@deprecated` becomes
  `@deprecated(...)` (PEP 702) on classes and a `.. deprecated::` note where a decorator would break construction
  (TypedDict, Enum).
- **Imports**: relative type imports become relative Python imports.

### Python versions

The output is valid, and importable, on the version you target; 3.11 is the oldest supported. Features newer than
the target fall back:

| Feature                                    | Native from      | Older targets get                                                                         |
| ------------------------------------------ | ---------------- | ----------------------------------------------------------------------------------------- |
| `type X = ...`, `class C[T]:` (PEP 695)    | 3.12             | `X: TypeAlias = ...`, `TypeVar` + `Generic[T]`                                            |
| `TypeVar(infer_variance=True)` (protocols) | 3.12             | `typing_extensions.TypeVar`                                                               |
| `ReadOnly` (PEP 705)                       | 3.13             | `typing_extensions` (and `TypedDict` from there too, since `typing.TypedDict` ignores it) |
| Type parameter defaults (PEP 696)          | 3.13             | `typing_extensions.TypeVar(default=...)`                                                  |
| `warnings.deprecated` (PEP 702)            | 3.13             | `typing_extensions.deprecated`                                                            |
| Lazy annotations (PEP 649)                 | 3.14             | forward references quoted where they are evaluated eagerly                                |
| `closed=` / `extra_items=` (PEP 728)       | not yet released | `typing_extensions.TypedDict`                                                             |

Forward references are handled precisely: declarations are ordered so dependencies come first, and only a
reference that still points ahead is quoted, as a whole annotation (`"Node[T] | None"`, since `"Node" | None`
fails at runtime), and only where Python evaluates it eagerly: class bodies before 3.14, `TypeAlias` values,
TypeVar bounds and the functional TypedDict syntax. `type` statements are lazy and never need quotes.

Imports are grouped and ordered as isort and ruff do, and names that a declaration would shadow are aliased
(`from typing import Any as _Any`).

## Diagnostics

Every conversion returns `diagnostics`: `{ severity, code, message, loc?, path? }`. Nothing is dropped silently.

| Code                      | Severity        | Means                                                                                  |
| ------------------------- | --------------- | -------------------------------------------------------------------------------------- |
| `unsupported-type`        | warning         | No counterpart; a looser type was emitted.                                             |
| `lossy-conversion`        | warning or info | Converted, but something is lost (a float literal, a template pattern).                |
| `unresolved-reference`    | warning         | A name the converter does not know; emitted as written. Add a `typeMap` entry.         |
| `renamed-identifier`      | warning         | Not a valid identifier in the target; renamed.                                         |
| `unsupported-syntax`      | warning         | Recognized but not converted.                                                          |
| `skipped-statement`       | info            | No type meaning (a function declaration).                                              |
| `synthesized-declaration` | info            | An anonymous type was given a name.                                                    |
| `restructured`            | info            | Rewritten to satisfy a target rule (functional TypedDict syntax, flattened namespace). |
| `suspicious-source`       | info            | Valid but odd (a name defined twice).                                                  |

## Not converted

- Function and variable declarations (only types are converted).
- Generic conditional types and generic mapped types: they need their type arguments to be resolved.
- TypeScript `private` and `protected` members, and Python methods on data classes (behaviour, not shape).
- Absolute imports of user types between languages: their module paths have no counterpart. Relative imports work;
  use `typeMap` for the rest.

## Development

```sh
npm test               # vitest
npm run coverage       # with coverage thresholds
npm run verify         # format, lint, typecheck, coverage, publint + attw
```

The integration suite runs generated Python through `pyright --strict` and executes it with every
`python3.11` ... `python3.14` on `PATH` (with `typing_extensions` and `pydantic` where installed); interpreters that
are missing are skipped.
