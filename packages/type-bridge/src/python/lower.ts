import { DiagnosticBag } from '../diagnostics.js';
import { t, unionOf } from '../ir/build.js';
import type {
  Declaration,
  DefaultValue,
  Doc,
  EnumDeclaration,
  EnumFlavor,
  EnumMember,
  FunctionType,
  Member,
  MethodMember,
  ModuleImport,
  ObjectDeclaration,
  ObjectFlavor,
  Parameter,
  PropertyMember,
  SourceLocation,
  TupleElement,
  TypeModule,
  TypeNode,
  TypeParam,
  Variance,
} from '../ir/types.js';
import type { TypeMap } from '../options.js';
import { parsePythonModule } from '../shared/modules.js';
import { toCamelCase, toPascalCase, toSnakeCase } from '../shared/naming.js';
import { dedent } from '../shared/strings.js';
import type { PyExpr, PyKeyword, PyModule, PyParam, PyStmt, PyTypeParam } from './ast.js';
import { parsePythonExpression, parsePythonSource } from './parser.js';

export interface ParsePythonOptions {
  /** Source-to-target overrides; see {@link TypeMap}. Default: none. */
  typeMap?: TypeMap;
  /** Keep members whose names start with `_` on protocols and plain classes. Default: false. */
  includePrivate?: boolean;
}

/** Parses Python source into a {@link TypeModule}. Throws `ParseError` on invalid syntax. */
export function parsePython(source: string, options: ParsePythonOptions = {}): TypeModule {
  const module = parsePythonSource(source);
  return new PythonLowering(module, options).run();
}

// ---------------------------------------------------------------------------
// Name tables
// ---------------------------------------------------------------------------

/** Modules whose names are folded into one canonical namespace before lookup. */
const MODULE_ALIASES: Record<string, string> = {
  typing_extensions: 'typing',
  'collections.abc': 'typing',
  'pydantic.v1': 'pydantic',
  'pydantic.types': 'pydantic',
  'pydantic.networks': 'pydantic',
  'pydantic.fields': 'pydantic',
  'pydantic.main': 'pydantic',
  'pydantic.functional_validators': 'pydantic',
  'pydantic.alias_generators': 'pydantic',
  'pydantic.config': 'pydantic',
  attr: 'attrs',
  dataclasses: 'dataclasses',
};

/** `collections.abc.Set` is the abstract set; `typing.Set` is the mutable built-in. They must not be folded together. */
const SPECIAL_CANONICAL: Record<string, string> = {
  'collections.abc.Set': 'typing.AbstractSet',
  'collections.abc.MutableSet': 'typing.MutableSet',
};

/** Library modules: importing from them records no user import. */
const LIBRARY_MODULES = [
  '__future__',
  'typing',
  'typing_extensions',
  'collections',
  'datetime',
  'uuid',
  'decimal',
  'pathlib',
  're',
  'enum',
  'dataclasses',
  'pydantic',
  'pydantic_core',
  'attrs',
  'attr',
  'msgspec',
  'ipaddress',
  'builtins',
  'abc',
  'functools',
  'types',
  'sys',
  'numbers',
  'fractions',
  'os',
  'annotated_types',
  'sqlmodel',
];

/** Names that resolve without an import when a snippet uses them bare. */
const BARE_NAMES: Record<string, string> = {};
for (const name of [
  'Any',
  'Union',
  'Optional',
  'List',
  'Dict',
  'Set',
  'FrozenSet',
  'Tuple',
  'Type',
  'Callable',
  'Literal',
  'Final',
  'ClassVar',
  'Annotated',
  'TypeAlias',
  'TypeVar',
  'ParamSpec',
  'TypeVarTuple',
  'Unpack',
  'Concatenate',
  'Generic',
  'Protocol',
  'NamedTuple',
  'TypedDict',
  'NewType',
  'Required',
  'NotRequired',
  'ReadOnly',
  'Self',
  'Never',
  'NoReturn',
  'LiteralString',
  'Text',
  'AnyStr',
  'Sequence',
  'MutableSequence',
  'Mapping',
  'MutableMapping',
  'Iterable',
  'Iterator',
  'Collection',
  'Generator',
  'AsyncGenerator',
  'AsyncIterable',
  'AsyncIterator',
  'Awaitable',
  'Coroutine',
  'Deque',
  'DefaultDict',
  'OrderedDict',
  'Counter',
  'ChainMap',
  'AbstractSet',
  'MutableSet',
  'TypeGuard',
  'TypeIs',
  'overload',
  'final',
  'runtime_checkable',
  'override',
]) {
  BARE_NAMES[name] = `typing.${name}`;
}
Object.assign(BARE_NAMES, {
  datetime: 'datetime.datetime',
  date: 'datetime.date',
  time: 'datetime.time',
  timedelta: 'datetime.timedelta',
  UUID: 'uuid.UUID',
  Decimal: 'decimal.Decimal',
  Path: 'pathlib.Path',
  Enum: 'enum.Enum',
  IntEnum: 'enum.IntEnum',
  StrEnum: 'enum.StrEnum',
  Flag: 'enum.Flag',
  IntFlag: 'enum.IntFlag',
  auto: 'enum.auto',
  dataclass: 'dataclasses.dataclass',
  field: 'dataclasses.field',
  InitVar: 'dataclasses.InitVar',
  KW_ONLY: 'dataclasses.KW_ONLY',
  BaseModel: 'pydantic.BaseModel',
  RootModel: 'pydantic.RootModel',
  Field: 'pydantic.Field',
  ConfigDict: 'pydantic.ConfigDict',
  computed_field: 'pydantic.computed_field',
  EmailStr: 'pydantic.EmailStr',
  HttpUrl: 'pydantic.HttpUrl',
  AnyUrl: 'pydantic.AnyUrl',
  SecretStr: 'pydantic.SecretStr',
  deque: 'collections.deque',
  defaultdict: 'collections.defaultdict',
  namedtuple: 'collections.namedtuple',
  property: 'builtins.property',
  staticmethod: 'builtins.staticmethod',
  classmethod: 'builtins.classmethod',
  cached_property: 'functools.cached_property',
  abstractmethod: 'abc.abstractmethod',
  ABC: 'abc.ABC',
  deprecated: 'typing.deprecated',
});

const BUILTINS = new Set([
  'str',
  'int',
  'float',
  'complex',
  'bool',
  'bytes',
  'bytearray',
  'memoryview',
  'object',
  'list',
  'dict',
  'set',
  'frozenset',
  'tuple',
  'type',
  'range',
  'slice',
  'Exception',
  'BaseException',
  'ValueError',
  'TypeError',
  'KeyError',
  'RuntimeError',
]);

const ENUM_BASES: Record<string, EnumBase> = {
  'enum.Enum': 'enum',
  'enum.IntEnum': 'int',
  'enum.StrEnum': 'str',
  'enum.Flag': 'flag',
  'enum.IntFlag': 'int-flag',
  'enum.ReprEnum': 'enum',
};
type EnumBase = 'enum' | 'int' | 'str' | 'flag' | 'int-flag';

const PYDANTIC_STRING: Record<string, TypeNode> = {};
const PYDANTIC_KNOWN: Record<string, () => TypeNode> = {
  'pydantic.EmailStr': () => ({ kind: 'well-known', name: 'email', args: [] }),
  'pydantic.NameEmail': () => ({ kind: 'well-known', name: 'email', args: [] }),
  'pydantic.SecretStr': () => ({ kind: 'well-known', name: 'secret', args: [] }),
  'pydantic.SecretBytes': () => ({ kind: 'well-known', name: 'secret', args: [] }),
  'pydantic.Base64Str': () => t.primitive('string'),
  'pydantic.Base64Bytes': () => t.primitive('bytes'),
  'pydantic.Base64UrlStr': () => t.primitive('string'),
  'pydantic.StrictStr': () => t.primitive('string'),
  'pydantic.StrictInt': () => t.primitive('int'),
  'pydantic.StrictFloat': () => t.primitive('float'),
  'pydantic.StrictBool': () => t.primitive('boolean'),
  'pydantic.StrictBytes': () => t.primitive('bytes'),
  'pydantic.ByteSize': () => t.primitive('int'),
  'pydantic.JsonValue': () => t.unknown(),
  'pydantic.ImportString': () => t.primitive('string'),
};
for (const name of ['PositiveInt', 'NegativeInt', 'NonNegativeInt', 'NonPositiveInt']) {
  PYDANTIC_KNOWN[`pydantic.${name}`] = () => t.primitive('int');
}
for (const name of ['PositiveFloat', 'NegativeFloat', 'NonNegativeFloat', 'NonPositiveFloat', 'FiniteFloat']) {
  PYDANTIC_KNOWN[`pydantic.${name}`] = () => t.primitive('float');
}
for (const name of [
  'AnyUrl',
  'AnyHttpUrl',
  'HttpUrl',
  'FileUrl',
  'FtpUrl',
  'WebsocketUrl',
  'AnyWebsocketUrl',
  'PostgresDsn',
  'MySQLDsn',
  'MariaDBDsn',
  'RedisDsn',
  'MongoDsn',
  'AmqpDsn',
  'KafkaDsn',
  'NatsDsn',
  'CockroachDsn',
  'ClickHouseDsn',
  'SnowflakeDsn',
]) {
  PYDANTIC_KNOWN[`pydantic.${name}`] = () => ({ kind: 'well-known', name: 'url', args: [] });
}
for (const name of ['UUID1', 'UUID3', 'UUID4', 'UUID5', 'UUID6', 'UUID7', 'UUID8']) {
  PYDANTIC_KNOWN[`pydantic.${name}`] = () => ({ kind: 'well-known', name: 'uuid', args: [] });
}
for (const name of ['FutureDate', 'PastDate']) {
  PYDANTIC_KNOWN[`pydantic.${name}`] = () => ({ kind: 'well-known', name: 'date', args: [] });
}
for (const name of ['AwareDatetime', 'NaiveDatetime', 'FutureDatetime', 'PastDatetime']) {
  PYDANTIC_KNOWN[`pydantic.${name}`] = () => ({ kind: 'well-known', name: 'datetime', args: [] });
}
for (const name of ['IPvAnyAddress', 'IPvAnyInterface', 'IPvAnyNetwork']) {
  PYDANTIC_KNOWN[`pydantic.${name}`] = () => ({ kind: 'well-known', name: 'ip-address', args: [] });
}
for (const name of ['FilePath', 'DirectoryPath', 'NewPath', 'SocketPath']) {
  PYDANTIC_KNOWN[`pydantic.${name}`] = () => ({ kind: 'well-known', name: 'path', args: [] });
}
void PYDANTIC_STRING;

/** Constrained-type factories used as annotations: `constr(min_length=1)`. */
const CONSTRAINED_FACTORIES: Record<string, (args: TypeNode[]) => TypeNode> = {
  'pydantic.constr': () => t.primitive('string'),
  'pydantic.conint': () => t.primitive('int'),
  'pydantic.confloat': () => t.primitive('float'),
  'pydantic.conbytes': () => t.primitive('bytes'),
  'pydantic.condecimal': () => ({ kind: 'well-known', name: 'decimal', args: [] }),
  'pydantic.condate': () => ({ kind: 'well-known', name: 'date', args: [] }),
  'pydantic.conlist': (args) => t.array(args[0] ?? t.any()),
  'pydantic.conset': (args) => ({ kind: 'set', element: args[0] ?? t.any(), readonly: false }),
  'pydantic.confrozenset': (args) => ({ kind: 'set', element: args[0] ?? t.any(), readonly: true }),
};

