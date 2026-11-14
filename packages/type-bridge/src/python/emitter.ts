import { DiagnosticBag } from '../diagnostics.js';
import { isNullish, referencedNames, splitNullish, t, typeKey, unionMembers, unionOf } from '../ir/build.js';
import type {
  AliasDeclaration,
  Declaration,
  DefaultValue,
  Diagnostic,
  Doc,
  EnumDeclaration,
  FunctionType,
  IndexSignature,
  Member,
  MethodMember,
  NewTypeDeclaration,
  ObjectDeclaration,
  ObjectType,
  Parameter,
  PropertyMember,
  TypeModule,
  TypeNode,
  TypeParam,
} from '../ir/types.js';
import {
  DEFAULT_HEADER,
  DEFAULT_PYTHON_OBJECT_STYLE,
  DEFAULT_PYTHON_VERSION,
  type PythonObjectStyle,
  type TypeScriptToPythonOptions,
} from '../options.js';
import { stableTopologicalSort } from '../shared/graph.js';
import { formatPythonModule } from '../shared/modules.js';
import {
  applyCase,
  isPythonIdentifier,
  singularize,
  toPascalCase,
  toPythonIdentifier,
  uniqueName,
} from '../shared/naming.js';
import { docstringBody, pyString } from '../shared/strings.js';
import { Features, TYPING_NAME_FEATURE } from './features.js';

/** Options for printing a {@link TypeModule} as Python; the `TypeScriptToPythonOptions` minus parsing-only ones. */
export type EmitPythonOptions = Omit<TypeScriptToPythonOptions, 'typeMap' | 'strict' | 'includePrivate'>;

export interface EmitResult {
  code: string;
  diagnostics: Diagnostic[];
}

/** Prints a {@link TypeModule} as a Python module. */
export function emitPython(module: TypeModule, options: EmitPythonOptions = {}): EmitResult {
  return new PythonEmitter(module, options).run();
}

type Style = 'typeddict' | 'dataclass' | 'pydantic' | 'protocol' | 'plain' | 'namedtuple';

/** Attributes of `BaseModel` a field must not shadow. */
const PYDANTIC_RESERVED = new Set([
  'copy',
  'dict',
  'json',
  'parse_obj',
  'parse_raw',
  'parse_file',
  'schema',
  'schema_json',
  'construct',
  'from_orm',
  'update_forward_refs',
  'validate',
  'fields',
  'model_config',
  'model_fields',
  'model_computed_fields',
  'model_extra',
  'model_fields_set',
]);

/** Modules from the standard library; everything else is a third-party import group. */
const STDLIB = new Set([
  'typing',
  'collections.abc',
  'dataclasses',
  'datetime',
  'decimal',
  'enum',
  'pathlib',
  're',
  'uuid',
  'warnings',
]);

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

class ImportTracker {
  private readonly from = new Map<string, Map<string, string>>();
  private readonly plain = new Set<string>();
  readonly raw = new Set<string>();
  private readonly taken: Set<string>;

  constructor(taken: Set<string>) {
    this.taken = taken;
  }

  /** Imports `name` from `module` and returns the local name, aliased when a declaration has the same name. */
  use(module: string, name: string, alias?: string): string {
    const names = this.from.get(module) ?? new Map<string, string>();
    this.from.set(module, names);
    const existing = names.get(name);
    if (existing) return existing;
    const wanted = alias ?? name;
    const local = this.taken.has(wanted) ? `_${wanted}` : wanted;
    names.set(name, local);
    return local;
  }

  module(name: string): string {
    this.plain.add(name);
    return name;
  }

  render(): string {
    // A name wanted from both `typing` and `typing_extensions` is imported once, from the superset.
    const typing = this.from.get('typing');
    const extensions = this.from.get('typing_extensions');
    if (typing && extensions) {
      for (const name of extensions.keys()) typing.delete(name);
      if (typing.size === 0) this.from.delete('typing');
    }
    const line = (module: string): string => {
      const names = [...this.from.get(module)!].sort(([a], [b]) => isortKey(a).localeCompare(isortKey(b)));
      return `from ${module} import ${names.map(([n, local]) => (n === local ? n : `${n} as ${local}`)).join(', ')}`;
    };
    const std: string[] = [...[...this.plain].filter((m) => STDLIB.has(m)).map((m) => `import ${m}`)];
    const third: string[] = [...[...this.plain].filter((m) => !STDLIB.has(m)).map((m) => `import ${m}`)];
    for (const module of [...this.from.keys()].sort()) (STDLIB.has(module) ? std : third).push(line(module));
    std.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    third.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    const groups = [std, third, [...this.raw].sort()].filter((g) => g.length).map((g) => g.join('\n'));
    return groups.join('\n\n');
  }
}

const sortKey = (line: string): string => line.replace(/^(from|import) /, '');

/** isort/ruff `order-by-type`: CONSTANTS, then Classes, then functions, each alphabetical. */
function isortKey(name: string): string {
  const rank = /^[A-Z0-9_]+$/.test(name) && name.length > 1 ? 0 : /^[A-Z]/.test(name) ? 1 : 2;
  return `${rank}${name}`;
}

// ---------------------------------------------------------------------------
// Emitter
// ---------------------------------------------------------------------------

interface PrintCtx {
  /** Names a reference would have to look ahead to (declared later, or the declaration itself). */
  pending: Set<string>;
  /** The annotation is evaluated when the class/alias is created, so forward references must be quoted. */
  eager: boolean;
  /** Set when a pending name was printed. */
  forward: boolean;
  /** Use single quotes for string literals (inside a quoted annotation). */
  singleQuotes: boolean;
  /** Type parameter renames (TypeVar name conflicts). */
  typeParams: Map<string, string>;
  path: string;
}

class PythonEmitter {
  private readonly diagnostics = new DiagnosticBag();
  private readonly module: TypeModule;
  private readonly features: Features;
  private readonly objectStyle: PythonObjectStyle;
  private readonly classStyle: 'dataclass' | 'pydantic';
  private readonly numberType: 'float' | 'int' | 'int | float';
  private readonly enumStyle: 'enum' | 'literal';
  private readonly hoistEnabled: boolean;
  private readonly propertyCase;
  private readonly header;
  private readonly dunderAllOption: boolean | undefined;
  private imports!: ImportTracker;
  private decls: Declaration[] = [];
  private readonly byName = new Map<string, Declaration>();
  private readonly styles = new Map<ObjectDeclaration, Style>();
  /** Source name → Python name. */
  private readonly names = new Map<string, string>();
  private readonly taken = new Set<string>();
  /** Module-level TypeVars for versions (or declarations) without PEP 695 syntax. */
  private readonly typeVars = new Map<string, { key: string; code: string }>();
  private typedDictFromExtensions = false;
  private readonly hoistedShapes = new Map<string, string>();

  constructor(module: TypeModule, options: EmitPythonOptions) {
    this.module = module;
    this.features = new Features(options.pythonVersion ?? DEFAULT_PYTHON_VERSION);
    this.objectStyle = options.objectStyle ?? DEFAULT_PYTHON_OBJECT_STYLE;
    this.classStyle = options.classStyle ?? (this.objectStyle === 'pydantic' ? 'pydantic' : 'dataclass');
    this.numberType = options.number ?? 'float';
    this.enumStyle = options.enumStyle ?? 'enum';
    this.hoistEnabled = options.hoist ?? true;
    this.propertyCase = options.propertyCase ?? 'preserve';
    this.header = options.header ?? DEFAULT_HEADER;
    this.dunderAllOption = options.dunderAll;
  }

  run(): EmitResult {
    this.prepare();
    this.imports = new ImportTracker(new Set(this.names.values()));

    const order = stableTopologicalSort(
      this.decls,
      (d) => d.name,
      (d) => referencedNames(this.declTypes(d)),
    );
    const pending = new Set(order.map((d) => d.name));
    const blocks: string[] = [];
    for (const decl of order) {
      pending.delete(decl.name);
      const self = new Set(pending);
      self.add(decl.name);
      blocks.push(this.declaration(decl, self));
    }

    const parts: string[] = [];
    if (this.header !== false)
      parts.push(
        this.header
          .split('\n')
          .map((l) => `# ${l}`.trimEnd())
          .join('\n'),
      );
    const userImports = this.userImports();
    const imports = this.imports.render();
    const importBlock = [imports, userImports].filter(Boolean).join('\n\n');
    if (importBlock) parts.push(importBlock);
    const typeVars = [...this.typeVars.values()].map((v) => v.code);
    if (typeVars.length) parts.push(typeVars.join('\n'));
    const all = this.dunderAll(order);
    if (all) parts.push(all);
    const head = parts.join('\n\n');
    const body = blocks.join('\n\n\n');
    const code = head && body ? `${head}\n\n\n${body}\n` : `${head}${body}\n`;
    return { code, diagnostics: this.diagnostics.items };
  }

  private dunderAll(order: Declaration[]): string | undefined {
    const exported = order.filter((d) => d.exported).map((d) => this.names.get(d.name)!);
    const emit = this.dunderAllOption ?? exported.length !== order.length;
    if (!emit) return undefined;
    return `__all__ = [${exported.map((n) => pyString(n)).join(', ')}]`;
  }

