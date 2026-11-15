import { describe, expect, it } from 'vitest';
import { pythonToTypeScript, type PythonToTypeScriptOptions } from '../src/index.js';
import { typecheckTypeScript } from './helpers/typescript.js';

/** Converts and asserts the output type-checks, so every case below is also valid TypeScript. */
function ts(source: string, options: PythonToTypeScriptOptions = {}): string {
  const { code } = pythonToTypeScript(source, { header: false, ...options });
  expect(typecheckTypeScript(code.replace(/^import type .*$/gm, ''))).toEqual([]);
  return code;
}

const codes = (source: string, options: PythonToTypeScriptOptions = {}): string[] =>
  pythonToTypeScript(source, options).diagnostics.map((d) => d.code);

describe('primitives and containers', () => {
  it('maps builtins and their typing aliases', () => {
    const out = ts(`
from typing import List, Dict, Set, FrozenSet, Tuple, Any, Optional
class A:
    s: str
    i: int
    f: float
    b: bool
    by: bytes
    o: object
    a: Any
    l: list[int]
    L: List[str]
    d: dict[str, int]
    D: Dict[str, Any]
    st: set[int]
    fs: frozenset[str]
    t: tuple[int, str]
    T: Tuple[int, ...]
    e: tuple[()]
    n: None
    opt: Optional[int]
`);
    expect(out).toContain('s: string;');
    expect(out).toContain('i: number;');
    expect(out).toContain('by: string;'); // JSON has no bytes
    expect(out).toContain('o: unknown;'); // object is the top type
    expect(out).toContain('a: any;');
    expect(out).toContain('d: Record<string, number>;');
    expect(out).toContain('st: number[];'); // sets serialize as arrays
    expect(out).toContain('fs: readonly string[];');
    expect(out).toContain('t: readonly [number, string];'); // tuples are immutable
    expect(out).toContain('T: readonly number[];');
    expect(out).toContain('e: readonly [];');
    expect(out).toContain('n: null;');
    expect(out).toContain('opt: number | null;');
  });

  it('uses native JavaScript types in runtime mode', () => {
    const out = ts(
      `
from datetime import datetime
from re import Pattern
class A:
    by: bytes
    st: set[int]
    fs: frozenset[int]
    when: datetime
    pattern: Pattern[str]
    keyed: dict[tuple[int, int], str]
`,
      { mode: 'runtime' },
    );
    expect(out).toContain('by: Uint8Array;');
    expect(out).toContain('st: Set<number>;');
    expect(out).toContain('fs: ReadonlySet<number>;');
    expect(out).toContain('when: Date;');
    expect(out).toContain('pattern: RegExp;');
    expect(out).toContain('keyed: Map<readonly [number, number], string>;');
  });

  it('serializes library types as JSON strings', () => {
    const out = ts(`
import datetime as dt
from uuid import UUID
from decimal import Decimal
from pathlib import Path
class A:
    a: dt.datetime
    b: dt.date
    c: dt.timedelta
    d: UUID
    e: Decimal
    f: Path
`);
    for (const field of ['a', 'b', 'c', 'd', 'e', 'f']) expect(out).toContain(`${field}: string;`);
  });

  it('keeps dict keys honest: numeric keys stay numeric, literal keys become Partial', () => {
    const out = ts(`
from typing import Literal
class A:
    by_id: dict[int, str]
    by_kind: dict[Literal["a", "b"], int]
`);
    expect(out).toContain('by_id: Record<number, string>;');
    // A dict need not contain every key; Record<'a' | 'b', V> would require both.
    expect(out).toContain("by_kind: Partial<Record<'a' | 'b', number>>;");
  });

  it('writes recursive aliases with an index signature, which cannot be circular', () => {
    const out = ts(`
from typing import Union
Json = Union[dict[str, "Json"], list["Json"], str, int, float, bool, None]
`);
    expect(out).toContain('export type Json = { [key: string]: Json } | Json[] | string | number | boolean | null;');
  });

  it('prints int as bigint on request', () => {
    expect(ts('class A:\n    n: int\n    f: float', { int: 'bigint' })).toMatch(/n: bigint;\n\s+f: number;/);
  });

  it('prints None as undefined on request', () => {
    expect(ts('from typing import Optional\nclass A:\n    x: Optional[int]', { none: 'undefined' })).toContain(
      'x: number | undefined;',
    );
  });
});