const ALIAS_GENERATORS: Record<string, (name: string) => string> = {
  'pydantic.to_camel': toCamelCase,
  'pydantic.to_lower_camel': toCamelCase,
  'pydantic.to_pascal': toPascalCase,
  'pydantic.to_snake': toSnakeCase,
};

const MSGSPEC_RENAME: Record<string, (name: string) => string> = {
  camel: toCamelCase,
  pascal: toPascalCase,
  lower: (n) => n.toLowerCase(),
  upper: (n) => n.toUpperCase(),
  kebab: (n) => toSnakeCase(n).replace(/_/g, '-'),
};

// ---------------------------------------------------------------------------
// Lowering
// ---------------------------------------------------------------------------

interface TypeVarInfo {
  param: TypeParam;
}

/** What a class statement is, decided before members are lowered so subclasses inherit it. */
type ClassKind = { kind: 'object'; flavor: ObjectFlavor } | { kind: 'enum'; base: EnumBase; mixin?: 'str' | 'int' };

interface TypeContext {
  /** Type parameter names in scope. */
  scope: Set<string>;
  /** Module-level TypeVars referenced, in order of first use: old-style generics are inferred from it. */
  typeVarUses: string[];
  /** Inside a class: the class name, for `Self`. */
  className?: string;
  path?: string;
}

interface Unwrapped {
  type: TypeNode;
  optional?: boolean;
  readonly?: boolean;
  classVar?: boolean;
  initVar?: boolean;
  metadata: PyExpr[];
}

class PythonLowering {
  private readonly diagnostics = new DiagnosticBag();
  /** Local name → canonical qualified name (`t` → `typing`, `L` → `typing.List`). */
  private readonly importNames = new Map<string, string>();
  /** Local names imported from user modules. */
  private readonly userImports = new Map<string, string>();
  /** Local name → the module a user import came from (`.models`, `bson`). */
  private readonly userImportModules = new Map<string, string>();
  private readonly moduleImports: ModuleImport[] = [];
  private readonly typeVars = new Map<string, TypeVarInfo>();
  private readonly classKinds = new Map<string, ClassKind>();
  /** Every name declared at module level, mapped to what kind of declaration it is. */
  private readonly declared = new Map<string, 'class' | 'enum' | 'alias'>();
  private readonly declarations: Declaration[] = [];
  private dunderAll: Set<string> | undefined;
  /** Inheritable pydantic configuration per declared model. */
  private readonly modelConfigs = new Map<string, { rename?: (name: string) => string; frozen: boolean }>();
  private readonly comments: PyModule['comments'];

  private readonly module: PyModule;
  private readonly options: ParsePythonOptions;

  constructor(module: PyModule, options: ParsePythonOptions) {
    this.module = module;
    this.options = options;
    this.comments = module.comments;
  }

  run(): TypeModule {
    const statements = this.flatten(this.module.body);
    for (const stmt of statements) this.collect(stmt);
    this.resolveClassKinds(statements);

    const seen = new Set<string>();
    for (const stmt of statements) {
      const decls = this.lowerStatement(stmt, statements);
      for (const decl of decls) {
        if (seen.has(decl.name)) {
          this.diagnostics.info(
            'suspicious-source',
            `'${decl.name}' is defined more than once; the first definition is used.`,
            {
              loc: decl.loc,
              path: decl.name,
            },
          );
          continue;
        }
        seen.add(decl.name);
        this.declarations.push(decl);
      }
    }

    for (const decl of this.declarations) {
      decl.exported = this.dunderAll ? this.dunderAll.has(decl.name) : !decl.name.startsWith('_');
    }
    return {
      language: 'python',
      declarations: this.declarations,
      imports: this.moduleImports,
      diagnostics: this.diagnostics.items,
    };
  }