  private userImports(): string {
    const used = referencedNames(this.decls.flatMap((d) => this.declTypes(d)));
    const lines: string[] = [];
    for (const imp of this.module.imports) {
      const names = imp.names.filter((n) => used.has(n.alias ?? n.name) && n.name !== 'default');
      if (!names.length) continue;
      if (imp.module.level === 0 && this.module.language === 'typescript') {
        this.diagnostics.warn(
          'unresolved-reference',
          `${names.map((n) => n.alias ?? n.name).join(', ')} ${names.length === 1 ? 'is' : 'are'} imported from package '${imp.module.segments.join('/')}', which has no Python module; add a typeMap entry or convert that module too.`,
          { loc: imp.loc },
        );
        continue;
      }
      const specs = names.map((n) => (n.alias && n.alias !== n.name ? `${n.name} as ${n.alias}` : n.name));
      lines.push(`from ${formatPythonModule(imp.module)} import ${specs.join(', ')}`);
    }
    return lines.join('\n');
  }

  // -------------------------------------------------------------------------
  // Preparation: make every declaration something Python can say
  // -------------------------------------------------------------------------

  private prepare(): void {
    for (const decl of this.module.declarations) this.taken.add(decl.name);
    const out: Declaration[] = [];
    for (const decl of this.module.declarations) {
      const hoisted: Declaration[] = [];
      const ready = this.normalizeDeclaration(decl, hoisted);
      out.push(...hoisted, ready);
    }
    this.decls = out;
    for (const decl of out) this.byName.set(decl.name, decl);

    // Python names.
    const pyTaken = new Set<string>();
    for (const decl of out) {
      let name = toPythonIdentifier(decl.name);
      if (name !== decl.name) {
        this.diagnostics.warn(
          'renamed-identifier',
          `'${decl.name}' is not a valid Python identifier; it is emitted as '${name}'.`,
          { loc: decl.loc, path: decl.name },
        );
      }
      name = uniqueName(name, pyTaken);
      this.names.set(decl.name, name);
    }

    for (const decl of out) if (decl.kind === 'object') this.styles.set(decl, this.styleFor(decl));
    // A class whose base had to become a Protocol is one too (a TypedDict cannot inherit from a Protocol).
    for (let changed = true; changed;) {
      changed = false;
      for (const decl of out) {
        if (decl.kind !== 'object' || this.styles.get(decl) === 'protocol') continue;
        if (decl.bases.some((b) => b.kind === 'reference' && this.styleOfName(b.name) === 'protocol')) {
          this.styles.set(decl, 'protocol');
          changed = true;
        }
      }
    }
    this.typedDictFromExtensions = out.some(
      (d) => d.kind === 'object' && this.styles.get(d) === 'typeddict' && this.typedDictNeedsExtensions(d),
    );
  }

  private styleOfName(name: string): Style | undefined {
    const decl = this.byName.get(name);
    return decl?.kind === 'object' ? this.styles.get(decl) : undefined;
  }

  private styleFor(decl: ObjectDeclaration): Style {
    switch (decl.flavor) {
      case 'typeddict':
      case 'dataclass':
      case 'pydantic':
      case 'protocol':
      case 'namedtuple':
        return decl.flavor;
      case 'attrs':
      case 'msgspec':
        return 'dataclass';
      case 'plain-class':
        return 'plain';
      case 'class':
        return decl.members.some((m) => m.kind === 'method' && !m.static) && this.classStyle === 'dataclass'
          ? 'dataclass'
          : this.classStyle;
      case 'interface':
      case 'type-literal': {
        const hasMethods = decl.members.some((m) => m.kind === 'method' && !m.static) || decl.callSignatures.length > 0;
        if (hasMethods) return 'protocol';
        return this.objectStyle;
      }
    }
  }

  private typedDictNeedsExtensions(decl: ObjectDeclaration): boolean {
    const props = decl.members.filter((m): m is PropertyMember => m.kind === 'property' && !m.static);
    if (!this.features.has('readOnly') && props.some((p) => p.readonly)) return true;
    return decl.indexSignatures.length > 0 || decl.extraItems !== undefined || decl.closed === true;
  }

  /** Rewrites declarations whose shape Python cannot state directly and hoists anonymous types out of them. */
  private normalizeDeclaration(decl: Declaration, hoisted: Declaration[]): Declaration {
    if (decl.kind === 'alias') {
      const type = decl.type;
      // `type User = { ... }` / `type X = A & { ... }` / `type P = [x: number, y: number]` are classes in Python.
      if (type.kind === 'object' && (type.members.length || type.callSignatures.length)) {
        return this.normalizeDeclaration(this.objectFromType(decl, type), hoisted);
      }
      if (type.kind === 'intersection' && this.hoistEnabled) {
        const merged = this.mergeIntersection(type, decl.name, hoisted, decl);
        if (merged) return merged;
      }
      if (type.kind === 'tuple' && type.elements.length && type.elements.every((e) => e.name && !e.rest)) {
        const namedTuple: ObjectDeclaration = {
          ...this.objectFromType(decl, { kind: 'object', members: [], indexSignatures: [], callSignatures: [] }),
          flavor: 'namedtuple',
          members: type.elements.map((e) => ({
            kind: 'property',
            name: e.name!,
            type: this.hoistType(
              e.optional ? unionOf([e.type, t.primitive('none')]) : e.type,
              `${decl.name}${toPascalCase(e.name!)}`,
              hoisted,
              decl.exported,
            ),
            optional: false,
            readonly: true,
            ...(e.optional ? { default: { kind: 'literal', value: null, text: 'None' } } : {}),
          })),
        };
        return namedTuple;
      }
      if (type.kind === 'function' && this.needsProtocol(type) && this.hoistEnabled) {
        return this.protocolFromFunction(decl.name, type, hoisted, decl.exported, decl);
      }
      return { ...decl, type: this.hoistType(type, decl.name, hoisted, decl.exported, true) };
    }
    if (decl.kind === 'newtype') return { ...decl, type: this.hoistType(decl.type, decl.name, hoisted, decl.exported) };
    if (decl.kind === 'enum') return decl;

    const next: ObjectDeclaration = {
      ...decl,
      bases: decl.bases.map((b, i) => this.hoistType(b, `${decl.name}Base${i + 1}`, hoisted, decl.exported)),
      members: decl.members.map((m) => this.hoistMember(m, decl.name, hoisted, decl.exported)),
      indexSignatures: decl.indexSignatures.map((s) => ({
        ...s,
        key: this.hoistType(s.key, `${decl.name}Key`, hoisted, decl.exported),
        value: this.hoistType(s.value, `${decl.name}Value`, hoisted, decl.exported),
      })),
      callSignatures: decl.callSignatures.map((s) => this.hoistFunction(s, `${decl.name}Call`, hoisted, decl.exported)),
    };
    // Bases that were not object declarations (an anonymous object, a mapped type) are flattened into the class.
    const bases: TypeNode[] = [];
    for (const base of next.bases) {
      if (base.kind === 'reference') bases.push(base);
      else
        this.diagnostics.warn('unsupported-type', `A base of ${decl.name} is not a class; it was dropped.`, {
          loc: decl.loc,
          path: decl.name,
        });
    }
    next.bases = bases;
    return next;
  }

  private objectFromType(decl: AliasDeclaration, type: ObjectType): ObjectDeclaration {
    const out: ObjectDeclaration = {
      kind: 'object',
      name: decl.name,
      flavor: 'type-literal',
      typeParams: decl.typeParams,
      bases: [],
      members: type.members,
      indexSignatures: type.indexSignatures,
      callSignatures: type.callSignatures,
      exported: decl.exported,
    };
    if (decl.doc) out.doc = decl.doc;
    if (decl.loc) out.loc = decl.loc;
    return out;
  }

  private hoistMember(member: Member, owner: string, hoisted: Declaration[], exported: boolean): Member {
    const ctx = `${owner}${toPascalCase(member.name)}`;
    if (member.kind === 'property') return { ...member, type: this.hoistType(member.type, ctx, hoisted, exported) };
    return { ...member, signatures: member.signatures.map((s) => this.hoistFunction(s, ctx, hoisted, exported)) };
  }

  private hoistFunction(fn: FunctionType, ctx: string, hoisted: Declaration[], exported: boolean): FunctionType {
    return {
      ...fn,
      params: fn.params.map((p) => ({
        ...p,
        type: this.hoistType(p.type, `${ctx}${toPascalCase(p.name)}`, hoisted, exported),
      })),
      returns: this.hoistType(fn.returns, `${ctx}Result`, hoisted, exported),
    };
  }

  /** A callable that `Callable[[...], R]` cannot express: optional, named, rest or generic parameters, or overloads. */
  private needsProtocol(fn: FunctionType): boolean {
    if (fn.anyParams || fn.paramSpec) return false;
    return (
      fn.typeParams.length > 0 ||
      fn.params.some((p) => p.optional || (p.kind !== 'positional-only' && p.kind !== 'positional') || false) ||
      fn.construct === true
    );
  }

  private protocolFromFunction(
    name: string,
    fn: FunctionType,
    hoisted: Declaration[],
    exported: boolean,
    source?: AliasDeclaration,
  ): ObjectDeclaration {
    const decl: ObjectDeclaration = {
      kind: 'object',
      name,
      flavor: 'protocol',
      typeParams: source?.typeParams ?? [],
      bases: [],
      members: [],
      indexSignatures: [],
      callSignatures: [this.hoistFunction(fn, name, hoisted, exported)],
      exported,
    };
    if (source?.doc) decl.doc = source.doc;
    if (source?.loc) decl.loc = source.loc;
    return decl;
  }

