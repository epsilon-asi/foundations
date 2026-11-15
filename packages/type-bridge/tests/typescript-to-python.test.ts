import { describe, expect, it } from 'vitest';
import { typeScriptToPython, type TypeScriptToPythonOptions } from '../src/index.js';
import { compilePython, interpreter } from './helpers/python.js';

const py312 = interpreter('3.12');

/** Converts, and when python3.12 is available checks that the output at least compiles. */
function py(source: string, options: TypeScriptToPythonOptions = {}): string {
  const { code } = typeScriptToPython(source, { header: false, ...options });
  const version = options.pythonVersion ?? '3.12';
  const compiler = interpreter(version) ?? (version === '3.12' ? py312 : undefined);
  if (compiler) expect(compilePython(compiler.bin, code).output).toBe('');
  return code;
}

const codes = (source: string, options: TypeScriptToPythonOptions = {}): string[] =>
  typeScriptToPython(source, options).diagnostics.map((d) => d.code);

describe('primitives', () => {
  it('maps the primitive types', () => {
    const out = py(`
export interface A {
  s: string; n: number; b: boolean; big: bigint; u: unknown; a: any; o: object;
  nul: null; und: undefined; v: void; nev: never; sym: symbol;
}`);
    expect(out).toContain('s: str');
    expect(out).toContain('n: float'); // PEP 484: an int is accepted where float is expected
    expect(out).toContain('big: int');
    expect(out).toContain('u: object'); // object is Python's safe top type
    expect(out).toContain('a: Any');
    expect(out).toContain('nul: None');
    expect(out).toContain('nev: Never');
    expect(out).toContain('sym: object');
  });

  it('lets number be int or int | float', () => {
    expect(py('export type N = number;', { number: 'int' })).toContain('type N = int');
    expect(py('export type N = number;', { number: 'int | float' })).toContain('type N = int | float');
  });

  it('maps literals, merging them into one Literal', () => {
    const out = py("export type L = 'a' | 'b' | 1 | -2 | true | null | string;");
    expect(out).toContain('type L = Literal["a", "b", 1, -2, True] | str | None');
  });

  it('degrades float literals and template literals with a diagnostic', () => {
    expect(py('export type F = 1.5;')).toContain('type F = float');
    expect(codes('export type F = 1.5;')).toContain('lossy-conversion');
    expect(py('export type T = `id-${number}`;')).toContain('type T = str');
  });
});

describe('containers', () => {
  it('maps arrays, tuples, sets, maps and records', () => {
    const out = py(`
export interface A {
  arr: string[]; ro: readonly string[]; generic: Array<number>;
  pair: [string, number]; opt: [string, number?]; rest: [string, ...number[]]; many: number[][];
  set: Set<string>; roSet: ReadonlySet<string>; map: Map<string, number>; roMap: ReadonlyMap<string, number>;
  rec: Record<string, number>; idx: { [key: string]: boolean };
}`);
    expect(out).toContain('arr: list[str]');
    expect(out).toContain('ro: Sequence[str]');
    expect(out).toContain('pair: tuple[str, float]');
    expect(out).toContain('opt: tuple[str] | tuple[str, float]'); // Python tuples have a fixed length
    expect(out).toContain('rest: tuple[str, *tuple[float, ...]]');
    expect(out).toContain('set: set[str]');
    expect(out).toContain('roSet: AbstractSet[str]');
    expect(out).toContain('Set as AbstractSet');
    expect(out).toContain('map: dict[str, float]');
    expect(out).toContain('roMap: Mapping[str, float]');
    expect(out).toContain('rec: dict[str, float]');
    expect(out).toContain('idx: dict[str, bool]');
  });

  it('expands literal-keyed records into classes', () => {
    expect(py("export type Flags = Record<'a' | 'b', boolean>;")).toContain(
      'class Flags(TypedDict):\n    a: bool\n    b: bool',
    );
  });

  it('maps library types', () => {
    const out = py(`
export interface A {
  d: Date; re: RegExp; p: Promise<string>; buf: Uint8Array; err: Error; url: URL;
  it: Iterable<number>; gen: Generator<number, string, boolean>; ag: AsyncIterable<number>;
}`);
    expect(out).toContain('d: datetime');
    expect(out).toContain('re: re.Pattern[str]');
    expect(out).toContain('p: Awaitable[str]');
    expect(out).toContain('buf: bytes');
    expect(out).toContain('err: Exception');
    expect(out).toContain('it: Iterable[float]');
    // Generator<T, TReturn, TNext> → Generator[Yield, Send, Return]
    expect(out).toContain('gen: Generator[float, bool, str]');
  });
});