  /** Module-level statements, looking through `if TYPE_CHECKING:`, version checks and `try:` import guards. */
  private flatten(body: PyStmt[]): PyStmt[] {
    const out: PyStmt[] = [];
    for (const stmt of body) {
      if (stmt.kind === 'block' && ['if', 'elif', 'else', 'try', 'except', 'finally', 'with'].includes(stmt.keyword)) {
        out.push(...this.flatten(stmt.body));
      } else out.push(stmt);
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Pass 1: names
  // -------------------------------------------------------------------------

  private collect(stmt: PyStmt): void {
    switch (stmt.kind) {
      case 'import':
        for (const { name, asname } of stmt.names) {
          if (asname) this.importNames.set(asname, name);
          else this.importNames.set(name.split('.')[0]!, name.split('.')[0]!);
        }
        return;
      case 'import-from': {
        const library =
          stmt.level === 0 && LIBRARY_MODULES.some((m) => stmt.module === m || stmt.module.startsWith(`${m}.`));
        const userNames: { name: string; alias?: string }[] = [];
        for (const { name, asname } of stmt.names) {
          if (name === '*') continue;
          const local = asname ?? name;
          if (library) this.importNames.set(local, `${stmt.module}.${name}`);
          else {
            this.userImports.set(local, name);
            this.userImportModules.set(local, '.'.repeat(stmt.level) + stmt.module);
            userNames.push(asname ? { name, alias: asname } : { name });
          }
        }
        if (!library && userNames.length) {
          const module = parsePythonModule('.'.repeat(stmt.level) + stmt.module);
          this.moduleImports.push({ module, names: userNames, loc: stmt.loc });
        }
        return;
      }
      case 'class':
        this.declared.set(stmt.name, 'class');
        return;
      case 'type-alias':
        this.declared.set(stmt.name, 'alias');
        return;
      case 'assign':
      case 'annassign': {
        const target = stmt.kind === 'assign' ? stmt.targets[0] : stmt.target;
        if (target?.kind !== 'name') return;
        const value = stmt.value;
        if (target.id === '__all__' && value && (value.kind === 'list' || value.kind === 'tuple')) {
          this.dunderAll = new Set(
            value.elements.flatMap((e) => (e.kind === 'constant' && e.value.type === 'str' ? [e.value.value] : [])),
          );
          return;
        }
        if (value?.kind === 'call') {
          const fn = this.canonical(value.func);
          if (fn === 'typing.TypeVar' || fn === 'typing.ParamSpec' || fn === 'typing.TypeVarTuple') {
            this.typeVars.set(target.id, { param: { name: target.id, kind: 'type', variance: 'invariant' } });
            return;
          }
          if (fn && ENUM_BASES[fn] !== undefined) {
            this.declared.set(target.id, 'enum');
            return;
          }
          if (
            fn === 'typing.NewType' ||
            fn === 'typing.TypedDict' ||
            fn === 'typing.NamedTuple' ||
            fn === 'collections.namedtuple'
          ) {
            this.declared.set(target.id, 'class');
            return;
          }
        }
        if (stmt.kind === 'annassign' && this.canonical(stmt.annotation) === 'typing.TypeAlias') {
          this.declared.set(target.id, 'alias');
          return;
        }
        if (stmt.kind === 'assign' && value && this.isTypeExpression(value)) this.declared.set(target.id, 'alias');
        return;
      }
      default:
        return;
    }
  }

  /** Decides what each class is; a subclass of a declared TypedDict/model/enum is one too. */
  private resolveClassKinds(statements: PyStmt[]): void {
    const classes = statements.filter((s): s is Extract<PyStmt, { kind: 'class' }> => s.kind === 'class');
    for (let changed = true, round = 0; changed && round < 10; round++) {
      changed = false;
      for (const cls of classes) {
        if (this.classKinds.has(cls.name)) continue;
        const kind = this.classKind(cls);
        if (kind) {
          this.classKinds.set(cls.name, kind);
          changed = true;
        }
      }
    }
    for (const cls of classes) {
      if (!this.classKinds.has(cls.name)) this.classKinds.set(cls.name, { kind: 'object', flavor: 'plain-class' });
      if (this.classKinds.get(cls.name)!.kind === 'enum') this.declared.set(cls.name, 'enum');
    }
    // Now that kinds are known, register TypeVar details (bounds may reference classes).
    for (const stmt of statements) {
      if (stmt.kind === 'assign' && stmt.targets[0]?.kind === 'name' && stmt.value.kind === 'call') {
        const info = this.typeVars.get(stmt.targets[0].id);
        if (info) info.param = this.lowerTypeVarCall(stmt.targets[0].id, stmt.value);
      }
    }
  }

  private classKind(cls: Extract<PyStmt, { kind: 'class' }>): ClassKind | undefined {
    const decorators = cls.decorators.map((d) => this.canonical(d.kind === 'call' ? d.func : d));
    let enumBase: EnumBase | undefined;
    let mixin: 'str' | 'int' | undefined;
    let flavor: ObjectFlavor | undefined;
    let pending = false;
    for (const base of cls.bases) {
      const head = this.canonical(base.kind === 'subscript' ? base.value : base);
      if (!head) continue;
      if (ENUM_BASES[head]) enumBase = ENUM_BASES[head];
      else if (head === 'builtins.str') mixin = 'str';
      else if (head === 'builtins.int') mixin = 'int';
      else if (head === 'typing.TypedDict') flavor = 'typeddict';
      else if (head === 'typing.NamedTuple') flavor = 'namedtuple';
      else if (head === 'typing.Protocol') flavor = 'protocol';
      else if (head === 'pydantic.BaseModel' || head === 'pydantic.RootModel' || head === 'sqlmodel.SQLModel') {
        flavor = 'pydantic';
      } else if (head === 'msgspec.Struct') flavor = 'msgspec';
      else if (this.declared.get(head) === 'class' || this.declared.get(head) === 'enum') {
        const inherited = this.classKinds.get(head);
        if (!inherited) pending = true;
        else if (inherited.kind === 'enum') {
          enumBase = inherited.base;
          mixin = inherited.mixin ?? mixin;
        } else if (['typeddict', 'pydantic', 'msgspec'].includes(inherited.flavor)) flavor ??= inherited.flavor;
      }
    }
    if (enumBase) return mixin ? { kind: 'enum', base: enumBase, mixin } : { kind: 'enum', base: enumBase };
    if (flavor) return { kind: 'object', flavor };
    if (decorators.some((d) => d === 'dataclasses.dataclass' || d === 'pydantic.dataclasses.dataclass')) {
      return { kind: 'object', flavor: 'dataclass' };
    }
    if (decorators.some((d) => d && /^attrs\.(define|frozen|mutable|s|attrs|dataclass)$/.test(d))) {
      return { kind: 'object', flavor: 'attrs' };
    }
    if (pending) return undefined;
    return { kind: 'object', flavor: 'plain-class' };
  }

  // -------------------------------------------------------------------------
  // Name resolution
  // -------------------------------------------------------------------------

  /** The canonical qualified name an expression refers to, or the declared/local name. */
  private canonical(expr: PyExpr): string | undefined {
    const dotted = dottedName(expr);
    if (!dotted) return undefined;
    const [head, ...rest] = dotted.split('.');
    let qualified: string;
    if (this.declared.has(dotted) && !this.importNames.has(head!)) return dotted;
    if (this.importNames.has(head!)) qualified = [this.importNames.get(head!)!, ...rest].join('.');
    else if (this.declared.has(head!) || this.typeVars.has(head!) || this.userImports.has(head!)) return dotted;
    else if (rest.length === 0 && BUILTINS.has(head!)) return `builtins.${head}`;
    else if (rest.length === 0 && BARE_NAMES[head!]) qualified = BARE_NAMES[head!]!;
    else qualified = dotted;
    if (SPECIAL_CANONICAL[qualified]) return SPECIAL_CANONICAL[qualified];
    for (const [from, to] of Object.entries(MODULE_ALIASES)) {
      if (qualified.startsWith(`${from}.`)) return `${to}.${qualified.slice(from.length + 1)}`;
    }
    return qualified;
  }

  /** Heuristic for PEP 484 implicit aliases (`Alias = list[int]`): every leaf name must denote a type. */
  private isTypeExpression(expr: PyExpr): boolean {
    switch (expr.kind) {
      case 'name':
      case 'attribute': {
        const name = this.canonical(expr);
        if (!name) return false;
        if (this.declared.has(name) || this.typeVars.has(name)) return true;
        if (name.startsWith('builtins.')) return BUILTINS.has(name.slice(9)) && name !== 'builtins.range';
        if (this.userImports.has(name.split('.')[0]!)) return /^[A-Z]/.test(name.split('.').pop()!);
        return isKnownTypeName(name);
      }
      case 'subscript':
        return this.isTypeExpression(expr.value);
      case 'binop':
        return (
          expr.op === '|' &&
          [expr.left, expr.right].every((side) => isNoneConstant(side) || this.isTypeExpression(side)) &&
          !(isNoneConstant(expr.left) && isNoneConstant(expr.right))
        );
      default:
        return false;
    }
  }

  // -------------------------------------------------------------------------
  // Pass 2: declarations
  // -------------------------------------------------------------------------

  private lowerStatement(stmt: PyStmt, all: PyStmt[]): Declaration[] {
    switch (stmt.kind) {
      case 'class':
        return [this.lowerClass(stmt, all)];
      case 'type-alias': {
        const ctx = this.context(stmt.name);
        const typeParams = this.lowerPep695Params(stmt.typeParams, ctx);
        ctx.scope = new Set(typeParams.map((p) => p.name));
        const type = this.lowerType(stmt.value, ctx);
        return [
          this.withDoc({ kind: 'alias', name: stmt.name, typeParams, type, exported: true, loc: stmt.loc }, stmt, all),
        ];
      }
      case 'annassign': {
        if (stmt.target.kind !== 'name' || !stmt.value) return [];
        if (this.canonical(stmt.annotation) !== 'typing.TypeAlias') return [];
        return [this.lowerImplicitAlias(stmt.target.id, stmt.value, stmt, all)];
      }
      case 'assign': {
        const target = stmt.targets[0];
        if (target?.kind !== 'name' || stmt.targets.length !== 1) return [];
        if (stmt.value.kind === 'call') {
          const fn = this.canonical(stmt.value.func);
          if (fn === 'typing.NewType') return this.lowerNewType(target.id, stmt.value, stmt, all);
          if (fn === 'typing.TypedDict') return this.lowerFunctionalTypedDict(target.id, stmt.value, stmt, all);
          if (fn === 'typing.NamedTuple' || fn === 'collections.namedtuple') {
            return this.lowerFunctionalNamedTuple(target.id, stmt.value, fn, stmt, all);
          }
          if (fn && ENUM_BASES[fn]) return this.lowerFunctionalEnum(target.id, stmt.value, ENUM_BASES[fn], stmt, all);
          return [];
        }
        if (this.declared.get(target.id) !== 'alias') return [];
        return [this.lowerImplicitAlias(target.id, stmt.value, stmt, all)];
      }
      default:
        return [];
    }
  }

  private context(path: string, className?: string): TypeContext {
    const ctx: TypeContext = { scope: new Set(), typeVarUses: [], path };
    if (className) ctx.className = className;
    return ctx;
  }

  private lowerImplicitAlias(name: string, value: PyExpr, stmt: PyStmt, all: PyStmt[]): Declaration {
    const ctx = this.context(name);
    const type = this.lowerType(value, ctx);
    const typeParams = this.inferTypeParams(ctx.typeVarUses);
    return this.withDoc({ kind: 'alias', name, typeParams, type, exported: true, loc: stmt.loc }, stmt, all);
  }

  /** Old-style generics: the TypeVars an alias or class uses, in order of first appearance. */
  private inferTypeParams(uses: string[]): TypeParam[] {
    return [...new Set(uses)].map((name) => this.typeVars.get(name)!.param);
  }

  private lowerTypeVarCall(name: string, call: Extract<PyExpr, { kind: 'call' }>): TypeParam {
    const fn = this.canonical(call.func);
    const kind: TypeParam['kind'] =
      fn === 'typing.ParamSpec' ? 'param-spec' : fn === 'typing.TypeVarTuple' ? 'type-var-tuple' : 'type';
    const ctx = this.context(name);
    let variance: Variance = 'invariant';
    const param: TypeParam = { name, kind, variance };
    const constraints = call.args.slice(1).map((a) => this.lowerType(a, ctx));
    if (constraints.length) param.constraints = constraints;
    for (const kw of call.keywords) {
      if (kw.name === 'bound') param.bound = this.lowerType(kw.value, ctx);
      else if (kw.name === 'default') param.default = this.lowerType(kw.value, ctx);
      else if (kw.name === 'covariant' && isTrue(kw.value)) variance = 'covariant';
      else if (kw.name === 'contravariant' && isTrue(kw.value)) variance = 'contravariant';
      else if (kw.name === 'infer_variance' && isTrue(kw.value)) variance = 'inferred';
    }
    param.variance = variance;
    return param;
  }

  private lowerPep695Params(params: PyTypeParam[], ctx: TypeContext): TypeParam[] {
    const names = new Set(params.map((p) => p.name));
    const inner: TypeContext = { ...ctx, scope: new Set([...ctx.scope, ...names]) };
    return params.map((p) => {
      const param: TypeParam = {
        name: p.name,
        kind: p.kind,
        variance: 'inferred',
      };
      if (p.bound) {
        // `T: (int, str)` is a constrained TypeVar; `T: int` a bound.
        if (p.bound.kind === 'tuple' && p.bound.parenthesized) {
          param.constraints = p.bound.elements.map((e) => this.lowerType(e, inner));
        } else param.bound = this.lowerType(p.bound, inner);
      }
      if (p.default) param.default = this.lowerType(p.default, inner);
      return param;
    });
  }

  private lowerNewType(
    name: string,
    call: Extract<PyExpr, { kind: 'call' }>,
    stmt: PyStmt,
    all: PyStmt[],
  ): Declaration[] {
    const base = call.args[1];
    const ctx = this.context(name);
    const type = base ? this.lowerType(base, ctx) : t.any();
    return [this.withDoc({ kind: 'newtype', name, typeParams: [], type, exported: true, loc: stmt.loc }, stmt, all)];
  }

  private lowerFunctionalTypedDict(
    name: string,
    call: Extract<PyExpr, { kind: 'call' }>,
    stmt: PyStmt,
    all: PyStmt[],
  ): Declaration[] {
    const ctx = this.context(name);
    const total = !call.keywords.some((k) => k.name === 'total' && isFalse(k.value));
    const fields = call.args[1];
    const members: Member[] = [];
    if (fields?.kind === 'dict') {
      for (const entry of fields.entries) {
        if (entry.key?.kind !== 'constant' || entry.key.value.type !== 'str') continue;
        const key = entry.key.value.value;
        const unwrapped = this.unwrapAnnotation(entry.value, { ...ctx, path: `${name}.${key}` });
        const prop: PropertyMember = {
          kind: 'property',
          name: key,
          type: unwrapped.type,
          optional: unwrapped.optional ?? !total,
          readonly: unwrapped.readonly ?? false,
          loc: entry.key.loc,
        };
        members.push(prop);
      }
    } else {
      // Keyword syntax: TypedDict("X", a=int) (deprecated, removed in 3.13).
      for (const kw of call.keywords) {
        if (!kw.name || kw.name === 'total') continue;
        members.push({
          kind: 'property',
          name: kw.name,
          type: this.lowerType(kw.value, ctx),
          optional: !total,
          readonly: false,
        });
      }
    }
    const decl = this.objectDecl(name, 'typeddict', stmt.loc);
    decl.members = members;
    decl.total = total;
    return [this.withDoc(decl, stmt, all)];
  }

  private lowerFunctionalNamedTuple(
    name: string,
    call: Extract<PyExpr, { kind: 'call' }>,
    fn: string,
    stmt: PyStmt,
    all: PyStmt[],
  ): Declaration[] {
    const ctx = this.context(name);
    const fields = call.args[1];
    const members: Member[] = [];
    const add = (field: string, type: TypeNode): void => {
      members.push({ kind: 'property', name: field, type, optional: false, readonly: true });
    };
    if (fields?.kind === 'list' || fields?.kind === 'tuple') {
      for (const el of fields.elements) {
        if (el.kind === 'constant' && el.value.type === 'str') add(el.value.value, t.any());
        else if (el.kind === 'tuple' && el.elements[0]?.kind === 'constant' && el.elements[0].value.type === 'str') {
          add(el.elements[0].value.value, el.elements[1] ? this.lowerType(el.elements[1], ctx) : t.any());
        }
      }
    } else if (fields?.kind === 'constant' && fields.value.type === 'str') {
      for (const field of fields.value.value.split(/[\s,]+/).filter(Boolean)) add(field, t.any());
    }
    if (fn === 'collections.namedtuple' && members.length) {
      this.diagnostics.info('lossy-conversion', `collections.namedtuple '${name}' has untyped fields; they are Any.`, {
        loc: stmt.loc,
        path: name,
      });
    }
    const decl = this.objectDecl(name, 'namedtuple', stmt.loc);
    decl.members = members;
    decl.frozen = true;
    return [this.withDoc(decl, stmt, all)];
  }

  private lowerFunctionalEnum(
    name: string,
    call: Extract<PyExpr, { kind: 'call' }>,
    base: EnumBase,
    stmt: PyStmt,
    all: PyStmt[],
  ): Declaration[] {
    const spec = call.args[1];
    const members: EnumMember[] = [];
    const auto = autoGenerator(base, undefined);
    const addAuto = (memberName: string): void => {
      members.push({ name: memberName, value: auto(memberName) });
    };
    if (spec?.kind === 'constant' && spec.value.type === 'str') {
      spec.value.value
        .split(/[\s,]+/)
        .filter(Boolean)
        .forEach(addAuto);
    } else if (spec?.kind === 'list' || spec?.kind === 'tuple') {
      for (const el of spec.elements) {
        if (el.kind === 'constant' && el.value.type === 'str') addAuto(el.value.value);
        else if (el.kind === 'tuple' && el.elements[0]?.kind === 'constant' && el.elements[0].value.type === 'str') {
          members.push({ name: el.elements[0].value.value, value: constantValue(el.elements[1]) ?? null });
        }
      }
    } else if (spec?.kind === 'dict') {
      for (const entry of spec.entries) {
        if (entry.key?.kind === 'constant' && entry.key.value.type === 'str') {
          members.push({ name: entry.key.value.value, value: constantValue(entry.value) ?? null });
        }
      }
    }
    return [this.withDoc(this.enumDecl(name, base, undefined, members, stmt.loc), stmt, all)];
  }

  private objectDecl(name: string, flavor: ObjectFlavor, loc: SourceLocation): ObjectDeclaration {
    return {
      kind: 'object',
      name,
      flavor,
      typeParams: [],
      bases: [],
      members: [],
      indexSignatures: [],
      callSignatures: [],
      exported: true,
      loc,
    };
  }

  private enumDecl(
    name: string,
    base: EnumBase,
    mixin: 'str' | 'int' | undefined,
    members: EnumMember[],
    loc: SourceLocation,
  ): EnumDeclaration {
    let flavor: EnumFlavor;
    if (base === 'flag' || base === 'int-flag') flavor = 'flag';
    else if (members.length && members.every((m) => typeof m.value === 'string')) flavor = 'string';
    else if (members.length && members.every((m) => typeof m.value === 'number')) flavor = 'number';
    else if (base === 'str' || mixin === 'str') flavor = 'string';
    else if (base === 'int' || mixin === 'int') flavor = 'number';
    else flavor = 'mixed';
    return { kind: 'enum', name, flavor, members, typeParams: [], exported: true, loc };
  }

  /** Docs for a module-level statement: a docstring right after it (as Sphinx reads), or `#:` comments. */
  private withDoc<D extends Declaration>(decl: D, stmt: PyStmt, all: PyStmt[]): D {
    const doc = this.attributeDoc(stmt, all);
    if (doc) decl.doc = doc;
    return decl;
  }

  private attributeDoc(stmt: PyStmt, siblings: PyStmt[]): Doc | undefined {
    const index = siblings.indexOf(stmt);
    const next = siblings[index + 1];
    if (next?.kind === 'expr' && next.value.kind === 'constant' && next.value.value.type === 'str') {
      return docFromText(next.value.value.value);
    }
    // `#: text` on the line(s) above, or trailing on the same line.
    const lines: string[] = [];
    for (let line = stmt.loc.line - 1; line > 0; line--) {
      const comment = this.comments.get(line);
      if (!comment?.ownLine || !comment.text.startsWith(':')) break;
      lines.unshift(comment.text.slice(1).trim());
    }
    const trailing = this.comments.get(stmt.loc.line);
    if (!lines.length && trailing && !trailing.ownLine && trailing.text.startsWith(':'))
      lines.push(trailing.text.slice(1).trim());
    return lines.length ? docFromText(lines.join('\n')) : undefined;
  }

  // -------------------------------------------------------------------------
  // Classes
  // -------------------------------------------------------------------------

  private lowerClass(cls: Extract<PyStmt, { kind: 'class' }>, all: PyStmt[]): Declaration {
    const kind = this.classKinds.get(cls.name)!;
    const docstring = classDocstring(cls.body);
    let decl: Declaration;
    if (kind.kind === 'enum') decl = this.lowerEnumClass(cls, kind.base, kind.mixin);
    else decl = this.lowerObjectClass(cls, kind.flavor);

    const doc = docstring ? docFromText(docstring) : this.attributeDoc(cls, all);
    const deprecated = this.deprecation(cls.decorators);
    if (doc || deprecated !== undefined) {
      decl.doc = doc ?? { text: '', tags: [] };
      if (deprecated !== undefined) decl.doc.deprecated = deprecated;
    }
    return decl;
  }

  /** `@deprecated("msg")` (PEP 702) → its message. */
  private deprecation(decorators: PyExpr[]): string | undefined {
    for (const d of decorators) {
      const name = this.canonical(d.kind === 'call' ? d.func : d);
      if (name === 'typing.deprecated' || name === 'warnings.deprecated') {
        const arg = d.kind === 'call' ? d.args[0] : undefined;
        return arg?.kind === 'constant' && arg.value.type === 'str' ? arg.value.value : '';
      }
    }
    return undefined;
  }

  private lowerEnumClass(
    cls: Extract<PyStmt, { kind: 'class' }>,
    base: EnumBase,
    mixin: 'str' | 'int' | undefined,
  ): EnumDeclaration {
    const members: EnumMember[] = [];
    const ignore = new Set<string>();
    const auto = autoGenerator(base, mixin);
    const values = new Map<string, string | number | boolean | null>();
    for (const stmt of cls.body) {
      if (stmt.kind === 'assign' && stmt.targets[0]?.kind === 'name' && stmt.targets[0].id === '_ignore_') {
        const v = stmt.value;
        if (v.kind === 'constant' && v.value.type === 'str') v.value.value.split(/\s+/).forEach((n) => ignore.add(n));
        if (v.kind === 'list')
          v.elements.forEach((e) => e.kind === 'constant' && e.value.type === 'str' && ignore.add(e.value.value));
      }
    }
    for (const stmt of cls.body) {
      const target = stmt.kind === 'assign' ? stmt.targets[0] : stmt.kind === 'annassign' ? stmt.target : undefined;
      const value = stmt.kind === 'assign' || stmt.kind === 'annassign' ? stmt.value : undefined;
      if (target?.kind !== 'name' || !value) continue;
      const name = target.id;
      if (/^__.*__$/.test(name) || /^_[^_].*_$/.test(name) || ignore.has(name)) continue;
      let expr = value;
      if (expr.kind === 'call') {
        const fn = this.canonical(expr.func);
        if (fn === 'enum.nonmember') continue;
        if (fn === 'enum.member' && expr.args[0]) expr = expr.args[0];
      }
      let memberValue: string | number | boolean | null;
      if (expr.kind === 'call' && this.canonical(expr.func) === 'enum.auto') memberValue = auto(name);
      else {
        const evaluated = evaluateEnumValue(expr, values);
        if (evaluated === undefined) {
          this.diagnostics.warn(
            'unsupported-type',
            `Enum member ${cls.name}.${name} has a value that is not a literal; it is emitted as null.`,
            {
              loc: stmt.loc,
              path: `${cls.name}.${name}`,
            },
          );
          memberValue = null;
        } else memberValue = evaluated;
        auto.observe(memberValue);
      }
      values.set(name, memberValue);
      const member: EnumMember = { name, value: memberValue, loc: stmt.loc };
      const doc = this.attributeDoc(stmt, cls.body);
      if (doc) member.doc = doc;
      members.push(member);
    }
    return this.enumDecl(cls.name, base, mixin, members, cls.loc);
  }

  private lowerObjectClass(cls: Extract<PyStmt, { kind: 'class' }>, flavor: ObjectFlavor): Declaration {
    const ctx = this.context(cls.name, cls.name);
    const decl = this.objectDecl(cls.name, flavor, cls.loc);

    // Type parameters: PEP 695 brackets, or Generic[...] / Protocol[...], or TypeVars in base order.
    let explicit: string[] | undefined;
    if (cls.typeParams.length) {
      decl.typeParams = this.lowerPep695Params(cls.typeParams, ctx);
      ctx.scope = new Set(decl.typeParams.map((p) => p.name));
    }
    for (const base of cls.bases) {
      if (base.kind === 'starred') continue;
      const head = this.canonical(base.kind === 'subscript' ? base.value : base);
      if ((head === 'typing.Generic' || head === 'typing.Protocol') && base.kind === 'subscript') {
        explicit = subscriptArgs(base).flatMap((a) => {
          const inner = a.kind === 'starred' ? a.value : a;
          return inner.kind === 'name' ? [inner.id] : [];
        });
        continue;
      }
      if (
        head === 'typing.Generic' ||
        head === 'typing.Protocol' ||
        head === 'typing.TypedDict' ||
        head === 'typing.NamedTuple' ||
        head === 'pydantic.BaseModel' ||
        head === 'msgspec.Struct' ||
        head === 'abc.ABC' ||
        head === 'builtins.object' ||
        head === 'sqlmodel.SQLModel'
      ) {
        continue;
      }
      if (head === 'pydantic.RootModel') {
        // `class Tags(RootModel[list[str]])` serializes as its root: an alias.
        const root = base.kind === 'subscript' ? this.lowerType(base.index, ctx) : t.any();
        return {
          kind: 'alias',
          name: cls.name,
          typeParams: this.inferTypeParams(ctx.typeVarUses),
          type: root,
          exported: true,
          loc: cls.loc,
        };
      }
      decl.bases.push(this.lowerType(base, ctx));
    }
    if (!cls.typeParams.length) {
      const names = explicit ?? [...new Set(ctx.typeVarUses)];
      decl.typeParams = names.filter((n) => this.typeVars.has(n)).map((n) => this.typeVars.get(n)!.param);
      ctx.scope = new Set(decl.typeParams.map((p) => p.name));
    }
    ctx.typeVarUses = [];

    // Class keywords: TypedDict total/closed/extra_items, pydantic/msgspec config.
    let rename: ((name: string) => string) | undefined;
    for (const kw of cls.keywords) {
      if (kw.name === 'total') decl.total = !isFalse(kw.value);
      else if (kw.name === 'closed' && isTrue(kw.value)) decl.closed = true;
      else if (kw.name === 'extra_items') decl.extraItems = this.lowerType(kw.value, ctx);
      else if (kw.name === 'frozen' && isTrue(kw.value)) decl.frozen = true;
      else if (kw.name === 'metaclass' && this.canonical(kw.value) === 'abc.ABCMeta') decl.abstract = true;
      else if (kw.name === 'extra') this.applyExtra(decl, kw.value);
      else if (
        kw.name === 'rename' &&
        flavor === 'msgspec' &&
        kw.value.kind === 'constant' &&
        kw.value.value.type === 'str'
      ) {
        rename = MSGSPEC_RENAME[kw.value.value.value];
      } else if (kw.name === 'alias_generator') rename = this.aliasGenerator(kw.value, cls.name);
    }
    if (cls.bases.some((b) => this.canonical(b) === 'abc.ABC')) decl.abstract = true;
    for (const d of cls.decorators) {
      if (d.kind === 'call' && (flavor === 'dataclass' || flavor === 'attrs')) {
        for (const kw of d.keywords) if (kw.name === 'frozen' && isTrue(kw.value)) decl.frozen = true;
      }
      const name = this.canonical(d.kind === 'call' ? d.func : d);
      if (name === 'attrs.frozen') decl.frozen = true;
    }
    if (flavor === 'namedtuple') decl.frozen = true;
    if (flavor === 'pydantic') {
      rename = this.pydanticConfig(cls, decl, ctx) ?? rename;
      // model_config is inherited: a shared `ApiModel` base usually carries the alias generator.
      for (const base of cls.bases) {
        const inherited = this.modelConfigs.get(this.canonical(base) ?? '');
        if (!inherited) continue;
        rename ??= inherited.rename;
        if (inherited.frozen) decl.frozen = true;
      }
      this.modelConfigs.set(cls.name, { ...(rename ? { rename } : {}), frozen: decl.frozen === true });
    }

    this.lowerClassBody(cls, decl, flavor, ctx);

    if (rename) {
      for (const member of decl.members) {
        if (member.kind === 'property' && member.alias === undefined) {
          const alias = rename(member.name);
          if (alias !== member.name) member.alias = alias;
        }
      }
    }
    if (decl.frozen) for (const m of decl.members) if (m.kind === 'property') m.readonly = true;
    return decl;
  }

  private applyExtra(decl: ObjectDeclaration, value: PyExpr): void {
    const text =
      value.kind === 'constant' && value.value.type === 'str' ? value.value.value : dottedName(value)?.split('.').pop();
    if (text === 'forbid') decl.closed = true;
    else if (text === 'allow') decl.extraItems = t.unknown();
  }

  private aliasGenerator(value: PyExpr, path: string): ((name: string) => string) | undefined {
    let fn = value;
    // AliasGenerator(serialization_alias=to_camel) / AliasGenerator(alias=...)
    if (fn.kind === 'call' && this.canonical(fn.func) === 'pydantic.AliasGenerator') {
      const kw =
        fn.keywords.find((k) => k.name === 'serialization_alias') ?? fn.keywords.find((k) => k.name === 'alias');
      if (!kw) return undefined;
      fn = kw.value;
    }
    const name = this.canonical(fn);
    if (name && ALIAS_GENERATORS[name]) return ALIAS_GENERATORS[name];
    this.diagnostics.warn(
      'unsupported-syntax',
      `alias_generator ${dottedName(fn) ?? 'expression'} is not recognized; field names are used as written.`,
      {
        loc: value.loc,
        path,
      },
    );
    return undefined;
  }

  /** `model_config = ConfigDict(...)` / `{...}` and pydantic v1 `class Config:`. Returns an alias generator. */
  private pydanticConfig(
    cls: Extract<PyStmt, { kind: 'class' }>,
    decl: ObjectDeclaration,
    _ctx: TypeContext,
  ): ((name: string) => string) | undefined {
    let rename: ((name: string) => string) | undefined;
    const apply = (key: string, value: PyExpr): void => {
      if (key === 'alias_generator') rename = this.aliasGenerator(value, cls.name);
      else if (key === 'frozen' && isTrue(value)) decl.frozen = true;
      else if ((key === 'allow_mutation' || key === 'mutable') && isFalse(value)) decl.frozen = true;
      else if (key === 'extra') this.applyExtra(decl, value);
    };
    for (const stmt of cls.body) {
      if (stmt.kind === 'assign' && stmt.targets[0]?.kind === 'name' && stmt.targets[0].id === 'model_config') {
        const v = stmt.value;
        if (v.kind === 'call') v.keywords.forEach((kw) => kw.name && apply(kw.name, kw.value));
        if (v.kind === 'dict') {
          for (const e of v.entries)
            if (e.key?.kind === 'constant' && e.key.value.type === 'str') apply(e.key.value.value, e.value);
        }
      }
      if (stmt.kind === 'class' && stmt.name === 'Config') {
        for (const inner of stmt.body) {
          if (inner.kind === 'assign' && inner.targets[0]?.kind === 'name') apply(inner.targets[0].id, inner.value);
        }
      }
    }
    return rename;
  }

  private lowerClassBody(
    cls: Extract<PyStmt, { kind: 'class' }>,
    decl: ObjectDeclaration,
    flavor: ObjectFlavor,
    ctx: TypeContext,
  ): void {
    const dataFlavor = ['typeddict', 'dataclass', 'pydantic', 'attrs', 'msgspec', 'namedtuple'].includes(flavor);
    const methods = new Map<
      string,
      { overloads: FunctionType[]; impl?: FunctionType; doc?: Doc; static: boolean; loc: SourceLocation }
    >();
    const properties = new Map<string, PropertyMember>();
    const setters = new Set<string>();
    let kwOnlyMarker = false;

    for (const stmt of cls.body) {
      if (stmt.kind === 'annassign' && stmt.target.kind === 'name') {
        const name = stmt.target.id;
        const path = `${cls.name}.${name}`;
        if (name === 'model_config') continue;
        if (this.canonical(stmt.annotation) === 'dataclasses.KW_ONLY') {
          kwOnlyMarker = true;
          continue;
        }
        const unwrapped = this.unwrapAnnotation(stmt.annotation, { ...ctx, path });
        if (unwrapped.initVar) continue;
        if (flavor === 'pydantic' && name.startsWith('_')) continue;
        if (!dataFlavor && name.startsWith('_') && !this.options.includePrivate) continue;
        const prop: PropertyMember = {
          kind: 'property',
          name,
          type: unwrapped.type,
          optional: flavor === 'typeddict' ? (unwrapped.optional ?? decl.total === false) : false,
          readonly: unwrapped.readonly ?? false,
          loc: stmt.loc,
        };
        if (unwrapped.classVar) prop.static = true;
        // `x: Final = 3` infers the literal's type.
        if (isPrimitiveAny(unwrapped.type) && unwrapped.readonly && stmt.value) {
          const inferred = inferFromValue(stmt.value);
          if (inferred) prop.type = inferred;
        }
        this.applyFieldSpec(prop, stmt.value, unwrapped.metadata, flavor, path);
        const doc = this.attributeDoc(stmt, cls.body);
        if (doc) prop.doc = mergeDocs(prop.doc, doc);
        properties.set(name, prop);
        continue;
      }
      if (stmt.kind === 'def') {
        this.collectMethod(stmt, cls, ctx, methods, properties, setters, flavor, dataFlavor);
      }
    }
    void kwOnlyMarker;

    // Plain classes also declare attributes in __init__ (`self.x: int = x`).
    if (flavor === 'plain-class' || flavor === 'protocol') {
      const init = cls.body.find(
        (s): s is Extract<PyStmt, { kind: 'def' }> => s.kind === 'def' && s.name === '__init__',
      );
      if (init) this.collectInitAttributes(init, cls.name, ctx, properties);
    }

    for (const name of setters) {
      const prop = properties.get(name);
      if (prop) prop.readonly = false;
    }
    decl.members.push(...properties.values());

    for (const [name, info] of methods) {
      const signatures = info.overloads.length ? info.overloads : info.impl ? [info.impl] : [];
      if (!signatures.length) continue;
      if (name === '__call__') {
        decl.callSignatures.push(...signatures);
        continue;
      }
      const method: MethodMember = { kind: 'method', name, signatures, optional: false, loc: info.loc };
      if (info.static) method.static = true;
      if (info.doc) method.doc = info.doc;
      decl.members.push(method);
    }
  }

  private collectMethod(
    stmt: Extract<PyStmt, { kind: 'def' }>,
    cls: Extract<PyStmt, { kind: 'class' }>,
    ctx: TypeContext,
    methods: Map<
      string,
      { overloads: FunctionType[]; impl?: FunctionType; doc?: Doc; static: boolean; loc: SourceLocation }
    >,
    properties: Map<string, PropertyMember>,
    setters: Set<string>,
    flavor: ObjectFlavor,
    dataFlavor: boolean,
  ): void {
    const decorators = stmt.decorators.map((d) => ({ expr: d, name: this.canonical(d.kind === 'call' ? d.func : d) }));
    const has = (...names: string[]): boolean => decorators.some((d) => d.name !== undefined && names.includes(d.name));
    const path = `${cls.name}.${stmt.name}`;
    const doc = classDocstring(stmt.body);

    // `@x.setter` / `@x.deleter`
    const accessor = decorators.find((d) => d.expr.kind === 'attribute' && ['setter', 'deleter'].includes(d.expr.attr));
    if (accessor?.expr.kind === 'attribute') {
      if (accessor.expr.attr === 'setter' && accessor.expr.value.kind === 'name') setters.add(accessor.expr.value.id);
      return;
    }

    if (has('builtins.property', 'functools.cached_property', 'pydantic.computed_field')) {
      if (stmt.name.startsWith('_') && !this.options.includePrivate) return;
      const fn = this.lowerSignature(stmt, ctx, path, 'self');
      const prop: PropertyMember = {
        kind: 'property',
        name: stmt.name,
        type: fn.returns,
        optional: false,
        readonly: true,
        loc: stmt.loc,
      };
      // Only `@computed_field` properties are serialized by pydantic; dataclass properties are not in asdict().
      if (!has('pydantic.computed_field') && dataFlavor) prop.excludeFromJson = true;
      if (doc) prop.doc = docFromText(doc);
      const deprecated = this.deprecation(stmt.decorators);
      if (deprecated !== undefined) prop.doc = { ...(prop.doc ?? { text: '', tags: [] }), deprecated };
      properties.set(stmt.name, prop);
      return;
    }

    // Data classes describe data: their methods are behaviour, not shape.
    if (dataFlavor && stmt.name !== '__call__') return;
    if (stmt.name.startsWith('__') && stmt.name.endsWith('__') && stmt.name !== '__call__') return;
    if (stmt.name.startsWith('_') && !stmt.name.startsWith('__') && !this.options.includePrivate) return;
    void flavor;

    const isStatic = has('builtins.staticmethod');
    const isClass = has('builtins.classmethod');
    const fn = this.lowerSignature(stmt, ctx, path, isStatic ? undefined : isClass ? 'cls' : 'self');
    const entry = methods.get(stmt.name) ?? { overloads: [], static: isStatic || isClass, loc: stmt.loc };
    if (has('typing.overload')) entry.overloads.push(fn);
    else entry.impl = fn;
    const methodDoc = doc ? docFromText(doc) : undefined;
    const deprecated = this.deprecation(stmt.decorators);
    if (methodDoc || deprecated !== undefined) {
      entry.doc = methodDoc ?? { text: '', tags: [] };
      if (deprecated !== undefined) entry.doc.deprecated = deprecated;
    }
    methods.set(stmt.name, entry);
  }

  private collectInitAttributes(
    init: Extract<PyStmt, { kind: 'def' }>,
    className: string,
    ctx: TypeContext,
    properties: Map<string, PropertyMember>,
  ): void {
    const params = new Map(init.params.map((p) => [p.name, p]));
    const visit = (body: PyStmt[]): void => {
      for (const stmt of body) {
        if (stmt.kind === 'block') {
          visit(stmt.body);
          continue;
        }
        const target = stmt.kind === 'annassign' ? stmt.target : stmt.kind === 'assign' ? stmt.targets[0] : undefined;
        if (target?.kind !== 'attribute' || target.value.kind !== 'name' || target.value.id !== 'self') continue;
        const name = target.attr;
        if (properties.has(name) || (name.startsWith('_') && !this.options.includePrivate)) continue;
        const path = `${className}.${name}`;
        let type: TypeNode | undefined;
        let readonly = false;
        if (stmt.kind === 'annassign') {
          const unwrapped = this.unwrapAnnotation(stmt.annotation, { ...ctx, path });
          type = unwrapped.type;
          readonly = unwrapped.readonly ?? false;
        } else if (stmt.kind === 'assign') {
          const value = stmt.value;
          const param = value.kind === 'name' ? params.get(value.id) : undefined;
          if (param?.annotation) type = this.lowerType(param.annotation, { ...ctx, path });
          else type = inferFromValue(value);
        }
        if (!type) continue;
        properties.set(name, { kind: 'property', name, type, optional: false, readonly, loc: stmt.loc });
      }
    };
    visit(init.body);
  }

  /** Reads `= field(...)`, `= Field(...)`, `Annotated[..., Field(...)]` and plain defaults into a property. */
  private applyFieldSpec(
    prop: PropertyMember,
    value: PyExpr | undefined,
    metadata: PyExpr[],
    flavor: ObjectFlavor,
    path: string,
  ): void {
    const specs: PyExpr[] = [...metadata];
    if (value) specs.push(value);
    for (const spec of specs) {
      const isValue = spec === value;
      if (spec.kind === 'call') {
        const fn = this.canonical(spec.func);
        if (
          fn === 'pydantic.Field' ||
          fn === 'dataclasses.field' ||
          fn === 'attrs.field' ||
          fn === 'attrs.ib' ||
          fn === 'msgspec.field'
        ) {
          this.applyFieldCall(prop, spec, fn, isValue, flavor, path);
          continue;
        }
        if (fn === 'pydantic.PrivateAttr') {
          prop.excludeFromJson = true;
          continue;
        }
      }
      if (isValue) prop.default = this.defaultValue(spec);
    }
  }

  private applyFieldCall(
    prop: PropertyMember,
    call: Extract<PyExpr, { kind: 'call' }>,
    fn: string,
    isValue: boolean,
    flavor: ObjectFlavor,
    path: string,
  ): void {
    const first = call.args[0];
    if (fn === 'pydantic.Field' && first && isValue && !isEllipsis(first)) prop.default = this.defaultValue(first);
    let alias: string | undefined;
    let serializationAlias: string | undefined;
    for (const kw of call.keywords) {
      const str = kw.value.kind === 'constant' && kw.value.value.type === 'str' ? kw.value.value.value : undefined;
      switch (kw.name) {
        case 'default':
          if (isValue && !isEllipsis(kw.value)) prop.default = this.defaultValue(kw.value);
          break;
        case 'default_factory':
        case 'factory':
          if (isValue) prop.default = { kind: 'factory', text: exprText(kw.value) };
          break;
        case 'alias':
        case 'name':
          if (str !== undefined) alias = str;
          break;
        case 'serialization_alias':
          if (str !== undefined) serializationAlias = str;
          break;
        case 'description':
          if (str !== undefined) prop.doc = mergeDocs(prop.doc, docFromText(str));
          break;
        case 'deprecated':
          if (str !== undefined || isTrue(kw.value))
            prop.doc = { ...(prop.doc ?? { text: '', tags: [] }), deprecated: str ?? '' };
          break;
        case 'exclude':
          if (isTrue(kw.value)) prop.excludeFromJson = true;
          break;
        case 'frozen':
          if (isTrue(kw.value)) prop.readonly = true;
          break;
        default:
          // init=, kw_only=, repr=, validation_alias= ... do not change the shape.
          break;
      }
    }
    void flavor;
    void path;
    const wire = serializationAlias ?? alias;
    if (wire !== undefined && wire !== prop.name) prop.alias = wire;
  }

  private defaultValue(expr: PyExpr): DefaultValue {
    const value = constantValue(expr);
    if (value !== undefined) return { kind: 'literal', value, text: exprText(expr) };
    return { kind: 'expression', text: exprText(expr), language: 'python' };
  }

  // -------------------------------------------------------------------------
  // Signatures
  // -------------------------------------------------------------------------

  private lowerSignature(
    stmt: Extract<PyStmt, { kind: 'def' }>,
    classCtx: TypeContext,
    path: string,
    receiver: 'self' | 'cls' | undefined,
  ): FunctionType {
    const ctx: TypeContext = { ...classCtx, typeVarUses: [], path };
    let typeParams: TypeParam[] = [];
    if (stmt.typeParams.length) {
      typeParams = this.lowerPep695Params(stmt.typeParams, ctx);
      ctx.scope = new Set([...ctx.scope, ...typeParams.map((p) => p.name)]);
    }
    let params = stmt.params;
    if (receiver && params[0] && params[0].kind !== 'var-positional' && params[0].kind !== 'var-keyword')
      params = params.slice(1);
    const lowered = params.map((p) => this.lowerParam(p, ctx));
    let returns: TypeNode = stmt.returns
      ? asReturnType(this.lowerType(stmt.returns, ctx))
      : stmt.name === '__init__'
        ? t.primitive('void')
        : t.any();
    if (stmt.async) returns = { kind: 'well-known', name: 'awaitable', args: [returns] };
    // Old-style TypeVars not bound by the class are scoped to the method.
    if (!stmt.typeParams.length) {
      typeParams = [...new Set(ctx.typeVarUses)]
        .filter((n) => !classCtx.scope.has(n))
        .map((n) => this.typeVars.get(n)!.param);
    }
    const fn: FunctionType = { kind: 'function', params: lowered, returns, typeParams };
    if (stmt.async) fn.async = true;
    return fn;
  }

  private lowerParam(p: PyParam, ctx: TypeContext): Parameter {
    let type: TypeNode = t.any();
    let unpacked = false;
    if (p.annotation) {
      let annotation = p.annotation;
      // `**kwargs: Unpack[TD]` and `*args: *Ts`
      if (annotation.kind === 'subscript' && this.canonical(annotation.value) === 'typing.Unpack') {
        annotation = annotation.index;
        unpacked = true;
      } else if (annotation.kind === 'starred') {
        annotation = annotation.value;
        unpacked = true;
      }
      type = this.lowerType(annotation, ctx);
    }
    const param: Parameter = { name: p.name, type, optional: p.default !== undefined, kind: p.kind };
    if (p.default) param.defaultText = exprText(p.default);
    if (unpacked) param.unpacked = true;
    return param;
  }

  // -------------------------------------------------------------------------
  // Type expressions
  // -------------------------------------------------------------------------

  /** Strips member-level qualifiers (`Annotated`, `Required`, `NotRequired`, `ReadOnly`, `ClassVar`, `Final`, `InitVar`). */
  private unwrapAnnotation(expr: PyExpr, ctx: TypeContext): Unwrapped {
    const result: Unwrapped = { type: t.any(), metadata: [] };
    let current: PyExpr | undefined = expr;
    for (let guard = 0; current && guard < 20; guard++) {
      const head = this.canonical(current.kind === 'subscript' ? current.value : current);
      const inner: PyExpr | undefined = current.kind === 'subscript' ? current.index : undefined;
      if (head === 'typing.Annotated' && inner) {
        const [first, ...meta]: PyExpr[] = inner.kind === 'tuple' ? inner.elements : [inner];
        result.metadata.push(...meta);
        current = first;
      } else if (head === 'typing.Required' && inner) {
        result.optional = false;
        current = inner;
      } else if (head === 'typing.NotRequired' && inner) {
        result.optional = true;
        current = inner;
      } else if (head === 'typing.ReadOnly' && inner) {
        result.readonly = true;
        current = inner;
      } else if (head === 'typing.ClassVar') {
        result.classVar = true;
        current = inner;
      } else if (head === 'typing.Final') {
        result.readonly = true;
        current = inner;
      } else if (head === 'dataclasses.InitVar') {
        result.initVar = true;
        current = inner;
      } else if (current.kind === 'constant' && current.value.type === 'str') {
        current = this.parseForwardRef(current, ctx);
      } else break;
    }
    if (current) result.type = this.lowerType(current, ctx);
    return result;
  }

  private parseForwardRef(expr: Extract<PyExpr, { kind: 'constant' }>, ctx: TypeContext): PyExpr | undefined {
    if (expr.value.type !== 'str') return undefined;
    try {
      return parsePythonExpression(expr.value.value);
    } catch {
      this.diagnostics.warn(
        'unsupported-syntax',
        `Forward reference ${JSON.stringify(expr.value.value)} is not a valid type expression.`,
        {
          loc: expr.loc,
          path: ctx.path,
        },
      );
      return undefined;
    }
  }

  lowerType(expr: PyExpr, ctx: TypeContext): TypeNode {
    const mapped = this.typeMapOverride(expr);
    if (mapped) return mapped;

    switch (expr.kind) {
      case 'constant':
        return this.lowerConstantType(expr, ctx);
      case 'binop':
        if (expr.op === '|') return unionOf([this.lowerType(expr.left, ctx), this.lowerType(expr.right, ctx)]);
        return this.unsupported(expr, ctx, `operator '${expr.op}' in a type expression`);
      case 'name':
      case 'attribute':
        return this.lowerNamed(expr, [], ctx);
      case 'subscript':
        return this.lowerNamed(expr.value, subscriptArgs(expr), ctx, expr);
      case 'call': {
        const fn = this.canonical(expr.func);
        if (fn && CONSTRAINED_FACTORIES[fn]) {
          const itemArg = expr.args[0] ?? expr.keywords.find((k) => k.name === 'item_type')?.value;
          return CONSTRAINED_FACTORIES[fn](itemArg ? [this.lowerType(itemArg, ctx)] : []);
        }
        return this.unsupported(expr, ctx, `call ${exprText(expr)} in a type expression`);
      }
      case 'list':
        return this.unsupported(expr, ctx, 'a list outside Callable[[...], R]');
      default:
        return this.unsupported(expr, ctx, `'${exprText(expr)}' in a type expression`);
    }
  }

  private typeMapOverride(expr: PyExpr): TypeNode | undefined {
    const map = this.options.typeMap;
    if (!map) return undefined;
    const target = expr.kind === 'subscript' ? expr.value : expr;
    const written = dottedName(target);
    if (!written) return undefined;
    // A name imported from a third-party module also matches as `module.Name`.
    const head = written.split('.')[0]!;
    const imported = this.userImports.has(head)
      ? `${this.userImportModules.get(head)}.${[this.userImports.get(head), ...written.split('.').slice(1)].join('.')}`
      : undefined;
    const entry = map[written] ?? map[this.canonical(target) ?? ''] ?? (imported ? map[imported] : undefined);
    if (entry === undefined) return undefined;
    return typeof entry === 'string'
      ? { kind: 'raw', text: entry, imports: [] }
      : { kind: 'raw', text: entry.type, imports: entry.imports ?? [] };
  }

  private unsupported(expr: PyExpr, ctx: TypeContext, what: string): TypeNode {
    this.diagnostics.warn('unsupported-type', `Unsupported ${what}; using Any.`, { loc: expr.loc, path: ctx.path });
    return t.any();
  }

  private lowerConstantType(expr: Extract<PyExpr, { kind: 'constant' }>, ctx: TypeContext): TypeNode {
    switch (expr.value.type) {
      case 'none':
        return t.primitive('none');
      case 'str': {
        const inner = this.parseForwardRef(expr, ctx);
        return inner ? this.lowerType(inner, ctx) : t.any();
      }
      default:
        return this.unsupported(expr, ctx, `literal ${exprText(expr)} as a type (use Literal[...])`);
    }
  }

  private lowerNamed(head: PyExpr, args: PyExpr[], ctx: TypeContext, whole?: PyExpr): TypeNode {
    const written = dottedName(head);
    if (!written) return this.unsupported(head, ctx, `'${exprText(head)}'`);
    const loc = (whole ?? head).loc;
    const lowerArgs = (): TypeNode[] => args.map((a) => this.lowerType(a, ctx));

    // Type parameters in scope, then module TypeVars.
    if (ctx.scope.has(written)) return t.reference(written, lowerArgs(), 'type-param');
    if (this.typeVars.has(written)) {
      ctx.typeVarUses.push(written);
      return t.reference(written, [], 'type-param');
    }

    const name = this.canonical(head)!;
    if (this.declared.has(name)) {
      if (ctx.className === name && args.length === 0) {
        // A class referring to itself unparameterized is still a normal reference.
      }
      return t.reference(name, lowerArgs(), 'declaration');
    }
    // `Color.RED` where Color is a declared enum
    const dot = written.lastIndexOf('.');
    if (dot > 0 && this.declared.get(written.slice(0, dot)) === 'enum') {
      return { kind: 'enum-member', enumName: written.slice(0, dot), member: written.slice(dot + 1) };
    }
    if (this.userImports.has(written.split('.')[0]!)) return t.reference(written, lowerArgs(), 'import');

    const known = this.lowerKnown(name, args, ctx, loc);
    if (known) return known;

    this.diagnostics.warn(
      'unresolved-reference',
      `'${written}' is not defined or imported in this module; it is emitted as written.`,
      {
        loc,
        path: ctx.path,
      },
    );
    return t.reference(written, lowerArgs(), 'unresolved');
  }

  /** Library types. Returns undefined for names it does not know. */
  private lowerKnown(name: string, args: PyExpr[], ctx: TypeContext, loc: SourceLocation): TypeNode | undefined {
    const arg = (i: number): TypeNode => (args[i] ? this.lowerType(args[i], ctx) : t.any());
    const wk = (n: Extract<TypeNode, { kind: 'well-known' }>['name'], wkArgs: TypeNode[] = []): TypeNode => ({
      kind: 'well-known',
      name: n,
      args: wkArgs,
    });
    const record = (readonly: boolean, value?: TypeNode): TypeNode => ({
      kind: 'record',
      key: args[0] ? arg(0) : t.any(),
      value: value ?? arg(1),
      readonly,
    });
    const short = name.slice(name.lastIndexOf('.') + 1);
    const lossy = (message: string): void =>
      this.diagnostics.info('lossy-conversion', message, { loc, path: ctx.path });

    switch (name) {
      case 'builtins.str':
      case 'typing.Text':
      case 'typing.LiteralString':
        return t.primitive('string');
      case 'typing.AnyStr':
        lossy('AnyStr is a constrained TypeVar (str or bytes); it is treated as str.');
        return t.primitive('string');
      case 'builtins.int':
        return t.primitive('int');
      case 'builtins.float':
        return t.primitive('float');
      case 'builtins.complex':
        return t.primitive('complex');
      case 'builtins.bool':
        return t.primitive('boolean');
      case 'builtins.bytes':
      case 'builtins.bytearray':
      case 'builtins.memoryview':
        return t.primitive('bytes');
      case 'builtins.object':
        return t.unknown();
      case 'typing.Any':
        return t.any();
      case 'typing.Never':
      case 'typing.NoReturn':
        return t.never();
      case 'typing.Self':
        return { kind: 'self' };
      case 'typing.TypeGuard':
      case 'typing.TypeIs':
        lossy(`${short}[...] narrows in Python; it is a plain boolean in TypeScript.`);
        return t.primitive('boolean');
      case 'typing.Optional':
        return unionOf([arg(0), t.primitive('none')]);
      case 'typing.Union':
        return unionOf(args.map((a) => this.lowerType(a, ctx)));
      case 'typing.Literal':
        return this.lowerLiteral(args, ctx);
      case 'typing.Annotated':
      case 'typing.Required':
      case 'typing.NotRequired':
      case 'typing.ReadOnly':
      case 'typing.Final':
      case 'typing.ClassVar':
      case 'dataclasses.InitVar':
        // Qualifiers inside another type (`list[Annotated[X, ...]]`): only the type matters here.
        return args[0] ? this.unwrapAnnotation(args[0], ctx).type : t.any();
      case 'pydantic.Json':
        return arg(0);
      case 'typing.Unpack':
        return arg(0);
      case 'builtins.list':
      case 'typing.List':
      case 'typing.MutableSequence':
      case 'collections.deque':
      case 'typing.Deque':
      case 'collections.UserList':
        return t.array(arg(0));
      case 'typing.Sequence':
      case 'typing.Collection':
      case 'typing.Container':
      case 'typing.Reversible':
        return t.array(arg(0), true);
      case 'builtins.tuple':
      case 'typing.Tuple':
        return this.lowerTuple(args, ctx);
      case 'builtins.set':
      case 'typing.Set':
      case 'typing.MutableSet':
        return { kind: 'set', element: arg(0), readonly: false };
      case 'builtins.frozenset':
      case 'typing.FrozenSet':
      case 'typing.AbstractSet':
        return { kind: 'set', element: arg(0), readonly: true };
      case 'builtins.dict':
      case 'typing.Dict':
      case 'typing.MutableMapping':
      case 'collections.defaultdict':
      case 'typing.DefaultDict':
      case 'collections.OrderedDict':
      case 'typing.OrderedDict':
      case 'collections.ChainMap':
      case 'typing.ChainMap':
      case 'collections.UserDict':
        return record(false);
      case 'typing.Mapping':
        return record(true);
      case 'collections.Counter':
      case 'typing.Counter':
        return record(false, t.primitive('int'));
      case 'builtins.type':
      case 'typing.Type':
        return { kind: 'class-of', type: arg(0) };
      case 'typing.Callable':
        return this.lowerCallable(args, ctx);
      case 'typing.Iterable':
        return wk('iterable', [arg(0)]);
      case 'typing.Iterator':
        return wk('iterator', [arg(0)]);
      case 'typing.AsyncIterable':
        return wk('async-iterable', [arg(0)]);
      case 'typing.AsyncIterator':
        return wk('async-iterator', [arg(0)]);
      case 'typing.Generator':
        // Generator[Y, S, R]; S and R default to None (PEP 696).
        return wk('generator', [
          arg(0),
          args[1] ? arg(1) : t.primitive('none'),
          args[2] ? arg(2) : t.primitive('none'),
        ]);
      case 'typing.AsyncGenerator':
        return wk('async-generator', [arg(0), args[1] ? arg(1) : t.primitive('none')]);
      case 'typing.Awaitable':
        return wk('awaitable', [arg(0)]);
      case 'typing.Coroutine':
        return wk('awaitable', [args[2] ? arg(2) : t.any()]);
      case 'datetime.datetime':
        return wk('datetime');
      case 'datetime.date':
        return wk('date');
      case 'datetime.time':
        return wk('time');
      case 'datetime.timedelta':
        return wk('timedelta');
      case 'uuid.UUID':
        return wk('uuid');
      case 'decimal.Decimal':
        return wk('decimal');
      case 'pathlib.Path':
      case 'pathlib.PurePath':
      case 'pathlib.PosixPath':
      case 'pathlib.WindowsPath':
      case 'pathlib.PurePosixPath':
      case 'pathlib.PureWindowsPath':
      case 'os.PathLike':
        return wk('path');
      case 're.Pattern':
      case 'typing.Pattern':
        return wk('regex');
      case 'builtins.Exception':
      case 'builtins.BaseException':
      case 'builtins.ValueError':
      case 'builtins.TypeError':
      case 'builtins.KeyError':
      case 'builtins.RuntimeError':
        return wk('error');
      case 'typing.Hashable':
      case 'typing.Sized':
        return t.unknown();
      case 'typing.SupportsInt':
      case 'typing.SupportsFloat':
      case 'typing.SupportsIndex':
      case 'typing.SupportsAbs':
      case 'typing.SupportsRound':
      case 'numbers.Number':
      case 'numbers.Real':
      case 'numbers.Rational':
        return t.primitive('float');
      case 'numbers.Integral':
        return t.primitive('int');
    }
    if (name.startsWith('ipaddress.')) return wk('ip-address');
    if (PYDANTIC_KNOWN[name]) return PYDANTIC_KNOWN[name]();
    if (
      name === 'typing.IO' ||
      name === 'typing.TextIO' ||
      name === 'typing.BinaryIO' ||
      name === 'typing.Match' ||
      name === 're.Match'
    ) {
      this.diagnostics.warn('unsupported-type', `${short} has no TypeScript counterpart; using unknown.`, {
        loc,
        path: ctx.path,
      });
      return t.unknown();
    }
    return undefined;
  }

  private lowerLiteral(args: PyExpr[], ctx: TypeContext): TypeNode {
    const members: TypeNode[] = [];
    for (const arg of args) {
      if (arg.kind === 'constant') {
        const v = arg.value;
        if (v.type === 'str') members.push(t.literal(v.value));
        else if (v.type === 'bytes') {
          this.diagnostics.info('lossy-conversion', `bytes literal ${exprText(arg)} becomes a string literal.`, {
            loc: arg.loc,
            path: ctx.path,
          });
          members.push(t.literal(v.value));
        } else if (v.type === 'int') members.push(intLiteral(v.value));
        else if (v.type === 'bool') members.push(t.literal(v.value));
        else if (v.type === 'none') members.push(t.primitive('none'));
        else if (v.type === 'float') members.push(t.literal(v.value, true));
        else members.push(this.unsupported(arg, ctx, `Literal value ${exprText(arg)}`));
      } else if (
        arg.kind === 'unary' &&
        arg.op === '-' &&
        arg.operand.kind === 'constant' &&
        arg.operand.value.type === 'int'
      ) {
        members.push(intLiteral(-arg.operand.value.value));
      } else if (arg.kind === 'attribute' || arg.kind === 'name') {
        // Literal[Color.RED], or a nested Literal alias
        members.push(this.lowerType(arg, ctx));
      } else if (arg.kind === 'subscript') {
        members.push(this.lowerType(arg, ctx));
      } else members.push(this.unsupported(arg, ctx, `Literal value ${exprText(arg)}`));
    }
    return unionOf(members);
  }

  private lowerTuple(args: PyExpr[], ctx: TypeContext): TypeNode {
    if (args.length === 0) return { kind: 'tuple', elements: [{ type: t.any(), rest: 'repeat' }], readonly: true };
    // tuple[()] is the empty tuple.
    if (args.length === 1 && args[0]!.kind === 'tuple' && args[0]!.elements.length === 0) {
      return { kind: 'tuple', elements: [], readonly: true };
    }
    if (args.length === 2 && isEllipsis(args[1]!)) {
      return { kind: 'tuple', elements: [{ type: this.lowerType(args[0]!, ctx), rest: 'repeat' }], readonly: true };
    }
    const elements: TupleElement[] = args.map((a) => {
      let inner: PyExpr | undefined;
      if (a.kind === 'starred') inner = a.value;
      else if (a.kind === 'subscript' && this.canonical(a.value) === 'typing.Unpack') inner = a.index;
      if (!inner) return { type: this.lowerType(a, ctx) };
      const spread = this.lowerType(inner, ctx);
      // *tuple[int, ...] is a repeat of int.
      if (spread.kind === 'tuple' && spread.elements.length === 1 && spread.elements[0]!.rest === 'repeat') {
        return { type: spread.elements[0]!.type, rest: 'repeat' };
      }
      return { type: spread, rest: 'spread' };
    });
    return { kind: 'tuple', elements, readonly: true };
  }

  /** Parameters are lowered before the return type: old-style generics take TypeVars in order of appearance. */
  private lowerCallable(args: PyExpr[], ctx: TypeContext): TypeNode {
    const spec = args[0];
    const returns = (): TypeNode => (args[1] ? asReturnType(this.lowerType(args[1], ctx)) : t.any());
    if (!spec || isEllipsis(spec)) return t.fn([], returns(), { anyParams: true });
    const positional = (types: PyExpr[]): Parameter[] =>
      types.map((a, i) => ({
        name: `arg${i}`,
        type: this.lowerType(a, ctx),
        optional: false,
        kind: 'positional-only',
      }));
    const paramSpec = (expr: PyExpr): string | undefined => {
      const name = dottedName(expr);
      if (!name || !(this.typeVars.has(name) || ctx.scope.has(name))) return undefined;
      if (this.typeVars.has(name)) ctx.typeVarUses.push(name);
      return name;
    };
    if (spec.kind === 'list') {
      const params = positional(spec.elements);
      return t.fn(params, returns());
    }
    // Callable[P, R] / Callable[Concatenate[int, P], R]
    if (spec.kind === 'subscript' && this.canonical(spec.value) === 'typing.Concatenate') {
      const parts = subscriptArgs(spec);
      const last = parts[parts.length - 1]!;
      const params = positional(parts.slice(0, -1));
      if (isEllipsis(last)) return t.fn(params, returns(), { anyParams: true });
      const name = paramSpec(last) ?? dottedName(last) ?? 'P';
      return t.fn(params, returns(), { paramSpec: name });
    }
    const name = paramSpec(spec);
    if (name) return t.fn([], returns(), { paramSpec: name });
    return this.unsupported(spec, ctx, `Callable parameter list ${exprText(spec)}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** `-> None` is TypeScript's `void`: nothing useful is returned, not a `null` value. */
function asReturnType(node: TypeNode): TypeNode {
  return node.kind === 'primitive' && node.name === 'none' ? t.primitive('void') : node;
}

function dottedName(expr: PyExpr): string | undefined {
  if (expr.kind === 'name') return expr.id;
  if (expr.kind === 'attribute') {
    const base = dottedName(expr.value);
    return base ? `${base}.${expr.attr}` : undefined;
  }
  return undefined;
}

function subscriptArgs(expr: Extract<PyExpr, { kind: 'subscript' }>): PyExpr[] {
  const index = expr.index;
  return index.kind === 'tuple' && !index.parenthesized ? index.elements : [index];
}

function isEllipsis(expr: PyExpr): boolean {
  return expr.kind === 'constant' && expr.value.type === 'ellipsis';
}

function isNoneConstant(expr: PyExpr): boolean {
  return expr.kind === 'constant' && expr.value.type === 'none';
}

function isTrue(expr: PyExpr): boolean {
  return expr.kind === 'constant' && expr.value.type === 'bool' && expr.value.value;
}

function isFalse(expr: PyExpr): boolean {
  return expr.kind === 'constant' && expr.value.type === 'bool' && !expr.value.value;
}

function isPrimitiveAny(node: TypeNode): boolean {
  return node.kind === 'primitive' && node.name === 'any';
}

const KNOWN_PREFIXES = [
  'typing.',
  'datetime.',
  'uuid.',
  'decimal.',
  'pathlib.',
  're.',
  'ipaddress.',
  'collections.',
  'numbers.',
];

function isKnownTypeName(name: string): boolean {
  if (name.startsWith('pydantic.')) return Boolean(PYDANTIC_KNOWN[name]) || name === 'pydantic.Json';
  return (
    KNOWN_PREFIXES.some((p) => name.startsWith(p)) && !/\.(TypeVar|NewType|cast|overload|final|field|auto)$/.test(name)
  );
}

/** Source text of an expression. Expressions from forward references have no source; their kind is enough. */
function exprText(expr: PyExpr): string {
  switch (expr.kind) {
    case 'name':
      return expr.id;
    case 'attribute':
      return `${exprText(expr.value)}.${expr.attr}`;
    case 'other':
      return expr.text;
    case 'constant': {
      const v = expr.value;
      if (v.type === 'str') return JSON.stringify(v.value);
      if (v.type === 'bytes') return `b${JSON.stringify(v.value)}`;
      if (v.type === 'int') return v.value.toString();
      if (v.type === 'float') return String(v.value);
      if (v.type === 'complex') return v.text;
      if (v.type === 'bool') return v.value ? 'True' : 'False';
      if (v.type === 'none') return 'None';
      return '...';
    }
    case 'call':
      return `${exprText(expr.func)}(${[
        ...expr.args.map(exprText),
        ...expr.keywords.map((k) => (k.name ? `${k.name}=${exprText(k.value)}` : `**${exprText(k.value)}`)),
      ].join(', ')})`;
    case 'subscript':
      return `${exprText(expr.value)}[${exprText(expr.index)}]`;
    case 'binop':
      return `${exprText(expr.left)} ${expr.op} ${exprText(expr.right)}`;
    case 'unary':
      return `${expr.op}${expr.op === 'not' ? ' ' : ''}${exprText(expr.operand)}`;
    case 'tuple':
      return `${expr.parenthesized ? '(' : ''}${expr.elements.map(exprText).join(', ')}${expr.parenthesized ? ')' : ''}`;
    case 'list':
      return `[${expr.elements.map(exprText).join(', ')}]`;
    case 'set':
      return `{${expr.elements.map(exprText).join(', ')}}`;
    case 'dict':
      return `{${expr.entries.map((e) => (e.key ? `${exprText(e.key)}: ${exprText(e.value)}` : `**${exprText(e.value)}`)).join(', ')}}`;
    case 'starred':
      return `${expr.double ? '**' : '*'}${exprText(expr.value)}`;
  }
}

function intLiteral(value: bigint): TypeNode {
  if (value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER))
    return t.literal(Number(value));
  return t.literal(value);
}

/** A literal value, or undefined when the expression is not one. */
function constantValue(expr: PyExpr | undefined): string | number | boolean | null | undefined {
  if (!expr) return undefined;
  if (expr.kind === 'unary' && expr.op === '-') {
    const inner = constantValue(expr.operand);
    return typeof inner === 'number' ? -inner : undefined;
  }
  if (expr.kind !== 'constant') return undefined;
  const v = expr.value;
  switch (v.type) {
    case 'str':
      return v.prefix.includes('f') ? undefined : v.value;
    case 'int':
      return Number(v.value);
    case 'float':
      return v.value;
    case 'bool':
      return v.value;
    case 'none':
      return null;
    default:
      return undefined;
  }
}

/** Enum values: literals, plus `|`, `&`, `<<`, `+` over literals and earlier members (flag combinations). */
function evaluateEnumValue(
  expr: PyExpr,
  members: Map<string, string | number | boolean | null>,
): string | number | boolean | null | undefined {
  const literal = constantValue(expr);
  if (literal !== undefined) return literal;
  if (expr.kind === 'name' && members.has(expr.id)) return members.get(expr.id);
  if (expr.kind === 'binop') {
    const left = evaluateEnumValue(expr.left, members);
    const right = evaluateEnumValue(expr.right, members);
    if (typeof left !== 'number' || typeof right !== 'number') return undefined;
    switch (expr.op) {
      case '|':
        return left | right;
      case '&':
        return left & right;
      case '^':
        return left ^ right;
      case '<<':
        return left << right;
      case '>>':
        return left >> right;
      case '+':
        return left + right;
      case '-':
        return left - right;
      case '*':
        return left * right;
    }
  }
  return undefined;
}

interface AutoGenerator {
  (name: string): string | number;
  observe(value: unknown): void;
}

/** CPython's `_generate_next_value_` for each enum base. */
function autoGenerator(base: EnumBase, mixin: 'str' | 'int' | undefined): AutoGenerator {
  let last = 0;
  let highestFlag = 0;
  const gen = ((name: string): string | number => {
    if (base === 'str') return name.toLowerCase();
    if (base === 'flag' || base === 'int-flag') {
      highestFlag = highestFlag === 0 ? 1 : highestFlag * 2;
      return highestFlag;
    }
    last += 1;
    return mixin === 'str' ? String(last) : last;
  }) as AutoGenerator;
  gen.observe = (value) => {
    if (typeof value !== 'number') return;
    last = value;
    if (value > 0) {
      const bit = 2 ** Math.floor(Math.log2(value));
      if (bit > highestFlag) highestFlag = bit;
    }
  };
  return gen;
}

function inferFromValue(expr: PyExpr): TypeNode | undefined {
  if (expr.kind !== 'constant') {
    if (expr.kind === 'unary' && expr.op === '-' && expr.operand.kind === 'constant')
      return inferFromValue(expr.operand);
    if (expr.kind === 'list') return t.array(t.any());
    if (expr.kind === 'dict') return { kind: 'record', key: t.primitive('string'), value: t.any(), readonly: false };
    return undefined;
  }
  switch (expr.value.type) {
    case 'str':
      return t.primitive('string');
    case 'int':
      return t.primitive('int');
    case 'float':
      return t.primitive('float');
    case 'bool':
      return t.primitive('boolean');
    case 'bytes':
      return t.primitive('bytes');
    case 'none':
      return t.primitive('none');
    default:
      return undefined;
  }
}

function classDocstring(body: PyStmt[]): string | undefined {
  const first = body[0];
  if (first?.kind === 'expr' && first.value.kind === 'constant' && first.value.value.type === 'str')
    return first.value.value.value;
  return undefined;
}

/** Splits docstring text into prose and reST/Google-style deprecation notes. */
function docFromText(text: string): Doc {
  const clean = dedent(text);
  const doc: Doc = { text: clean, tags: [] };
  const deprecated = /^\.\. deprecated::\s*(.*)$/m.exec(clean);
  if (deprecated) {
    doc.deprecated = deprecated[1]!.trim();
    doc.text = clean.replace(deprecated[0], '').trim();
  }
  return doc;
}

function mergeDocs(a: Doc | undefined, b: Doc): Doc {
  if (!a) return b;
  const merged: Doc = { text: [a.text, b.text].filter(Boolean).join('\n\n'), tags: [...a.tags, ...b.tags] };
  const deprecated = b.deprecated ?? a.deprecated;
  if (deprecated !== undefined) merged.deprecated = deprecated;
  return merged;
}

export type { PyKeyword };