describe('optional keys vs nullable values', () => {
  it('distinguishes NotRequired (key may be missing) from Optional (value may be None)', () => {
    const out = ts(`
from typing import TypedDict, NotRequired, Required, Optional
class Movie(TypedDict):
    title: str
    year: NotRequired[int]
    rating: Optional[float]
class Partial(TypedDict, total=False):
    a: int
    b: Required[str]
`);
    expect(out).toContain('year?: number;');
    expect(out).toContain('rating: number | null;');
    expect(out).toMatch(/interface Partial \{\n\s+a\?: number;\n\s+b: string;/);
  });

  it('keeps defaulted fields required (always present on instances) unless asked', () => {
    const source = 'from dataclasses import dataclass\n@dataclass\nclass A:\n    x: int = 0';
    expect(ts(source)).toContain('x: number;');
    expect(ts(source, { defaultedFields: 'optional' })).toContain('x?: number;');
  });
});

describe('enums', () => {
  const source = `
from enum import Enum, StrEnum, IntEnum, Flag, auto
class Color(StrEnum):
    RED = auto()
    GREEN = auto()
class Level(IntEnum):
    LOW = 1
    HIGH = auto()
class Perm(Flag):
    R = auto()
    W = auto()
    RW = R | W
class Pick:
    c: Color
`;

  it('follows auto() semantics per base', () => {
    const out = ts(source);
    expect(out).toContain("export type Color = 'red' | 'green';"); // StrEnum: lowercased name
    expect(out).toContain('export type Level = 1 | 2;');
    expect(out).toContain('export type Perm = 1 | 2 | 3;'); // Flag: powers of two, combinations evaluated
  });

  it('supports every enum style', () => {
    expect(ts(source, { enumStyle: 'enum' })).toContain("export enum Color {\n  RED = 'red',\n  GREEN = 'green',\n}");
    expect(ts(source, { enumStyle: 'const-enum' })).toContain('export const enum Level {');
    const object = ts(source, { enumStyle: 'object' });
    expect(object).toContain("export const Color = {\n  RED: 'red',\n  GREEN: 'green',\n} as const;");
    expect(object).toContain('export type Color = (typeof Color)[keyof typeof Color];');
  });

  it('prints Literal[Enum.MEMBER] in the enum style', () => {
    const member = `from enum import Enum\nfrom typing import Literal\nclass C(Enum):\n    A = "a"\nclass X:\n    c: Literal[C.A]`;
    expect(ts(member)).toContain("c: 'a';");
    expect(ts(member, { enumStyle: 'enum' })).toContain('c: C.A;');
  });

  it('reads the functional Enum API', () => {
    expect(ts('from enum import Enum\nColor = Enum("Color", "RED GREEN")')).toContain('export type Color = 1 | 2;');
  });
});

describe('classes', () => {
  it('converts dataclasses, honoring ClassVar, InitVar, KW_ONLY and frozen', () => {
    const out = ts(`
from dataclasses import dataclass, field, InitVar, KW_ONLY
from typing import ClassVar
@dataclass(frozen=True)
class A:
    x: int
    tags: list[str] = field(default_factory=list)
    _: KW_ONLY
    secret: InitVar[str] = ""
    count: ClassVar[int] = 0
`);
    expect(out).toContain('readonly x: number;');
    expect(out).toContain('readonly tags: string[];');
    expect(out).not.toContain('secret');
    expect(out).not.toContain('count');
    expect(out).not.toContain('_:');
  });

  it('reads NamedTuple as a read-only labeled tuple', () => {
    expect(ts('from typing import NamedTuple\nclass P(NamedTuple):\n    x: float\n    y: float = 0')).toContain(
      'export type P = readonly [x: number, y: number];',
    );
  });

  it('converts protocols with methods, properties and variance', () => {
    const out = ts(`
from typing import Protocol, TypeVar, overload
T_co = TypeVar("T_co", covariant=True)
class Reader(Protocol[T_co]):
    @property
    def name(self) -> str: ...
    def read(self, size: int = -1, /) -> T_co: ...
    @overload
    def get(self, key: int) -> str: ...
    @overload
    def get(self, key: str) -> int: ...
    def get(self, key): ...
    async def fetch(self) -> bytes: ...
    def __call__(self, x: int) -> None: ...
    def _private(self) -> None: ...
`);
    expect(out).toContain('export interface Reader<out T_co> {');
    expect(out).toContain('(x: number): void;');
    expect(out).toContain('readonly name: string;');
    expect(out).toContain('read(size?: number): T_co;');
    expect(out).toContain('get(key: number): string;\n  get(key: string): number;');
    expect(out).toContain('fetch(): Promise<string>;');
    expect(out).not.toContain('_private');
  });

  it('reads attributes a plain class declares in __init__', () => {
    const out = ts(`
class Plugin:
    def __init__(self, name: str, retries: int = 3) -> None:
        self.name = name
        self.retries = retries
        self.enabled: bool = True
        self._cache = {}
`);
    expect(out).toContain('name: string;');
    expect(out).toContain('retries: number;');
    expect(out).toContain('enabled: boolean;');
    expect(out).not.toContain('_cache');
  });

  it('maps inheritance and generics', () => {
    const out = ts(`
from typing import Generic, TypeVar
from typing import TypedDict
T = TypeVar("T", bound="Base")
class Base(TypedDict):
    id: int
class Child(Base):
    name: str
class Box(Generic[T]):
    item: T
class Pep695[K: str, V = int]:
    key: K
    value: V
`);
    expect(out).toContain('export interface Child extends Base {');
    expect(out).toContain('export interface Box<T extends Base> {');
    expect(out).toContain('export interface Pep695<K extends string, V = number> {');
  });

  it('uses objectStyle: type', () => {
    expect(
      ts('from typing import TypedDict\nclass A(TypedDict):\n    x: int\nclass B(A):\n    y: int', {
        objectStyle: 'type',
      }),
    ).toContain('export type B = A & {\n  y: number;\n};');
  });
});

describe('pydantic', () => {
  it('uses serialization aliases and alias generators, as FastAPI responses do', () => {
    const source = `
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
class Base(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel)
class User(Base):
    user_id: int
    full_name: str = Field(alias="name")
    password: str = Field(exclude=True)
    _token: str = ""
`;
    const out = ts(source);
    expect(out).toContain('userId: number;');
    expect(out).toContain('name: string;');
    expect(out).not.toContain('password');
    expect(out).not.toContain('token');
    expect(ts(source, { useAliases: false })).toContain('user_id: number;');
  });

  it('includes computed fields but not plain properties in JSON mode', () => {
    const source = `
from pydantic import BaseModel, computed_field
class A(BaseModel):
    x: int
    @computed_field
    @property
    def double(self) -> int:
        return self.x * 2
    @property
    def internal(self) -> str:
        return ""
`;
    const json = ts(source);
    expect(json).toContain('readonly double: number;');
    expect(json).not.toContain('internal');
    expect(ts(source, { mode: 'runtime' })).toContain('readonly internal: string;');
  });

  it('turns frozen and extra config into readonly fields and an index signature', () => {
    const out = ts(`
from pydantic import BaseModel, ConfigDict
class A(BaseModel):
    model_config = ConfigDict(frozen=True, extra="allow")
    x: int
`);
    expect(out).toContain('readonly x: number;');
    expect(out).toContain('[key: string]: unknown;');
  });

  it('treats RootModel as an alias of its root', () => {
    expect(ts('from pydantic import RootModel\nclass Tags(RootModel[list[str]]):\n    pass')).toContain(
      'export type Tags = string[];',
    );
  });

  it('maps pydantic types and constrained factories', () => {
    const out = ts(`
from pydantic import BaseModel, EmailStr, HttpUrl, PositiveInt, constr, conlist
class A(BaseModel):
    email: EmailStr
    site: HttpUrl
    n: PositiveInt
    code: constr(min_length=2)
    items: conlist(int, min_length=1)
`);
    expect(out).toMatch(/email: string;\n\s+site: string;\n\s+n: number;\n\s+code: string;\n\s+items: number\[\];/);
  });
});

describe('aliases and special forms', () => {
  it('recognizes implicit, TypeAlias and type-statement aliases, but not constants', () => {
    const out = ts(`
from typing import TypeAlias, Union
A = Union[int, str]
B: TypeAlias = "list[A]"
type C[T] = dict[str, T]
MAX = 10
NAME = "x"
`);
    expect(out).toContain('export type A = number | string;');
    expect(out).toContain('export type B = A[];');
    expect(out).toContain('export type C<T> = Record<string, T>;');
    expect(out).not.toContain('MAX');
    expect(out).not.toContain('NAME');
  });

  it('maps NewType to a branded type', () => {
    expect(ts('from typing import NewType\nUserId = NewType("UserId", int)')).toContain(
      "export type UserId = number & { readonly __brand: 'UserId' };",
    );
  });

  it('converts Callable, ParamSpec and Concatenate', () => {
    const out = ts(`
from collections.abc import Callable, Awaitable
from typing import ParamSpec, Concatenate, TypeVar
P = ParamSpec("P")
R = TypeVar("R")
Handler = Callable[[str, int], None]
Anything = Callable[..., int]
Wrapped = Callable[P, R]
WithCtx = Callable[Concatenate[str, P], Awaitable[R]]
`);
    expect(out).toContain('export type Handler = (arg0: string, arg1: number) => void;');
    expect(out).toContain('export type Anything = (...args: any[]) => number;');
    expect(out).toContain('export type Wrapped<P extends unknown[], R> = (...args: P) => R;');
    expect(out).toContain('export type WithCtx<P extends unknown[], R> = (arg0: string, ...args: P) => Promise<R>;');
  });

  it('reorders Generator arguments: Generator[Y, S, R] is Generator<Y, R, S>', () => {
    expect(ts('from collections.abc import Generator\nG = Generator[int, str, bool]', { mode: 'runtime' })).toContain(
      'export type G = Generator<number, boolean, string>;',
    );
  });

  it('maps TypeVarTuple to a tuple-constrained parameter', () => {
    expect(ts('type Row[*Ts] = tuple[int, *Ts]')).toContain(
      'export type Row<Ts extends unknown[]> = readonly [number, ...Ts];',
    );
  });

  it('maps type[X] to a constructor type and Self to this', () => {
    const out = ts('from typing import Self\nclass A:\n    cls: type["A"]\n    def clone(self) -> Self: ...');
    expect(out).toContain('cls: abstract new (...args: any) => A;');
    expect(out).toContain('clone(): this;');
  });

  it('reads forward references in strings and from __future__ annotations', () => {
    expect(ts('class Node:\n    next: "Node | None"\n    children: list["Node"]')).toContain(
      'next: Node | null;\n  children: Node[];',
    );
  });
});

describe('docs', () => {
  it('turns docstrings, attribute docstrings and #: comments into JSDoc', () => {
    const out = ts(`
from typing_extensions import deprecated
@deprecated("Use B")
class A:
    """Summary.

    Details.
    """
    #: The x.
    x: int
    y: int
    """The y."""
`);
    expect(out).toContain('/**\n * Summary.\n *\n * Details.\n * @deprecated Use B\n */');
    expect(out).toContain('/** The x. */\n  x: number;');
    expect(out).toContain('/** The y. */\n  y: number;');
  });

  it('notes defaults with @default', () => {
    expect(ts('class A:\n    x: int = 3\n    s: str = "hi"')).toContain("/** @default 'hi' */");
  });
});

describe('modules and names', () => {
  it('turns relative imports into type imports', () => {
    const { code, diagnostics } = pythonToTypeScript(
      'from .models import User\nfrom ..shared.types import Id as Key\nclass A:\n    u: User\n    k: Key',
    );
    expect(code).toContain("import type { User } from './models.js';");
    expect(code).toContain("import type { Id as Key } from '../shared/types.js';");
    expect(diagnostics).toEqual([]);
  });

  it('warns about absolute imports of user types', () => {
    expect(codes('from myapp.models import User\nclass A:\n    u: User')).toContain('unresolved-reference');
  });

  it('respects __all__ and underscores for exports', () => {
    const out = ts('__all__ = ["A"]\nclass A:\n    x: int\nclass B:\n    y: int');
    expect(out).toContain('export interface A');
    expect(out).toMatch(/^interface B/m);
    expect(ts('class _Hidden:\n    x: int')).toMatch(/^interface _Hidden/m);
  });

  it('applies a property case', () => {
    expect(ts('class A:\n    user_id: int', { propertyCase: 'camelCase' })).toContain('userId: number;');
  });

  it('quotes keys that are not identifiers', () => {
    expect(
      ts('from typing import TypedDict\nA = TypedDict("A", {"content-type": str, "class": int})', { quote: 'double' }),
    ).toContain('"content-type": string;');
  });

  it('applies typeMap overrides with their imports', () => {
    const { code } = pythonToTypeScript('from bson import ObjectId\nclass A:\n    id: ObjectId', {
      typeMap: { 'bson.ObjectId': { type: 'ObjectId', imports: ["import type { ObjectId } from 'mongodb';"] } },
    });
    expect(code).toContain("import type { ObjectId } from 'mongodb';");
    expect(code).toContain('id: ObjectId;');
  });

  it('warns about unknown names and lossy types', () => {
    expect(codes('class A:\n    x: Mystery')).toContain('unresolved-reference');
    expect(codes('class A:\n    x: complex')).toContain('unsupported-type');
  });
});