  private synthesize(base: string, hoisted: Declaration[]): string {
    const name = uniqueName(toPascalCase(base) || 'Anonymous', this.taken);
    void hoisted;
    return name;
  }

  /**
   * Replaces anonymous object, callable and intersection types with references to new declarations.
   * `ctx` names the position (`UserAddress`); `top` is true for an alias's own type.
   */
  private hoistType(node: TypeNode, ctx: string, hoisted: Declaration[], exported: boolean, top = false): TypeNode {
    const h = (child: TypeNode, name: string): TypeNode => this.hoistType(child, name, hoisted, exported);
    switch (node.kind) {
      case 'object': {
        if (!node.members.length && !node.callSignatures.length) {
          if (node.indexSignatures.length) {
            const sig = node.indexSignatures[0]!;
            return {
              kind: 'record',
              key: h(sig.key, `${ctx}Key`),
              value: h(sig.value, `${ctx}Value`),
              readonly: sig.readonly,
            };
          }
          return t.primitive('object');
        }
        if (!node.members.length && node.callSignatures.length === 1 && !node.indexSignatures.length) {
          return h(node.callSignatures[0]!, ctx);
        }
        if (!this.hoistEnabled) {
          this.diagnostics.warn(
            'unsupported-type',
            'An anonymous object type is typed as dict[str, Any] because hoisting is off.',
            { path: ctx },
          );
          return { kind: 'record', key: t.primitive('string'), value: t.any(), readonly: false };
        }
        // The same anonymous shape (e.g. `address` in User and in Omit<User, ...>) is declared once.
        const key = typeKey(node);
        const existing = this.hoistedShapes.get(key);
        if (existing) return t.reference(existing, [], 'declaration');
        const name = this.synthesize(node.nameHint ?? ctx, hoisted);
        this.hoistedShapes.set(key, name);
        const decl: ObjectDeclaration = {
          kind: 'object',
          name,
          flavor: 'type-literal',
          typeParams: [],
          bases: [],
          members: [],
          indexSignatures: [],
          callSignatures: [],
          exported,
        };
        const normalized = this.normalizeDeclaration(
          {
            ...decl,
            members: node.members,
            indexSignatures: node.indexSignatures,
            callSignatures: node.callSignatures,
          },
          hoisted,
        );
        hoisted.push(normalized);
        this.diagnostics.info('synthesized-declaration', `An anonymous object type was declared as ${name}.`, {
          path: ctx,
        });
        return t.reference(name, [], 'declaration');
      }
      case 'function': {
        const fn = this.hoistFunction(node, ctx, hoisted, exported);
        if (!this.needsProtocol(fn)) return fn;
        if (!this.hoistEnabled) {
          this.diagnostics.warn(
            'lossy-conversion',
            'A callable with optional, rest or generic parameters is typed as Callable[..., R] because hoisting is off.',
            { path: ctx },
          );
          return { ...fn, params: [], anyParams: true };
        }
        const name = this.synthesize(top ? ctx : `${ctx}Callable`, hoisted);
        hoisted.push(this.protocolFromFunction(name, fn, hoisted, exported));
        this.diagnostics.info('synthesized-declaration', `A callable type was declared as the protocol ${name}.`, {
          path: ctx,
        });
        return t.reference(name, [], 'declaration');
      }
      case 'intersection': {
        const merged = this.hoistEnabled ? this.mergeIntersection(node, top ? ctx : ctx, hoisted) : undefined;
        if (merged) {
          hoisted.push(merged);
          return t.reference(merged.name, [], 'declaration');
        }
        const members = node.members.map((m, i) => h(m, `${ctx}Part${i + 1}`));
        const primitive = members.find(
          (m) => m.kind === 'primitive' || m.kind === 'reference' || m.kind === 'well-known',
        );
        this.diagnostics.warn('unsupported-type', 'Python has no intersection types; the first member is used.', {
          path: ctx,
        });
        return primitive ?? members[0] ?? t.any();
      }
      case 'union': {
        const anonymous = node.members.filter((m) => m.kind === 'object' && m.members.length);
        return unionOf(
          node.members.map((m, i) => {
            if (m.kind !== 'object' || anonymous.length < 2) return h(m, ctx);
            const tag = discriminantValue(m);
            return h(m, tag ? `${ctx}${toPascalCase(tag)}` : `${ctx}Variant${i + 1}`);
          }),
        );
      }
      case 'array':
        return { ...node, element: h(node.element, itemName(ctx)) };
      case 'set':
        return { ...node, element: h(node.element, itemName(ctx)) };
      case 'tuple':
        return {
          ...node,
          elements: node.elements.map((e, i) => ({
            ...e,
            type: h(e.type, `${ctx}${e.name ? toPascalCase(e.name) : `Item${i + 1}`}`),
          })),
        };
      case 'record':
      case 'map':
        return { ...node, key: h(node.key, `${ctx}Key`), value: h(node.value, `${ctx}Value`) };
      case 'reference':
      case 'well-known':
        return { ...node, args: node.args.map((a, i) => h(a, `${ctx}Arg${i + 1}`)) };
      case 'class-of':
        return { ...node, type: h(node.type, ctx) };
      default:
        return node;
    }
  }

  /** `A & B & { c: number }` → a class inheriting A and B that adds `c`; `string & { __brand }` → `str`. */
  private mergeIntersection(
    node: Extract<TypeNode, { kind: 'intersection' }>,
    name: string,
    hoisted: Declaration[],
    source?: AliasDeclaration,
  ): ObjectDeclaration | undefined {
    const bases: TypeNode[] = [];
    const members: Member[] = [];
    const indexSignatures: IndexSignature[] = [];
    for (const member of node.members) {
      if (member.kind === 'reference' && member.target !== 'type-param') {
        const target = this.module.declarations.find((d) => d.name === member.name);
        if (target && target.kind !== 'object' && !(target.kind === 'alias' && target.type.kind === 'object'))
          return undefined;
        bases.push(member);
      } else if (member.kind === 'object') {
        members.push(...member.members);
        indexSignatures.push(...member.indexSignatures);
      } else return undefined;
    }
    const decl: ObjectDeclaration = {
      kind: 'object',
      name: source ? name : this.synthesize(name, hoisted),
      flavor: 'type-literal',
      typeParams: source?.typeParams ?? [],
      bases,
      members,
      indexSignatures,
      callSignatures: [],
      exported: source?.exported ?? true,
    };
    if (source?.doc) decl.doc = source.doc;
    if (source?.loc) decl.loc = source.loc;
    return this.normalizeDeclaration(decl, hoisted) as ObjectDeclaration;
  }

  private declTypes(decl: Declaration): TypeNode[] {
    switch (decl.kind) {
      case 'object':
        return [
          ...decl.bases,
          ...decl.members.flatMap((m) => (m.kind === 'property' ? [m.type] : m.signatures)),
          ...decl.indexSignatures.flatMap((s) => [s.key, s.value]),
          ...decl.callSignatures,
          ...decl.typeParams.flatMap(paramTypes),
        ];
      case 'alias':
      case 'newtype':
        return [decl.type, ...decl.typeParams.flatMap(paramTypes)];
      case 'enum':
        return [];
    }
  }

  // -------------------------------------------------------------------------
  // Declarations
  // -------------------------------------------------------------------------

  private ctx(pending: Set<string>, eager: boolean, path: string, typeParams = new Map<string, string>()): PrintCtx {
    return { pending, eager, forward: false, singleQuotes: false, typeParams, path };
  }

  /** Class bodies and aliases are evaluated eagerly before 3.14 (PEP 649). */
  private get classBodyEager(): boolean {
    return !this.features.has('deferredAnnotations');
  }

  private declaration(decl: Declaration, pending: Set<string>): string {
    switch (decl.kind) {
      case 'alias':
        return this.alias(decl, pending);
      case 'newtype':
        return this.newType(decl, pending);
      case 'enum':
        return this.enumDeclaration(decl, pending);
      case 'object': {
        const style = this.styles.get(decl)!;
        const props = decl.members.filter((m): m is PropertyMember => m.kind === 'property' && !m.static);
        if (
          !props.length &&
          !decl.bases.length &&
          !decl.callSignatures.length &&
          !decl.members.some((m) => m.kind === 'method') &&
          decl.indexSignatures.length
        ) {
          // Only an index signature: a dict alias.
          const sig = decl.indexSignatures[0]!;
          const type: TypeNode = { kind: 'record', key: sig.key, value: sig.value, readonly: sig.readonly };
          const alias: AliasDeclaration = {
            kind: 'alias',
            name: decl.name,
            typeParams: decl.typeParams,
            type,
            exported: decl.exported,
          };
          if (decl.doc) alias.doc = decl.doc;
          return this.alias(alias, pending);
        }
        switch (style) {
          case 'typeddict':
            return this.typedDict(decl, pending);
          case 'namedtuple':
            return this.dataClassLike(decl, pending, 'namedtuple');
          case 'dataclass':
          case 'pydantic':
            return this.dataClassLike(decl, pending, style);
          case 'protocol':
          case 'plain':
            return this.protocol(decl, pending, style);
        }
      }
    }
  }