describe('optional vs undefined vs null', () => {
  it('maps optional keys to NotRequired and nullable values to | None', () => {
    const out = py('export interface A { a?: string; b: string | null; c: string | undefined; d?: string | null }');
    expect(out).toContain('a: NotRequired[str]');
    expect(out).toContain('b: str | None');
    expect(out).toContain('c: str | None');
    expect(out).toContain('d: NotRequired[str | None]');
  });

  it('uses total=False when every key is optional', () => {
    expect(py('export interface A { a?: string; b?: number }')).toContain('class A(TypedDict, total=False):');
  });

  it('gives dataclass and pydantic optionals a None default', () => {
    expect(py('export interface A { a: string; b?: number }', { objectStyle: 'dataclass' })).toContain(
      'a: str\n    b: float | None = None',
    );
    expect(py('export interface A { a?: number; b: string }', { objectStyle: 'dataclass' })).toContain(
      '@dataclass(kw_only=True)',
    );
  });

  it('uses kw_only when a subclass adds required fields to a base with defaults', () => {
    const out = py('export interface A { a?: number } export interface B extends A { b: string }', {
      objectStyle: 'dataclass',
    });
    expect(out).toContain('@dataclass(kw_only=True)\nclass B(A):');
  });

  it('marks readonly members', () => {
    expect(py('export interface A { readonly a: string; b: number }')).toContain('a: ReadOnly[str]');
    expect(py('export interface A { readonly a: string }', { objectStyle: 'dataclass' })).toContain(
      '@dataclass(frozen=True)',
    );
    expect(py('export interface A { readonly a: string }', { objectStyle: 'pydantic' })).toContain(
      'model_config = ConfigDict(frozen=True)',
    );
    expect(py('export interface A { readonly a: string; b: number }', { objectStyle: 'pydantic' })).toContain(
      'a: str = Field(frozen=True)',
    );
  });
});

describe('Python version targets', () => {
  const source = `
export interface Node<T> { value: T; next: Node<T> | null; tags?: readonly string[] }
export type Pair<A, B = string> = [A, B];
export type Id = string | number;
`;

  it('uses PEP 695 syntax and native unions on 3.12', () => {
    const out = py(source, { pythonVersion: '3.12' });
    expect(out).toContain('class Node[T](TypedDict):');
    expect(out).toContain('type Id = str | float');
    expect(out).toContain('    next: "Node[T] | None"'); // class bodies are still evaluated eagerly
  });

  it('needs no quotes on 3.14 (deferred annotations)', () => {
    expect(py(source, { pythonVersion: '3.14' })).toContain('    next: Node[T] | None');
  });

  it('falls back to TypeVar, Generic and TypeAlias on 3.11, which predates PEP 695', () => {
    const out = py(source, { pythonVersion: '3.11' });
    expect(out).toContain('T = TypeVar("T")');
    expect(out).toContain('class Node(TypedDict, Generic[T]):');
    expect(out).toContain('Id: TypeAlias = str | float');
    expect(out).toContain('from typing import Generic, NotRequired, TypeAlias, TypedDict');
    // TypeVar defaults (PEP 696) are 3.13; typing_extensions backports them.
    expect(out).toContain('from typing_extensions import TypeVar');
    expect(out).toContain('B = TypeVar("B", default=str)');
  });

  it('uses TypeVar defaults syntax only from 3.13', () => {
    expect(py('export type Box<T = string> = T[];', { pythonVersion: '3.13' })).toContain(
      'type Box[T = str] = list[T]',
    );
    expect(py('export type Box<T = string> = T[];', { pythonVersion: '3.12' })).toContain('Box: TypeAlias = list[T]');
  });

  it('imports TypedDict from typing_extensions when its features need it', () => {
    // ReadOnly is 3.13; typing.TypedDict ignores typing_extensions.ReadOnly, so both come from typing_extensions.
    expect(py('export interface A { readonly a: string }', { pythonVersion: '3.12' })).toContain(
      'from typing_extensions import ReadOnly, TypedDict',
    );
    expect(py('export interface A { readonly a: string }', { pythonVersion: '3.13' })).toContain(
      'from typing import ReadOnly, TypedDict',
    );
    expect(py('export interface A { a?: string; b: string }', { pythonVersion: '3.11' })).toContain(
      'from typing import NotRequired, TypedDict',
    );
  });
});