  private name(source: string): string {
    return this.names.get(source) ?? toPythonIdentifier(source);
  }

  // --- aliases --------------------------------------------------------------

  private alias(decl: AliasDeclaration, pending: Set<string>): string {
    const name = this.name(decl.name);
    // `type X = ...` (3.12) is lazily evaluated, generic or not, so it needs no quoted forward references.
    const usePep695 =
      this.features.has('typeParamSyntax') &&
      (!decl.typeParams.some((p) => p.default) || this.features.has('typeVarDefaults'));
    const typeParams = usePep695 ? new Map<string, string>() : this.registerTypeVars(decl.typeParams, decl.name, false);
    let value: string;
    const discriminator = this.objectStyle === 'pydantic' ? this.discriminator(decl.type) : undefined;
    if (usePep695) {
      const ctx = this.ctx(pending, false, decl.name, typeParams);
      value = this.annotation(decl.type, ctx);
      if (discriminator)
        value = `${this.typing('Annotated')}[${value}, ${this.imports.use('pydantic', 'Field')}(discriminator=${pyString(discriminator)})]`;
      return `type ${name}${this.pep695Params(decl.typeParams, pending)} = ${value}${this.attributeDocstring(decl.doc)}`;
    }
    const ctx = this.ctx(pending, true, decl.name, typeParams);
    value = this.annotation(decl.type, ctx);
    if (discriminator)
      value = `${this.typing('Annotated')}[${value}, ${this.imports.use('pydantic', 'Field')}(discriminator=${pyString(discriminator)})]`;
    return `${name}: ${this.typing('TypeAlias')} = ${value}${this.attributeDocstring(decl.doc)}`;
  }

  private newType(decl: NewTypeDeclaration, pending: Set<string>): string {
    const ctx = this.ctx(pending, true, decl.name);
    const base = this.annotation(decl.type, ctx);
    return `${this.name(decl.name)} = ${this.typing('NewType')}(${pyString(this.name(decl.name))}, ${base})${this.attributeDocstring(decl.doc)}`;
  }

  // --- enums ----------------------------------------------------------------

  private enumDeclaration(decl: EnumDeclaration, pending: Set<string>): string {
    const name = this.name(decl.name);
    const members = decl.members.filter((m) => m.value !== null);
    if (this.enumStyle === 'literal') {
      const literal: TypeNode = unionOf(members.map((m) => t.literal(m.value!)));
      const alias: AliasDeclaration = {
        kind: 'alias',
        name: decl.name,
        typeParams: [],
        type: members.length ? literal : t.never(),
        exported: decl.exported,
      };
      if (decl.doc) alias.doc = decl.doc;
      return this.alias(alias, pending);
    }
    let bases: string;
    switch (decl.flavor) {
      case 'string':
        bases = this.imports.use('enum', 'StrEnum');
        break;
      case 'number':
        bases = members.every((m) => Number.isInteger(m.value))
          ? this.imports.use('enum', 'IntEnum')
          : this.imports.use('enum', 'Enum');
        break;
      case 'flag':
        bases = this.imports.use('enum', 'IntFlag');
        break;
      case 'mixed':
        bases = this.imports.use('enum', 'Enum');
        break;
    }
    const lines: string[] = [];
    const doc = this.docstring(decl.doc, '    ');
    if (doc) lines.push(doc);
    const memberNames = new Set<string>();
    for (const member of members) {
      let memberName = toPythonIdentifier(member.name);
      if (memberName.startsWith('_')) memberName = `M${memberName}`;
      if (memberName !== member.name) {
        this.diagnostics.warn('renamed-identifier', `Enum member '${member.name}' is emitted as '${memberName}'.`, {
          loc: member.loc,
          path: `${decl.name}.${member.name}`,
        });
      }
      memberName = uniqueName(memberName, memberNames);
      lines.push(`    ${memberName} = ${pyLiteral(member.value)}${this.attributeDocstring(member.doc, '    ')}`);
    }
    if (!members.length) lines.push('    pass');
    return `${this.classDecorators(decl.doc, 'enum')}class ${name}(${bases}):\n${lines.join('\n')}`;
  }

  // --- TypedDict -------------------------------------------------------------

  private typedDictName(): string {
    return this.typedDictFromExtensions
      ? this.imports.use('typing_extensions', 'TypedDict')
      : this.imports.use('typing', 'TypedDict');
  }

  /** `typing_extensions.NotRequired` with `typing.TypedDict` is ignored before 3.11, so the two must come from the same module. */
  private typedDictQualifier(name: 'NotRequired' | 'Required' | 'ReadOnly'): string {
    if (this.typedDictFromExtensions) return this.imports.use('typing_extensions', name);
    return this.typing(name);
  }

  private typedDict(decl: ObjectDeclaration, pending: Set<string>): string {
    const name = this.name(decl.name);
    const props = decl.members.filter((m): m is PropertyMember => m.kind === 'property' && !m.static);
    const keys = props.map((p) => applyCase(p.alias ?? p.name, this.propertyCase));
    const functional = keys.some((k) => !isPythonIdentifier(k));
    this.dropUnsupportedMembers(decl, 'TypedDict');

    const allOptional = props.length > 0 && props.every((p) => p.optional);
    const total = decl.total === false || allOptional ? false : true;
    const fieldType = (p: PropertyMember, ctx: PrintCtx): string => {
      let text = this.annotation(p.type, ctx);
      if (p.readonly) text = `${this.typedDictQualifier('ReadOnly')}[${text}]`;
      if (total && p.optional) text = `${this.typedDictQualifier('NotRequired')}[${text}]`;
      if (!total && !p.optional) text = `${this.typedDictQualifier('Required')}[${text}]`;
      return text;
    };
    const extra = this.extraItems(decl);
    const usePep695 = this.usePep695(decl.typeParams);
    const typeParams = usePep695 ? new Map<string, string>() : this.registerTypeVars(decl.typeParams, decl.name, false);

    if (functional) {
      this.diagnostics.info(
        'restructured',
        `${decl.name} has keys that are not Python identifiers, so it uses the functional TypedDict syntax.`,
        { loc: decl.loc, path: decl.name },
      );
      const inherited = this.inheritedTypedDictProps(decl);
      const all = [...inherited, ...props];
      const ctx = this.ctx(pending, true, decl.name, typeParams);
      if (decl.typeParams.length) {
        this.diagnostics.warn(
          'unsupported-syntax',
          `The functional TypedDict syntax cannot be generic; ${decl.name}'s type parameters are unbound.`,
          { loc: decl.loc, path: decl.name },
        );
      }
      const entries = all.map(
        (p) => `    ${pyString(applyCase(p.alias ?? p.name, this.propertyCase))}: ${fieldType(p, ctx)},`,
      );
      const kwargs = [
        total ? '' : 'total=False',
        extra.closed ? 'closed=True' : '',
        extra.items ? `extra_items=${this.annotation(extra.items, ctx)}` : '',
      ].filter(Boolean);
      const body = entries.length ? `{\n${entries.join('\n')}\n}` : '{}';
      return `${name} = ${this.typedDictName()}(\n    ${pyString(name)},\n    ${body.replace(/\n/g, '\n    ')},${kwargs.map((k) => `\n    ${k},`).join('')}\n)${this.attributeDocstring(decl.doc)}`;
    }

    const bases = decl.bases.map((b) => this.baseText(b, pending, typeParams));
    if (!decl.bases.some((b) => b.kind === 'reference' && this.styleOfName(b.name) === 'typeddict'))
      bases.push(this.typedDictName());
    if (decl.typeParams.length && !usePep695) bases.push(this.genericBase(decl.typeParams, typeParams));
    const kwargs: string[] = [];
    if (!total) kwargs.push('total=False');
    if (extra.closed) kwargs.push('closed=True');
    const ctx = this.ctx(pending, this.classBodyEager, decl.name, typeParams);
    if (extra.items) kwargs.push(`extra_items=${this.annotation(extra.items, { ...ctx, eager: true })}`);
    const lines: string[] = [];
    const doc = this.docstring(decl.doc, '    ');
    if (doc) lines.push(doc);
    props.forEach((p, i) => {
      lines.push(
        `    ${keys[i]}: ${fieldType(p, { ...ctx, path: `${decl.name}.${p.name}` })}${this.attributeDocstring(p.doc, '    ')}`,
      );
    });
    if (!props.length && !doc) lines.push('    pass');
    const params = usePep695 ? this.pep695Params(decl.typeParams, pending) : '';
    return `${this.classDecorators(decl.doc, 'typeddict')}class ${name}${params}(${[...bases, ...kwargs].join(', ')}):\n${lines.join('\n')}`;
  }

  private inheritedTypedDictProps(decl: ObjectDeclaration): PropertyMember[] {
    const out: PropertyMember[] = [];
    for (const base of decl.bases) {
      const target = base.kind === 'reference' ? this.byName.get(base.name) : undefined;
      if (target?.kind !== 'object') continue;
      out.push(
        ...this.inheritedTypedDictProps(target),
        ...target.members.filter((m): m is PropertyMember => m.kind === 'property' && !m.static),
      );
    }
    return out;
  }