describe('objects', () => {
  it('hoists anonymous object types into named classes', () => {
    const out = py('export interface User { address: { street: string }; items: { id: number }[] }');
    expect(out).toContain('class UserAddress(TypedDict):');
    expect(out).toContain('class UserItem(TypedDict):');
    expect(out).toContain('items: list[UserItem]');
  });

  it('names discriminated union members after their tag', () => {
    const out = py("export type Shape = { kind: 'circle'; r: number } | { kind: 'square'; side: number };");
    expect(out).toContain('class ShapeCircle(TypedDict):');
    expect(out).toContain('type Shape = ShapeCircle | ShapeSquare');
  });

  it('adds a pydantic discriminator for tagged unions of models', () => {
    const out = py(
      "export interface Cat { kind: 'cat' } export interface Dog { kind: 'dog' } export interface O { pet: Cat | Dog }",
      {
        objectStyle: 'pydantic',
      },
    );
    expect(out).toContain('pet: Cat | Dog = Field(discriminator="kind")');
  });

  it('merges intersections into subclasses', () => {
    const out = py(
      'export interface A { a: string } export interface B { b: number } export type C = A & B & { c: boolean };',
    );
    expect(out).toContain('class C(A, B):\n    c: bool');
  });

  it('turns branded types into NewType', () => {
    expect(py("export type UserId = string & { readonly __brand: 'UserId' };")).toContain(
      'UserId = NewType("UserId", str)',
    );
  });

  it('uses the functional syntax for keys that are not identifiers', () => {
    const out = py("export interface Headers { 'content-type': string; from: string; ok: boolean }");
    expect(out).toContain(
      'Headers = TypedDict(\n    "Headers",\n    {\n        "content-type": str,\n        "from": str,',
    );
  });

  it('renames invalid field names with a pydantic alias', () => {
    const out = py('export interface Mail { from: string; json: string }', { objectStyle: 'pydantic' });
    expect(out).toContain('from_: str = Field(alias="from")');
    expect(out).toContain('json_: str = Field(alias="json")'); // json shadows BaseModel.json
  });

  it('converts index signatures per style', () => {
    expect(py('export interface Only { [key: string]: number }')).toContain('type Only = dict[str, float]');
    expect(py('export interface Mixed { a: string; [key: string]: string }')).toContain(
      'class Mixed(TypedDict, extra_items=str):',
    );
    expect(py('export interface Mixed { a: string; [key: string]: string }', { objectStyle: 'pydantic' })).toContain(
      '__pydantic_extra__: dict[str, str]',
    );
  });

  it('turns interfaces with methods into protocols with positional-only parameters', () => {
    const out = py(`
export interface Repo<T> {
  get(id: string): Promise<T | undefined>;
  get(id: number): Promise<T>;
  find(query?: string, ...tags: string[]): T[];
  readonly size: number;
  (raw: string): T;
  [key: string]: unknown;
}`);
    expect(out).toContain('class Repo[T](Protocol):');
    expect(out).toContain('    @overload\n    def get(self, id: str, /) -> Awaitable[T | None]: ...');
    expect(out).toContain('    def find(self, query: str = ..., /, *tags: str) -> list[T]: ...');
    expect(out).toContain('    @property\n    def size(self) -> float: ...');
    expect(out).toContain('    def __call__(self, raw: str, /) -> T: ...');
    expect(out).toContain('    def __getitem__(self, key: str, /) -> object: ...');
  });

  it('turns callables with optional parameters into callback protocols', () => {
    const out = py('export type Cb = (a: string, b?: number) => void; export type Simple = (a: string) => boolean;');
    expect(out).toContain('class Cb(Protocol):\n    def __call__(self, a: str, b: float = ..., /) -> None: ...');
    expect(out).toContain('type Simple = Callable[[str], bool]');
  });

  it('converts classes to dataclasses, skipping private members', () => {
    const out = py(`
export class Invoice {
  static prefix = 'INV';
  lines: string[] = [];
  paid = false;
  #secret = 1;
  private hidden = 2;
  constructor(public readonly id: string) {}
  get label(): string { return ''; }
}`);
    expect(out).toContain('@dataclass(kw_only=True)\nclass Invoice:');
    expect(out).toContain('lines: list[str] = field(default_factory=list[str])');
    expect(out).toContain('paid: bool = False');
    expect(out).toContain('id: str');
    expect(out).toContain('prefix: ClassVar[str] = "INV"');
    expect(out).not.toContain('secret');
    expect(out).not.toContain('hidden');
  });
});

describe('evaluated types', () => {
  it('resolves utility, keyof, indexed access, typeof and mapped types with the checker', () => {
    const out = py(`
export interface User { id: number; name: string; email?: string }
export type Patch = Partial<Pick<User, 'name' | 'email'>>;
export type Keys = keyof User;
export type Name = User['name'];
const ROLES = ['admin', 'member'] as const;
export type Role = (typeof ROLES)[number];
export type Flags = { [K in 'a' | 'b']: boolean };
export type Strict = Required<User>;
`);
    expect(out).toContain('class Patch(TypedDict, total=False):\n    name: str\n    email: str');
    expect(out).toContain('type Keys = Literal["id", "name", "email"]');
    expect(out).toContain('type Name = str');
    expect(out).toContain('type Role = Literal["admin", "member"]');
    expect(out).toContain('class Flags(TypedDict):\n    a: bool\n    b: bool');
    expect(out).toContain('class Strict(TypedDict):\n    id: float\n    name: str\n    email: str');
  });

  it('warns about generic conditional types', () => {
    expect(codes('export type IsString<T> = T extends string ? true : false;')).toContain('unsupported-type');
  });

  it('folds a full set of enum members back into the enum', () => {
    expect(py("export enum S { A = 'a', B = 'b' } export interface X { s: S } export type P = Partial<X>;")).toContain(
      '    s: S',
    );
  });
});

describe('enums', () => {
  it('chooses the enum base from the values', () => {
    const out = py(`
export enum S { A = 'a', B = 'b' }
export enum N { A, B, C = 10, D }
export enum F { R = 1 << 0, W = 1 << 1, RW = R | W }
export enum M { A = 'a', B = 1 }
`);
    expect(out).toContain('class S(StrEnum):\n    A = "a"\n    B = "b"');
    expect(out).toContain('class N(IntEnum):\n    A = 0\n    B = 1\n    C = 10\n    D = 11');
    expect(out).toContain('class F(IntFlag):\n    R = 1\n    W = 2\n    RW = 3');
    expect(out).toContain('class M(Enum):');
  });

  it('can emit Literal aliases instead', () => {
    expect(py("export enum S { A = 'a', B = 'b' }", { enumStyle: 'literal' })).toContain('type S = Literal["a", "b"]');
  });

  it('prints enum member types as Literal[Enum.Member]', () => {
    expect(py("export enum S { A = 'a' } export interface X { s: S.A }")).toContain('s: Literal[S.A]');
  });
});

describe('docs, names and modules', () => {
  it('turns JSDoc into docstrings and @deprecated into a decorator', () => {
    const out = py(
      `
/**
 * A user.
 * @example const u: User = { id: 1 };
 * @deprecated Use Account.
 */
export interface User {
  /** The id. */
  id: number;
}`,
      { objectStyle: 'dataclass' },
    );
    expect(out).toContain('@deprecated("Use Account.")\n@dataclass\nclass User:');
    expect(out).toContain(
      '    """A user.\n\n    Example: const u: User = { id: 1 };\n\n    .. deprecated:: Use Account.\n    """',
    );
    expect(out).toContain('    id: float\n    """The id."""');
  });

  it('flattens namespaces', () => {
    expect(py('export namespace Api { export interface User { id: string } } export type U = Api.User;')).toContain(
      'type U = ApiUser',
    );
  });

  it('turns relative imports into relative Python imports', () => {
    const out = py(
      "import type { User } from './models/user.js';\nimport { Id as Key } from '../ids';\nexport interface A { u: User; k: Key }",
    );
    expect(out).toContain('from .models.user import User');
    expect(out).toContain('from ..ids import Id as Key');
  });

  it('emits __all__ when some declarations are not exported', () => {
    expect(py('export interface A { x: number } interface B { y: number }')).toContain('__all__ = ["A"]');
    expect(py('export interface A { x: number }')).not.toContain('__all__');
  });

  it('aliases typing imports that a declaration would shadow', () => {
    const out = py('export interface Any { x: unknown; y: any }');
    expect(out).toContain('from typing import Any as _Any');
    expect(out).toContain('y: _Any');
  });

  it('applies typeMap overrides with imports', () => {
    const { code } = typeScriptToPython('export interface A { id: ObjectId }', {
      typeMap: { ObjectId: { type: 'ObjectId', imports: ['from bson import ObjectId'] } },
    });
    expect(code).toContain('from bson import ObjectId');
    expect(code).toContain('id: ObjectId');
  });

  it('can turn hoisting off', () => {
    const { code, diagnostics } = typeScriptToPython('export interface A { b: { c: string } }', { hoist: false });
    expect(code).toContain('b: dict[str, Any]');
    expect(diagnostics.map((d) => d.code)).toContain('unsupported-type');
  });
});