  /** `extra_items` (PEP 728) from index signatures or `extra="allow"`. */
  private extraItems(decl: ObjectDeclaration): { items?: TypeNode; closed: boolean } {
    const out: { items?: TypeNode; closed: boolean } = { closed: decl.closed === true };
    const values = [...decl.indexSignatures.map((s) => s.value), ...(decl.extraItems ? [decl.extraItems] : [])];
    if (values.length) out.items = unionOf(values);
    return out;
  }

  private dropUnsupportedMembers(decl: ObjectDeclaration, what: string): void {
    const methods = decl.members.filter((m) => m.kind === 'method' && !m.static);
    if (methods.length || decl.callSignatures.length) {
      this.diagnostics.info(
        'lossy-conversion',
        `${what} ${decl.name} cannot declare methods; ${methods.map((m) => m.name).join(', ') || '__call__'} dropped.`,
        { loc: decl.loc, path: decl.name },
      );
    }
  }

  // --- dataclass / pydantic / NamedTuple -------------------------------------

  private dataClassLike(
    decl: ObjectDeclaration,
    pending: Set<string>,
    style: 'dataclass' | 'pydantic' | 'namedtuple',
  ): string {
    const name = this.name(decl.name);
    const label = style === 'dataclass' ? 'Dataclass' : style === 'pydantic' ? 'Model' : 'NamedTuple';
    this.dropUnsupportedMembers(decl, label);
    const usePep695 = this.usePep695(decl.typeParams);
    const typeParams = usePep695 ? new Map<string, string>() : this.registerTypeVars(decl.typeParams, decl.name, false);
    const ctx = this.ctx(pending, this.classBodyEager, decl.name, typeParams);
    const instance = decl.members.filter((m): m is PropertyMember => m.kind === 'property' && !m.static);
    const statics = decl.members.filter((m): m is PropertyMember => m.kind === 'property' && m.static === true);
    const frozen = instance.length > 0 && instance.every((p) => p.readonly);

    const hasDefault = (p: PropertyMember): boolean => p.optional || p.default !== undefined;
    const bases = decl.bases.map((b) => this.baseText(b, pending, typeParams));
    if (
      style === 'pydantic' &&
      !decl.bases.some((b) => b.kind === 'reference' && this.styleOfName(b.name) === 'pydantic')
    ) {
      bases.push(this.imports.use('pydantic', 'BaseModel'));
    }
    if (style === 'namedtuple') bases.push(this.typing('NamedTuple'));
    if (decl.typeParams.length && !usePep695) bases.push(this.genericBase(decl.typeParams, typeParams));

    const lines: string[] = [];
    const doc = this.docstring(decl.doc, '    ');
    if (doc) lines.push(doc);

    // Pydantic model configuration.
    const config: string[] = [];
    if (style === 'pydantic') {
      if (frozen) config.push('frozen=True');
      if (decl.indexSignatures.length || decl.extraItems) config.push('extra="allow"');
      else if (decl.closed) config.push('extra="forbid"');
      if (config.length)
        lines.push(`    model_config = ${this.imports.use('pydantic', 'ConfigDict')}(${config.join(', ')})`);
      const extra = this.extraItems(decl).items;
      if (extra) lines.push(`    __pydantic_extra__: dict[str, ${this.annotation(extra, ctx)}]`);
    } else if (decl.indexSignatures.length) {
      this.diagnostics.info(
        'lossy-conversion',
        `${label} ${decl.name} cannot hold arbitrary extra keys; its index signature was dropped.`,
        { loc: decl.loc, path: decl.name },
      );
    }

    // A required field after one with a default (own or inherited) is a TypeError; kw_only lifts the rule.
    const fields = instance;
    const kwOnly =
      style === 'dataclass' &&
      instance.some((p) => !hasDefault(p)) &&
      (this.inheritedFields(decl).some(hasDefault) ||
        instance.some((p, i) => hasDefault(p) && instance.slice(i + 1).some((q) => !hasDefault(q))));
    for (const p of fields) lines.push(this.field(p, style, { ...ctx, path: `${decl.name}.${p.name}` }, frozen));
    for (const p of statics) {
      const value = this.defaultText(p.default);
      lines.push(
        `    ${toPythonIdentifier(p.name)}: ${this.typing('ClassVar')}[${this.annotation(p.type, ctx)}]${value ? ` = ${value}` : ''}`,
      );
    }
    if (lines.length === 0) lines.push('    pass');

    let decorator = '';
    if (style === 'dataclass') {
      const args = [frozen ? 'frozen=True' : '', kwOnly ? 'kw_only=True' : ''].filter(Boolean);
      decorator = `@${this.imports.use('dataclasses', 'dataclass')}${args.length ? `(${args.join(', ')})` : ''}\n`;
    }
    const params = usePep695 ? this.pep695Params(decl.typeParams, pending) : '';
    const baseList = bases.length ? `(${bases.join(', ')})` : '';
    return `${this.classDecorators(decl.doc, style)}${decorator}class ${name}${params}${baseList}:\n${lines.join('\n')}`;
  }

  private inheritedFields(decl: ObjectDeclaration): PropertyMember[] {
    const out: PropertyMember[] = [];
    for (const base of decl.bases) {
      const target = base.kind === 'reference' ? this.byName.get(base.name) : undefined;
      if (target?.kind === 'object')
        out.push(
          ...this.inheritedFields(target),
          ...target.members.filter((m): m is PropertyMember => m.kind === 'property' && !m.static),
        );
    }
    return out;
  }

  private field(
    p: PropertyMember,
    style: 'dataclass' | 'pydantic' | 'namedtuple',
    ctx: PrintCtx,
    frozenClass: boolean,
  ): string {
    const wire = applyCase(p.alias ?? p.name, this.propertyCase);
    let attr = toPythonIdentifier(p.alias ? p.name : wire);
    if (style === 'pydantic' && (PYDANTIC_RESERVED.has(attr) || attr.startsWith('_')))
      attr = `${attr.replace(/^_+/, '')}_`;
    if (attr !== wire && style !== 'pydantic') {
      this.diagnostics.warn(
        'renamed-identifier',
        `Field '${wire}' is emitted as '${attr}'; the key on the wire is no longer the same.`,
        { path: ctx.path },
      );
    }
    let type = p.type;
    const optional = p.optional && p.default === undefined;
    if (optional && !unionMembers(type).some(isNullish)) type = unionOf([type, t.primitive('none')]);
    const annotation = this.annotation(type, ctx);

    let value = optional ? 'None' : this.defaultText(p.default);
    if (style === 'pydantic') {
      const args: string[] = [];
      if (attr !== wire) args.push(`alias=${pyString(wire)}`);
      if (p.readonly && !frozenClass) args.push('frozen=True');
      const discriminator = this.discriminator(p.type);
      if (discriminator) args.push(`discriminator=${pyString(discriminator)}`);
      if (args.length) {
        const Field = this.imports.use('pydantic', 'Field');
        const factory = p.default?.kind === 'factory' ? this.factoryText(p.default.text, p.type, ctx) : undefined;
        if (factory) value = `${Field}(default_factory=${factory}, ${args.join(', ')})`;
        else value = `${Field}(${value ? `${value}, ` : ''}${args.join(', ')})`;
      } else if (p.default?.kind === 'factory') {
        // pydantic copies mutable defaults, so `= []` is safe; a factory expression is kept as one.
        const factory = this.factoryText(p.default.text, p.type, ctx);
        if (factory) value = `${this.imports.use('pydantic', 'Field')}(default_factory=${factory})`;
      }
    } else if (style === 'dataclass' && p.default?.kind === 'factory') {
      const factory = this.factoryText(p.default.text, p.type, ctx);
      if (factory) value = `${this.imports.use('dataclasses', 'field')}(default_factory=${factory})`;
    }
    return `    ${attr}: ${annotation}${value ? ` = ${value}` : ''}${this.attributeDocstring(p.doc, '    ')}`;
  }

  /** A default as Python source: literals translate; TypeScript expressions do not. */
  private defaultText(value: DefaultValue | undefined): string | undefined {
    if (!value) return undefined;
    if (value.kind === 'literal') return pyLiteral(value.value);
    if (value.kind === 'expression' && value.language === 'python') return value.text;
    if (value.kind === 'factory') return undefined;
    this.diagnostics.info('lossy-conversion', `Default ${value.text} is a TypeScript expression; it was dropped.`);
    return undefined;
  }

  /**
   * A `default_factory`. `list[LineItem]` rather than `list` where possible: it is callable and lets type checkers
   * infer the element type. Not when the type refers ahead, since defaults are evaluated eagerly.
   */
  private factoryText(text: string, type: TypeNode, ctx: PrintCtx): string | undefined {
    const trimmed = text.trim();
    const typed = (kind: 'array' | 'record' | 'map' | 'set', plain: string): string => {
      const base = splitNullish(type).base;
      if (base.kind !== kind || ('readonly' in base && base.readonly)) return plain;
      const probe: PrintCtx = { ...ctx, forward: false, eager: true };
      const printed = this.type(base, probe);
      return probe.forward ? plain : printed;
    };
    if (/^\[\s*\]$/.test(trimmed) || /^new Array\(\)$/.test(trimmed)) return typed('array', 'list');
    if (/^\{\s*\}$/.test(trimmed)) return typed('record', 'dict');
    if (/^new Map\(\)$/.test(trimmed)) return typed('map', 'dict');
    if (/^new Set\(\)$/.test(trimmed)) return typed('set', 'set');
    if (/^[A-Za-z_][\w.]*$/.test(trimmed)) return trimmed;
    this.diagnostics.info('lossy-conversion', `Default ${trimmed} cannot be translated; it was dropped.`);
    return undefined;
  }

  // --- Protocol / plain class --------------------------------------------------

  private protocol(decl: ObjectDeclaration, pending: Set<string>, style: 'protocol' | 'plain'): string {
    const name = this.name(decl.name);
    const usePep695 = this.usePep695(decl.typeParams);
    const typeParams = usePep695
      ? new Map<string, string>()
      : this.registerTypeVars(decl.typeParams, decl.name, style === 'protocol');
    const ctx = this.ctx(pending, this.classBodyEager, decl.name, typeParams);
    const bases = decl.bases.map((b) => this.baseText(b, pending, typeParams));
    if (style === 'protocol') {
      const Protocol = this.typing('Protocol');
      bases.push(
        decl.typeParams.length && !usePep695
          ? `${Protocol}[${decl.typeParams.map((p) => this.typeParamName(p, typeParams)).join(', ')}]`
          : Protocol,
      );
    } else if (decl.typeParams.length && !usePep695) bases.push(this.genericBase(decl.typeParams, typeParams));

    const lines: string[] = [];
    const doc = this.docstring(decl.doc, '    ');
    if (doc) lines.push(doc);
    const methodCtx = { ...ctx, eager: this.classBodyEager };
    for (const member of decl.members) {
      const path = `${decl.name}.${member.name}`;
      if (member.kind === 'property') {
        const attr = toPythonIdentifier(applyCase(member.alias ?? member.name, this.propertyCase));
        if (attr !== member.name)
          this.diagnostics.warn('renamed-identifier', `Attribute '${member.name}' is emitted as '${attr}'.`, { path });
        let type = member.type;
        if (member.optional) {
          this.diagnostics.info(
            'lossy-conversion',
            `Protocol attributes cannot be absent; optional '${member.name}' may be None instead.`,
            { path },
          );
          if (!unionMembers(type).some(isNullish)) type = unionOf([type, t.primitive('none')]);
        }
        if (member.static) {
          lines.push(`    ${attr}: ${this.typing('ClassVar')}[${this.annotation(type, { ...ctx, path })}]`);
        } else if (member.readonly && style === 'protocol') {
          // A read-only protocol member is a property: implementations may use a plain attribute or a property.
          lines.push(
            `    @property\n    def ${attr}(self) -> ${this.annotation(type, { ...methodCtx, path })}:${this.methodBody(member.doc)}`,
          );
        } else {
          lines.push(
            `    ${attr}: ${this.annotation(type, { ...ctx, path })}${this.attributeDocstring(member.doc, '    ')}`,
          );
        }
      } else {
        lines.push(...this.method(member, { ...methodCtx, path }));
      }
    }
    for (const sig of decl.callSignatures) {
      lines.push(
        ...this.method(
          { kind: 'method', name: '__call__', signatures: [sig], optional: false },
          { ...methodCtx, path: `${decl.name}.__call__` },
        ),
      );
    }
    for (const sig of decl.indexSignatures) {
      const key = this.annotation(sig.key, methodCtx);
      const value = this.annotation(sig.value, methodCtx);
      lines.push(`    def __getitem__(self, key: ${key}, /) -> ${value}: ...`);
      if (!sig.readonly) lines.push(`    def __setitem__(self, key: ${key}, value: ${value}, /) -> None: ...`);
    }
    if (lines.length === 0) lines.push('    pass');
    const params = usePep695 ? this.pep695Params(decl.typeParams, pending) : '';
    const baseList = bases.length ? `(${bases.join(', ')})` : '';
    return `${this.classDecorators(decl.doc, style)}class ${name}${params}${baseList}:\n${lines.join('\n')}`;
  }

  private methodBody(doc: Doc | undefined): string {
    const text = this.docstring(doc, '        ');
    return text ? `\n${text}\n        ...` : ' ...';
  }

  private method(member: MethodMember, ctx: PrintCtx): string[] {
    const name = toPythonIdentifier(member.name);
    if (member.optional) {
      this.diagnostics.info('lossy-conversion', `Optional method ${member.name} is declared as always present.`, {
        path: ctx.path,
      });
    }
    const overloaded = member.signatures.length > 1;
    const lines: string[] = [];
    for (const sig of member.signatures) {
      const decorators: string[] = [];
      if (overloaded) decorators.push(`    @${this.typing('overload')}`);
      if (member.static) decorators.push('    @staticmethod');
      const usePep695 = this.usePep695(sig.typeParams);
      const typeParams = new Map(ctx.typeParams);
      if (!usePep695)
        for (const [k, v] of this.registerTypeVars(sig.typeParams, `${ctx.path}`, false)) typeParams.set(k, v);
      const inner = { ...ctx, typeParams };
      const params = this.parameters(sig, inner, !member.static);
      const asyncPrefix = sig.async ? 'async ' : '';
      let returns = sig.returns;
      if (sig.async && returns.kind === 'well-known' && returns.name === 'awaitable')
        returns = returns.args[0] ?? t.any();
      const tp = usePep695 ? this.pep695Params(sig.typeParams, ctx.pending) : '';
      lines.push(
        ...decorators,
        `    ${asyncPrefix}def ${name}${tp}(${params}) -> ${this.annotation(returns, inner)}:${this.methodBody(overloaded ? undefined : member.doc)}`,
      );
    }
    return lines;
  }

  /** TypeScript parameters are positional: their names are not part of the type, so they are positional-only (`/`). */
  private parameters(sig: FunctionType, ctx: PrintCtx, receiver: boolean): string {
    const parts: string[] = receiver ? ['self'] : [];
    const fromTs = this.module.language === 'typescript';
    let positional = 0;
    let slashAdded = false;
    let starSeen = false;
    const addSlash = (): void => {
      if (fromTs && positional > 0 && !slashAdded) parts.push('/');
      slashAdded = true;
    };
    for (const p of sig.params) {
      const name = toPythonIdentifier(p.name);
      if (p.kind === 'var-positional') {
        addSlash();
        parts.push(`*${name}: ${this.annotation(p.type, ctx)}`);
        starSeen = true;
        continue;
      }
      if (p.kind === 'var-keyword') {
        addSlash();
        const type = p.unpacked
          ? `${this.typing('Unpack')}[${this.annotation(p.type, ctx)}]`
          : this.annotation(p.type, ctx);
        parts.push(`**${name}: ${type}`);
        continue;
      }
      if (p.kind === 'keyword-only' && !starSeen) {
        addSlash();
        parts.push('*');
        starSeen = true;
      }
      if (p.kind === 'positional' || p.kind === 'positional-only') positional++;
      parts.push(
        `${name}: ${this.annotation(p.type, ctx)}${p.optional ? ` = ${p.defaultText && !fromTs ? p.defaultText : '...'}` : ''}`,
      );
      if (p.kind === 'positional-only' && !fromTs) {
        // Python source positional-only marker is kept after the last one.
        const next = sig.params[sig.params.indexOf(p) + 1];
        if (next?.kind !== 'positional-only') parts.push('/');
      }
    }
    if (!starSeen) addSlash();
    if (sig.anyParams) parts.push(`*args: ${this.typing('Any')}`, `**kwargs: ${this.typing('Any')}`);
    if (sig.paramSpec) parts.push(`*args: ${sig.paramSpec}.args`, `**kwargs: ${sig.paramSpec}.kwargs`);
    return parts.join(', ');
  }

  private baseText(base: TypeNode, pending: Set<string>, typeParams: Map<string, string>): string {
    // Bases are evaluated immediately and cannot be quoted as a whole; only type arguments can.
    const ctx = this.ctx(pending, true, '', typeParams);
    if (base.kind !== 'reference') return this.annotation(base, ctx);
    const args = base.args.map((a) => this.annotation(a, this.ctx(pending, true, '', typeParams)));
    return `${this.refName(base)}${args.length ? `[${args.join(', ')}]` : ''}`;
  }

  private refName(node: Extract<TypeNode, { kind: 'reference' }>): string {
    return node.target === 'declaration' ? this.name(node.name) : node.name;
  }

  private classDecorators(doc: Doc | undefined, style: Style | 'enum'): string {
    // `@deprecated` replaces `__new__`; on TypedDict, NamedTuple and Enum that breaks construction, so they get a note instead.
    if (doc?.deprecated === undefined || ['typeddict', 'namedtuple', 'enum'].includes(style)) return '';
    const fn = this.features.has('deprecated')
      ? this.imports.use('warnings', 'deprecated')
      : this.imports.use('typing_extensions', 'deprecated');
    return `@${fn}(${pyString(doc.deprecated || 'Deprecated.')})\n`;
  }

  // -------------------------------------------------------------------------
  // Type parameters
  // -------------------------------------------------------------------------

  /** PEP 695 syntax needs 3.12, and 3.13 for defaults. */
  private usePep695(params: TypeParam[]): boolean {
    if (!params.length || !this.features.has('typeParamSyntax')) return false;
    return !params.some((p) => p.default) || this.features.has('typeVarDefaults');
  }

  private pep695Params(params: TypeParam[], pending: Set<string>): string {
    if (!params.length) return '';
    const ctx = this.ctx(pending, false, '');
    return `[${params
      .map((p) => {
        const prefix = p.kind === 'type-var-tuple' ? '*' : p.kind === 'param-spec' ? '**' : '';
        let text = `${prefix}${p.name}`;
        if (p.constraints?.length) text += `: (${p.constraints.map((c) => this.annotation(c, ctx)).join(', ')})`;
        else if (p.bound && p.kind === 'type' && !isUnknownBound(p.bound)) text += `: ${this.annotation(p.bound, ctx)}`;
        if (p.default) text += ` = ${this.annotation(p.default, ctx)}`;
        return text;
      })
      .join(', ')}]`;
  }

  private genericBase(params: TypeParam[], names: Map<string, string>): string {
    return `${this.typing('Generic')}[${params.map((p) => this.typeParamName(p, names)).join(', ')}]`;
  }

  private typeParamName(p: TypeParam, names: Map<string, string>): string {
    const name = names.get(p.name) ?? p.name;
    return p.kind === 'type-var-tuple' ? `*${name}` : name;
  }

  /** Declares module-level TypeVars for a declaration; a name already used with different bounds gets a suffix. */
  private registerTypeVars(params: TypeParam[], owner: string, protocol: boolean): Map<string, string> {
    const names = new Map<string, string>();
    for (const p of params) {
      const ctx = this.ctx(new Set(this.decls.map((d) => d.name)), true, owner);
      const args: string[] = [];
      let factory: string;
      if (p.kind === 'param-spec') factory = this.typing('ParamSpec');
      else if (p.kind === 'type-var-tuple') factory = this.typing('TypeVarTuple');
      else {
        const needsExtensions =
          (p.default !== undefined && !this.features.has('typeVarDefaults')) ||
          (protocol && p.variance === 'inferred' && !this.features.has('inferVariance'));
        factory = needsExtensions ? this.imports.use('typing_extensions', 'TypeVar') : this.typing('TypeVar');
        if (p.constraints?.length) args.push(...p.constraints.map((c) => this.annotation(c, ctx)));
        else if (p.bound && !isUnknownBound(p.bound)) args.push(`bound=${this.annotation(p.bound, ctx)}`);
        if (p.variance === 'covariant') args.push('covariant=True');
        else if (p.variance === 'contravariant') args.push('contravariant=True');
        else if (p.variance === 'inferred' && protocol) args.push('infer_variance=True');
      }
      if (p.default) args.push(`default=${this.annotation(p.default, ctx)}`);
      const key = `${factory}(${args.join(', ')})`;
      let pyName = p.name;
      const existing = this.typeVars.get(pyName);
      if (existing && existing.key !== key) {
        pyName = uniqueName(`${p.name}_${toPythonIdentifier(owner.split('.')[0]!)}`, new Set(this.typeVars.keys()));
      }
      if (!this.typeVars.has(pyName)) {
        this.typeVars.set(pyName, { key, code: `${pyName} = ${factory}(${[pyString(pyName), ...args].join(', ')})` });
      }
      names.set(p.name, pyName);
    }
    return names;
  }

  // -------------------------------------------------------------------------
  // Docs
  // -------------------------------------------------------------------------

  private docText(doc: Doc | undefined, includeDeprecated: boolean): string {
    if (!doc) return '';
    const parts: string[] = [];
    if (doc.text) parts.push(doc.text);
    for (const tag of doc.tags) {
      const title = tag.name === 'see' ? 'See Also' : tag.name.charAt(0).toUpperCase() + tag.name.slice(1);
      parts.push(
        tag.text.includes('\n')
          ? `${title}:\n${tag.text
              .split('\n')
              .map((l) => `    ${l}`)
              .join('\n')}`
          : `${title}: ${tag.text}`,
      );
    }
    if (includeDeprecated && doc.deprecated !== undefined)
      parts.push(`.. deprecated::${doc.deprecated ? ` ${doc.deprecated}` : ''}`);
    return parts.join('\n\n');
  }

  private docstring(doc: Doc | undefined, indent: string): string {
    const text = this.docText(doc, true);
    if (!text) return '';
    const body = docstringBody(text);
    if (!body.includes('\n')) return `${indent}"""${body}"""`;
    return `${indent}"""${body
      .split('\n')
      .map((l, i) => (i === 0 || !l ? l : indent + l))
      .join('\n')}\n${indent}"""`;
  }

  /** A docstring on the line after an attribute or alias (read by Sphinx, IDEs, pydantic's use_attribute_docstrings). */
  private attributeDocstring(doc: Doc | undefined, indent = ''): string {
    const text = this.docstring(doc, indent);
    return text ? `\n${text}` : '';
  }

  // -------------------------------------------------------------------------
  // Types
  // -------------------------------------------------------------------------

  private typing(name: string): string {
    const feature = TYPING_NAME_FEATURE[name];
    if (feature && !this.features.has(feature)) return this.imports.use('typing_extensions', name);
    return this.imports.use('typing', name);
  }

  /** Abstract collection types come from `collections.abc`; their `typing` aliases are deprecated. */
  private abc(name: string): string {
    return this.imports.use('collections.abc', name);
  }

  /** Prints an annotation, quoting it as a whole when it refers ahead in an eagerly evaluated position. */
  private annotation(node: TypeNode, ctx: PrintCtx): string {
    const first: PrintCtx = { ...ctx, forward: false, singleQuotes: false };
    const text = this.type(node, first);
    if (!first.forward || !ctx.eager) return text;
    const quoted: PrintCtx = { ...ctx, forward: false, singleQuotes: true };
    return `"${this.type(node, quoted).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  private type(node: TypeNode, ctx: PrintCtx): string {
    switch (node.kind) {
      case 'primitive':
        return this.primitive(node.name, ctx);
      case 'literal':
      case 'enum-member':
        return this.literals([node], ctx);
      case 'template':
        this.diagnostics.info('lossy-conversion', 'A template literal type is typed as str; its pattern is lost.', {
          path: ctx.path,
        });
        return 'str';
      case 'array':
        return node.readonly
          ? `${this.abc('Sequence')}[${this.type(node.element, ctx)}]`
          : `list[${this.type(node.element, ctx)}]`;
      case 'tuple':
        return this.tuple(node, ctx);
      case 'set':
        return node.readonly
          ? `${this.importAs('collections.abc', 'Set', 'AbstractSet')}[${this.type(node.element, ctx)}]`
          : `set[${this.type(node.element, ctx)}]`;
      case 'record':
      case 'map': {
        if (node.kind === 'map' && node.weak)
          this.diagnostics.info('lossy-conversion', 'WeakMap is typed as a dict.', { path: ctx.path });
        const key = this.type(node.key, ctx);
        const value = this.type(node.value, ctx);
        return node.readonly ? `${this.abc('Mapping')}[${key}, ${value}]` : `dict[${key}, ${value}]`;
      }
      case 'reference':
        return this.reference(node, ctx);
      case 'well-known':
        return this.wellKnown(node, ctx);
      case 'union':
        return this.union(node.members, ctx);
      case 'intersection': {
        this.diagnostics.warn('unsupported-type', 'Python has no intersection types; the first member is used.', {
          path: ctx.path,
        });
        return this.type(node.members[0] ?? t.any(), ctx);
      }
      case 'function':
        return this.callable(node, ctx);
      case 'object':
        this.diagnostics.warn('unsupported-type', 'An anonymous object type is typed as dict[str, Any].', {
          path: ctx.path,
        });
        return `dict[str, ${this.typing('Any')}]`;
      case 'class-of':
        return `type[${this.type(node.type, ctx)}]`;
      case 'self':
        return this.typing('Self');
      case 'opaque':
        return this.typing('Any');
      case 'raw':
        node.imports.forEach((i) => this.imports.raw.add(i));
        return node.text;
    }
  }

  /** `collections.abc.Set` is easily confused with the builtin `set`, so it is imported under another name. */
  private importAs(module: string, name: string, alias: string): string {
    return this.imports.use(module, name, alias);
  }

  private primitive(name: Extract<TypeNode, { kind: 'primitive' }>['name'], ctx: PrintCtx): string {
    switch (name) {
      case 'string':
        return 'str';
      case 'int':
      case 'bigint':
        return 'int';
      case 'float':
        return 'float';
      case 'number':
        return this.numberType;
      case 'complex':
        return 'complex';
      case 'boolean':
        return 'bool';
      case 'bytes':
        return 'bytes';
      case 'none':
      case 'null':
      case 'undefined':
      case 'void':
        return 'None';
      case 'any':
        return this.typing('Any');
      case 'unknown':
        return 'object';
      case 'never':
        return this.typing('Never');
      case 'object':
        return 'object';
      case 'symbol':
        this.diagnostics.warn('unsupported-type', 'symbol has no Python counterpart; using object.', {
          path: ctx.path,
        });
        return 'object';
    }
  }

  private literals(nodes: TypeNode[], ctx: PrintCtx): string {
    const values: string[] = [];
    const others: string[] = [];
    for (const node of nodes) {
      if (node.kind === 'enum-member') {
        const decl = this.byName.get(node.enumName);
        if (this.enumStyle === 'literal' && decl?.kind === 'enum') {
          const member = decl.members.find((m) => m.name === node.member);
          if (member && member.value !== null) {
            values.push(this.literalValue(member.value, ctx));
            continue;
          }
        }
        if (ctx.pending.has(node.enumName)) ctx.forward = true;
        values.push(`${this.name(node.enumName)}.${toPythonIdentifier(node.member)}`);
        continue;
      }
      if (node.kind !== 'literal') continue;
      if (node.float) {
        this.diagnostics.warn('lossy-conversion', `Literal[...] cannot hold the float ${node.value}; using float.`, {
          path: ctx.path,
        });
        others.push('float');
        continue;
      }
      values.push(this.literalValue(node.value, ctx));
    }
    const parts = [...(values.length ? [`${this.typing('Literal')}[${values.join(', ')}]`] : []), ...new Set(others)];
    return this.joinUnion(parts);
  }

  private literalValue(value: string | number | boolean | bigint, ctx: PrintCtx): string {
    if (typeof value === 'string') return ctx.singleQuotes ? singleQuoted(value) : pyString(value);
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    return String(value);
  }

  private joinUnion(parts: string[]): string {
    const unique = [...new Set(parts)];
    return unique.join(' | ');
  }

  private union(members: TypeNode[], ctx: PrintCtx): string {
    if (members.some((m) => m.kind === 'primitive' && m.name === 'unknown')) return 'object';
    const { base, nullish } = splitNullish({ kind: 'union', members });
    const rest = unionMembers(base);
    const parts: string[] = [];
    let literalIndex = -1;
    const literalNodes: TypeNode[] = [];
    for (const member of rest) {
      if (member.kind === 'literal' || member.kind === 'enum-member') {
        if (literalIndex === -1) {
          literalIndex = parts.length;
          parts.push('');
        }
        literalNodes.push(member);
      } else {
        const text = this.type(member, ctx);
        parts.push(...(member.kind === 'union' ? [text] : [text]));
      }
    }
    if (literalIndex !== -1) parts[literalIndex] = this.literals(literalNodes, ctx);
    if (nullish.length) parts.push('None');
    return this.joinUnion(parts);
  }

  private tuple(node: Extract<TypeNode, { kind: 'tuple' }>, ctx: PrintCtx): string {
    const tupleName = 'tuple';
    // Spread tuples inline: [A, ...[B, C]] is [A, B, C].
    const elements = node.elements.flatMap((e) =>
      e.rest === 'spread' && e.type.kind === 'tuple' ? e.type.elements : [e],
    );
    if (elements.length === 0) return `${tupleName}[()]`;
    const optionalIndex = elements.findIndex((e) => e.optional);
    if (optionalIndex !== -1) {
      // Python tuples have a fixed length: [A, B?] is tuple[A] | tuple[A, B].
      const variants: string[] = [];
      for (let n = optionalIndex; n <= elements.length; n++) {
        variants.push(
          this.tuple({ ...node, elements: elements.slice(0, n).map((e) => ({ ...e, optional: false })) }, ctx),
        );
      }
      return this.joinUnion(variants);
    }
    const rests = elements.filter((e) => e.rest);
    if (elements.length === 1 && elements[0]!.rest === 'repeat')
      return `${tupleName}[${this.type(elements[0]!.type, ctx)}, ...]`;
    if (rests.length > 1) {
      this.diagnostics.warn(
        'unsupported-type',
        'Python tuples allow one unbounded part; the tuple is typed as tuple[Any, ...].',
        { path: ctx.path },
      );
      return `${tupleName}[${this.typing('Any')}, ...]`;
    }
    const parts = elements.map((e) => {
      if (!e.rest) return this.type(e.type, ctx);
      const inner = e.rest === 'repeat' ? `${tupleName}[${this.type(e.type, ctx)}, ...]` : this.type(e.type, ctx);
      return `*${inner}`;
    });
    return `${tupleName}[${parts.join(', ')}]`;
  }

  private reference(node: Extract<TypeNode, { kind: 'reference' }>, ctx: PrintCtx): string {
    if (node.target === 'type-param') {
      const name = ctx.typeParams.get(node.name) ?? node.name;
      return name;
    }
    if (node.target === 'declaration' && ctx.pending.has(node.name)) ctx.forward = true;
    const name = this.refName(node);
    const args = node.args.map((a) => this.type(a, ctx));
    return args.length ? `${name}[${args.join(', ')}]` : name;
  }

  private wellKnown(node: Extract<TypeNode, { kind: 'well-known' }>, ctx: PrintCtx): string {
    const arg = (i: number): string => (node.args[i] ? this.type(node.args[i], ctx) : this.typing('Any'));
    switch (node.name) {
      case 'datetime':
      case 'date':
      case 'time':
      case 'timedelta':
        return this.imports.use('datetime', node.name);
      case 'uuid':
        return this.imports.use('uuid', 'UUID');
      case 'decimal':
        return this.imports.use('decimal', 'Decimal');
      case 'path':
        return this.imports.use('pathlib', 'Path');
      case 'url':
      case 'email':
      case 'ip-address':
      case 'secret':
        return 'str';
      case 'regex':
        return `${this.imports.module('re')}.Pattern[str]`;
      case 'error':
        return 'Exception';
      case 'iterable':
        return `${this.abc('Iterable')}[${arg(0)}]`;
      case 'iterator':
        return `${this.abc('Iterator')}[${arg(0)}]`;
      case 'async-iterable':
        return `${this.abc('AsyncIterable')}[${arg(0)}]`;
      case 'async-iterator':
        return `${this.abc('AsyncIterator')}[${arg(0)}]`;
      case 'generator':
        return `${this.abc('Generator')}[${arg(0)}, ${arg(1)}, ${arg(2)}]`;
      case 'async-generator':
        return `${this.abc('AsyncGenerator')}[${arg(0)}, ${arg(1)}]`;
      case 'awaitable':
        return `${this.abc('Awaitable')}[${arg(0)}]`;
    }
  }

  private callable(fn: FunctionType, ctx: PrintCtx): string {
    const Callable = this.abc('Callable');
    const returns = this.type(fn.returns, ctx);
    if (fn.paramSpec) {
      const prefix = fn.params.map((p) => this.type(p.type, ctx));
      return prefix.length
        ? `${Callable}[${this.typing('Concatenate')}[${[...prefix, fn.paramSpec].join(', ')}], ${returns}]`
        : `${Callable}[${fn.paramSpec}, ${returns}]`;
    }
    if (fn.anyParams || fn.params.some((p) => p.kind === 'var-positional' || p.kind === 'var-keyword' || p.optional)) {
      if (!fn.anyParams)
        this.diagnostics.warn(
          'lossy-conversion',
          'A callable with optional or rest parameters is typed as Callable[..., R].',
          { path: ctx.path },
        );
      return `${Callable}[..., ${returns}]`;
    }
    return `${Callable}[[${fn.params.map((p: Parameter) => this.type(p.type, ctx)).join(', ')}], ${returns}]`;
  }

  /** For pydantic: a union of models that all carry a distinct literal-valued property can be discriminated by it. */
  private discriminator(node: TypeNode): string | undefined {
    const members = unionMembers(splitNullish(node).base);
    if (members.length < 2) return undefined;
    const decls = members.map((m) => (m.kind === 'reference' ? this.byName.get(m.name) : undefined));
    if (!decls.every((d): d is ObjectDeclaration => d?.kind === 'object' && this.styles.get(d) === 'pydantic'))
      return undefined;
    const first = decls[0]!.members.filter((m): m is PropertyMember => m.kind === 'property');
    for (const candidate of first) {
      const values = new Set<string>();
      let ok = true;
      for (const decl of decls) {
        const prop = decl.members.find((m): m is PropertyMember => m.kind === 'property' && m.name === candidate.name);
        const literals = prop && !prop.optional ? unionMembers(prop.type) : [];
        if (!literals.length || !literals.every((l) => l.kind === 'literal' && typeof l.value === 'string')) {
          ok = false;
          break;
        }
        for (const l of literals) {
          const key = String((l as { value: string }).value);
          if (values.has(key)) ok = false;
          values.add(key);
        }
      }
      if (ok) return applyCase(candidate.alias ?? candidate.name, this.propertyCase);
    }
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function paramTypes(p: TypeParam): TypeNode[] {
  return [...(p.bound ? [p.bound] : []), ...(p.constraints ?? []), ...(p.default ? [p.default] : [])];
}

function isUnknownBound(node: TypeNode): boolean {
  return node.kind === 'primitive' && (node.name === 'unknown' || node.name === 'any');
}

function pyLiteral(value: string | number | boolean | null): string {
  if (value === null) return 'None';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'string') return pyString(value);
  if (!Number.isFinite(value)) return value > 0 ? 'float("inf")' : value < 0 ? 'float("-inf")' : 'float("nan")';
  return String(value);
}

function singleQuoted(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

function itemName(ctx: string): string {
  const singular = singularize(ctx);
  return singular === ctx ? `${ctx}Item` : singular;
}

/** The literal value of a property every variant of a discriminated union carries (`kind: 'circle'`). */
function discriminantValue(node: ObjectType): string | undefined {
  for (const member of node.members) {
    if (member.kind === 'property' && member.type.kind === 'literal' && typeof member.type.value === 'string')
      return member.type.value;
  }
  return undefined;
}
