import { DiagnosticBag } from '../diagnostics.js';
import { isNullish, referencedNames, unionMembers, walkType } from '../ir/build.js';
import type {
  Declaration,
  Diagnostic,
  Doc,
  EnumDeclaration,
  FunctionType,
  IndexSignature,
  Member,
  ObjectDeclaration,
  Parameter,
  PropertyMember,
  TypeModule,
  TypeNode,
  TypeParam,
} from '../ir/types.js';
import {
  DEFAULT_HEADER,
  DEFAULT_IMPORT_EXTENSION,
  DEFAULT_TYPESCRIPT_ENUM_STYLE,
  DEFAULT_TYPESCRIPT_MODE,
  type PythonToTypeScriptOptions,
} from '../options.js';
import { formatPythonModule, formatTsModule } from '../shared/modules.js';
import { applyCase, isTsPropertyIdentifier, toTsTypeName } from '../shared/naming.js';
import { jsDocLines, tsString } from '../shared/strings.js';

/** Options for printing a {@link TypeModule} as TypeScript; the `PythonToTypeScriptOptions` minus parsing-only ones. */
export type EmitTypeScriptOptions = Omit<PythonToTypeScriptOptions, 'typeMap' | 'strict' | 'includePrivate'>;

export interface EmitResult {
  code: string;
  diagnostics: Diagnostic[];
}

/** Precedence of a printed type: a lower number binds more loosely. */
const Prec = { Union: 0, Intersection: 1, Operator: 2, Postfix: 3 } as const;
type Prec = (typeof Prec)[keyof typeof Prec];

/** Globals the output refers to by name, which a declaration of the same name would shadow. */
const GLOBAL_TYPES = new Set([
  'Record',
  'Partial',
  'Readonly',
  'Map',
  'ReadonlyMap',
  'WeakMap',
  'Set',
  'ReadonlySet',
  'Date',
  'RegExp',
  'Promise',
  'Iterable',
  'Iterator',
  'AsyncIterable',
  'AsyncIterator',
  'Generator',
  'AsyncGenerator',
  'Error',
  'Uint8Array',
]);

/** Prints a {@link TypeModule} as a TypeScript module. */
export function emitTypeScript(module: TypeModule, options: EmitTypeScriptOptions = {}): EmitResult {
  return new TypeScriptEmitter(module, options).run();
}

class TypeScriptEmitter {
  private readonly diagnostics = new DiagnosticBag();
  private readonly module: TypeModule;
  private readonly mode;
  private readonly enumStyle;
  private readonly objectStyle;
  private readonly int;
  private readonly none;
  private readonly useAliases;
  private readonly defaultedFields;
  private readonly quote;
  private readonly semi;
  private readonly indentUnit;
  private readonly importExtension;
  private readonly propertyCase;
  private readonly header;
  /** Source name → emitted name, for declarations renamed to valid TypeScript names. */
  private readonly names = new Map<string, string>();
  private readonly enums = new Map<string, EnumDeclaration>();
  private readonly extraImports = new Set<string>();
  /** The alias being printed: a record referring back to it is written as an index signature, which may recurse. */
  private currentAlias: string | undefined;
  private path = '';

  constructor(module: TypeModule, options: EmitTypeScriptOptions) {
    this.module = module;
    this.mode = options.mode ?? DEFAULT_TYPESCRIPT_MODE;
    this.enumStyle = options.enumStyle ?? DEFAULT_TYPESCRIPT_ENUM_STYLE;
    this.objectStyle = options.objectStyle ?? 'interface';
    this.int = options.int ?? 'number';
    this.none = options.none ?? 'null';
    this.useAliases = options.useAliases ?? true;
    this.defaultedFields = options.defaultedFields ?? 'required';
    this.quote = options.quote ?? 'single';
    this.semi = options.semicolons === false ? '' : ';';
    this.indentUnit = ' '.repeat(options.indent ?? 2);
    this.importExtension = options.importExtension ?? DEFAULT_IMPORT_EXTENSION;
    this.propertyCase = options.propertyCase ?? 'preserve';
    this.header = options.header ?? DEFAULT_HEADER;
  }

  run(): EmitResult {
    for (const decl of this.module.declarations) {
      const name = toTsTypeName(decl.name);
      if (name !== decl.name) {
        this.diagnostics.warn(
          'renamed-identifier',
          `'${decl.name}' is not a valid TypeScript type name; it is emitted as '${name}'.`,
          {
            loc: decl.loc,
            path: decl.name,
          },
        );
      }
      this.names.set(decl.name, name);
      if (decl.kind === 'enum') this.enums.set(decl.name, decl);
    }

    const blocks = this.module.declarations.map((decl) => {
      this.path = decl.name;
      return this.declaration(decl);
    });
    const parts: string[] = [];
    if (this.header !== false)
      parts.push(
        this.header
          .split('\n')
          .map((l) => `// ${l}`.trimEnd())
          .join('\n'),
      );
    const imports = this.imports();
    if (imports) parts.push(imports);
    parts.push(...blocks);
    return { code: `${parts.join('\n\n')}\n`, diagnostics: this.diagnostics.items };
  }

  // -------------------------------------------------------------------------
  // Imports
  // -------------------------------------------------------------------------

  private imports(): string {
    const used = new Set<string>();
    for (const decl of this.module.declarations) {
      const types: TypeNode[] = [];
      collectDeclTypes(decl, types);
      for (const node of types)
        walkType(node, (n) => n.kind === 'reference' && n.target === 'import' && used.add(n.name.split('.')[0]!));
    }
    const lines: string[] = [];
    for (const imp of this.module.imports) {
      const names = imp.names.filter((n) => used.has(n.alias ?? n.name));
      if (!names.length) continue;
      const source = this.module.language === 'python' ? formatPythonModule(imp.module) : imp.module.segments.join('/');
      if (imp.module.level === 0 && this.module.language === 'python') {
        this.diagnostics.warn(
          'unresolved-reference',
          `${names.map((n) => n.alias ?? n.name).join(', ')} ${names.length === 1 ? 'is' : 'are'} imported from '${source}', which has no TypeScript module path; add a typeMap entry or convert that module too.`,
          { loc: imp.loc },
        );
        continue;
      }
      const specs = names.map((n) => {
        const name = n.name === 'default' ? 'default' : n.name;
        return n.alias && n.alias !== name ? `${name} as ${n.alias}` : name;
      });
      lines.push(
        `import type { ${specs.join(', ')} } from ${tsString(formatTsModule(imp.module, this.importExtension), this.quote)}${this.semi}`,
      );
    }
    lines.push(...[...this.extraImports].sort());
    return lines.join('\n');
  }

  // -------------------------------------------------------------------------
  // Declarations
  // -------------------------------------------------------------------------

  private declaration(decl: Declaration): string {
    const name = this.names.get(decl.name)!;
    const exp = decl.exported ? 'export ' : '';
    const doc = this.jsDoc(decl.doc, '');
    switch (decl.kind) {
      case 'alias': {
        this.currentAlias = decl.name;
        const body = this.type(decl.type);
        this.currentAlias = undefined;
        return `${doc}${exp}type ${name}${this.typeParams(decl.typeParams, false)} = ${body}${this.semi}`;
      }
      case 'newtype':
        return `${doc}${exp}type ${name} = ${this.type(decl.type, Prec.Intersection)} & { readonly __brand: ${tsString(decl.name, this.quote)} }${this.semi}`;
      case 'enum':
        return doc + this.enumDeclaration(decl, name, exp);
      case 'object':
        return doc + this.objectDeclaration(decl, name, exp);
    }
  }

  private enumDeclaration(decl: EnumDeclaration, name: string, exp: string): string {
    const members = decl.members.filter((m) => m.value !== null);
    const literal = (v: string | number | boolean): string =>
      typeof v === 'string' ? tsString(v, this.quote) : String(v);
    const style = this.enumStyleFor(decl);
    if (style === 'union' || members.length === 0) {
      const values = [...new Set(members.map((m) => literal(m.value!)))];
      return `${exp}type ${name} = ${values.length ? values.join(' | ') : 'never'}${this.semi}`;
    }
    const key = (memberName: string): string =>
      isTsPropertyIdentifier(memberName) ? memberName : tsString(memberName, this.quote);
    if (style === 'object') {
      const body = members
        .map((m) => `${this.jsDoc(m.doc, this.indentUnit)}${this.indentUnit}${key(m.name)}: ${literal(m.value!)},`)
        .join('\n');
      return `${exp}const ${name} = {\n${body}\n} as const${this.semi}\n${exp}type ${name} = (typeof ${name})[keyof typeof ${name}]${this.semi}`;
    }
    const body = members
      .map((m) => `${this.jsDoc(m.doc, this.indentUnit)}${this.indentUnit}${key(m.name)} = ${literal(m.value!)},`)
      .join('\n');
    return `${exp}${style === 'const-enum' ? 'const ' : ''}enum ${name} {\n${body}\n}`;
  }

  /** Boolean values cannot be TypeScript enum members; such an enum falls back to a union. */
  private enumStyleFor(decl: EnumDeclaration): string {
    if (this.enumStyle === 'union' || this.enumStyle === 'object') return this.enumStyle;
    if (decl.members.some((m) => typeof m.value === 'boolean')) {
      this.diagnostics.warn(
        'unsupported-type',
        `Enum ${decl.name} has boolean values, which a TypeScript enum cannot hold; it is emitted as a union.`,
        {
          loc: decl.loc,
          path: decl.name,
        },
      );
      return 'union';
    }
    return this.enumStyle;
  }

  private objectDeclaration(decl: ObjectDeclaration, name: string, exp: string): string {
    if (decl.flavor === 'namedtuple') return this.namedTuple(decl, name, exp);
    const variance = decl.flavor === 'protocol';
    const params = this.typeParams(decl.typeParams, variance && this.objectStyle === 'interface');
    const body = this.objectBody(decl.members, decl.indexSignatures, decl.callSignatures, decl.extraItems, '');
    if (this.objectStyle === 'type') {
      const bases = decl.bases.map((b) => this.type(b, Prec.Intersection));
      return `${exp}type ${name}${params} = ${[...bases, body].join(' & ')}${this.semi}`;
    }
    const bases = decl.bases.length ? ` extends ${decl.bases.map((b) => this.type(b)).join(', ')}` : '';
    return `${exp}interface ${name}${params}${bases} ${body}`;
  }

  /** A NamedTuple serializes as an array, so it is a labeled, read-only tuple. */
  private namedTuple(decl: ObjectDeclaration, name: string, exp: string): string {
    const fields = decl.members.filter((m): m is PropertyMember => m.kind === 'property' && !m.static);
    const elements = fields.map((f) => {
      const optional = f.default && this.defaultedFields === 'optional' ? '?' : '';
      return `${f.name}${optional}: ${this.type(f.type)}`;
    });
    return `${exp}type ${name}${this.typeParams(decl.typeParams, false)} = readonly [${elements.join(', ')}]${this.semi}`;
  }

  private objectBody(
    members: Member[],
    indexSignatures: IndexSignature[],
    callSignatures: FunctionType[],
    extraItems: TypeNode | undefined,
    indent: string,
  ): string {
    const inner = indent + this.indentUnit;
    const lines: string[] = [];
    const props = members.filter(
      (m): m is PropertyMember => m.kind === 'property' && !m.static && !(this.mode === 'json' && m.excludeFromJson),
    );
    for (const sig of callSignatures) lines.push(`${inner}${this.signature(sig)}${this.semi || ';'}`);
    for (const prop of props) lines.push(this.property(prop, inner));
    for (const member of members) {
      if (member.kind !== 'method' || member.static) continue;
      const doc = this.jsDoc(member.doc, inner);
      member.signatures.forEach((sig, i) => {
        lines.push(
          `${i === 0 ? doc : ''}${inner}${this.key(member.name)}${member.optional ? '?' : ''}${this.signature(sig, ': ')}${this.semi || ';'}`,
        );
      });
    }
    const signatures = [...indexSignatures];
    if (extraItems) signatures.push({ key: { kind: 'primitive', name: 'string' }, value: extraItems, readonly: false });
    for (const sig of signatures) {
      // Every property must be assignable to a string index signature, so its value type includes theirs.
      let value = sig.value;
      if (isStringKey(sig.key) && !isTop(value)) {
        value = {
          kind: 'union',
          members: [
            value,
            ...props.map((p) =>
              p.optional
                ? {
                    kind: 'union' as const,
                    members: [p.type, { kind: 'primitive' as const, name: 'undefined' as const }],
                  }
                : p.type,
            ),
          ],
        };
      }
      const keyType = this.indexKey(sig.key);
      lines.push(`${inner}${sig.readonly ? 'readonly ' : ''}[key: ${keyType}]: ${this.type(value)}${this.semi || ';'}`);
    }
    if (!lines.length) return '{}';
    return `{\n${lines.join('\n')}\n${indent}}`;
  }

  private indexKey(key: TypeNode): string {
    if (key.kind === 'primitive' && (key.name === 'int' || key.name === 'float' || key.name === 'number'))
      return 'number';
    if (key.kind === 'primitive' && key.name === 'symbol') return 'symbol';
    if (key.kind === 'template') return this.type(key);
    return 'string';
  }

  private property(prop: PropertyMember, indent: string): string {
    const previous = this.path;
    this.path = `${previous}.${prop.name}`;
    const optional = prop.optional || (prop.default !== undefined && this.defaultedFields === 'optional');
    const name = this.useAliases && prop.alias !== undefined ? prop.alias : applyCase(prop.name, this.propertyCase);
    const doc = this.jsDoc(prop.doc, indent, prop);
    const line = `${doc}${indent}${prop.readonly ? 'readonly ' : ''}${this.key(name)}${optional ? '?' : ''}: ${this.type(prop.type)}${this.semi || ';'}`;
    this.path = previous;
    return line;
  }

  private key(name: string): string {
    return isTsPropertyIdentifier(name) ? name : tsString(name, this.quote);
  }

  private typeParams(params: TypeParam[], variance: boolean): string {
    if (!params.length) return '';
    return `<${params
      .map((p) => {
        let text = p.name;
        if (variance && p.variance === 'covariant') text = `out ${text}`;
        if (variance && p.variance === 'contravariant') text = `in ${text}`;
        if (p.const) text = `const ${text}`;
        if (p.kind === 'param-spec' || p.kind === 'type-var-tuple') {
          // A ParamSpec or TypeVarTuple is a list of types: TypeScript spells that as a tuple-constrained parameter.
          text += ' extends unknown[]';
        } else if (p.constraints?.length) {
          this.diagnostics.info(
            'lossy-conversion',
            `TypeVar ${p.name} is constrained to exactly one of its types; TypeScript can only bound it by their union.`,
            { path: this.path },
          );
          text += ` extends ${p.constraints.map((c) => this.type(c)).join(' | ')}`;
        } else if (p.bound) text += ` extends ${this.type(p.bound)}`;
        if (p.default) text += ` = ${this.type(p.default)}`;
        return text;
      })
      .join(', ')}>`;
  }

  // -------------------------------------------------------------------------
  // Docs
  // -------------------------------------------------------------------------

  private jsDoc(doc: Doc | undefined, indent: string, prop?: PropertyMember): string {
    const lines: string[] = [];
    if (doc?.text) lines.push(...jsDocLines(doc.text));
    for (const tag of doc?.tags ?? []) lines.push(...jsDocLines(`@${tag.name}${tag.text ? ` ${tag.text}` : ''}`));
    if (doc?.deprecated !== undefined)
      lines.push(...jsDocLines(`@deprecated${doc.deprecated ? ` ${doc.deprecated}` : ''}`));
    const dflt = prop?.default;
    if (dflt && dflt.kind !== 'factory' && !(doc?.tags ?? []).some((t) => t.name === 'default')) {
      lines.push(`@default ${dflt.kind === 'literal' ? this.literalText(dflt.value) : dflt.text}`);
    }
    if (!lines.length) return '';
    if (lines.length === 1) return `${indent}/** ${lines[0]} */\n`;
    return `${indent}/**\n${lines.map((l) => `${indent} *${l ? ` ${l}` : ''}`).join('\n')}\n${indent} */\n`;
  }

  private literalText(value: string | number | boolean | null): string {
    if (value === null) return this.none;
    return typeof value === 'string' ? tsString(value, this.quote) : String(value);
  }

  // -------------------------------------------------------------------------
  // Types
  // -------------------------------------------------------------------------

  private global(name: string): string {
    return GLOBAL_TYPES.has(name) && this.names.has(name) ? `globalThis.${name}` : name;
  }

  type(node: TypeNode, prec: Prec = Prec.Union): string {
    const [text, own] = this.typeWithPrec(node);
    return own < prec ? `(${text})` : text;
  }

  private typeWithPrec(node: TypeNode): [string, Prec] {
    switch (node.kind) {
      case 'primitive':
        return [this.primitive(node.name), Prec.Postfix];
      case 'literal':
        return [this.literal(node), Prec.Postfix];
      case 'template': {
        const body = node.parts
          .map((p) =>
            typeof p === 'string' ? p.replace(/[`\\]/g, '\\$&').replace(/\$\{/g, '\\${') : `\${${this.type(p)}}`,
          )
          .join('');
        return [`\`${body}\``, Prec.Postfix];
      }
      case 'array':
        return [
          `${node.readonly ? 'readonly ' : ''}${this.type(node.element, Prec.Postfix)}[]`,
          node.readonly ? Prec.Operator : Prec.Postfix,
        ];
      case 'tuple':
        return this.tuple(node);
      case 'set':
        if (this.mode === 'json')
          return [
            `${node.readonly ? 'readonly ' : ''}${this.type(node.element, Prec.Postfix)}[]`,
            node.readonly ? Prec.Operator : Prec.Postfix,
          ];
        return [`${this.global(node.readonly ? 'ReadonlySet' : 'Set')}<${this.type(node.element)}>`, Prec.Postfix];
      case 'record':
        return [this.record(node), Prec.Postfix];
      case 'map': {
        const base = node.weak ? 'WeakMap' : node.readonly ? 'ReadonlyMap' : 'Map';
        return [`${this.global(base)}<${this.type(node.key)}, ${this.type(node.value)}>`, Prec.Postfix];
      }
      case 'reference': {
        const name = node.target === 'declaration' ? (this.names.get(node.name) ?? node.name) : node.name;
        const args = node.args.length ? `<${node.args.map((a) => this.type(a)).join(', ')}>` : '';
        return [`${name}${args}`, Prec.Postfix];
      }
      case 'well-known':
        return this.wellKnown(node);
      case 'union':
        return this.union(node.members);
      case 'intersection':
        return [node.members.map((m) => this.type(m, Prec.Intersection)).join(' & '), Prec.Intersection];
      case 'function':
        return [this.signature(node, ' => '), Prec.Union];
      case 'object':
        return [this.objectBody(node.members, node.indexSignatures, node.callSignatures, undefined, ''), Prec.Postfix];
      case 'enum-member': {
        const decl = this.enums.get(node.enumName);
        const member = decl?.members.find((m) => m.name === node.member);
        const style = decl ? this.enumStyleFor(decl) : 'union';
        if ((style === 'enum' || style === 'const-enum') && decl)
          return [`${this.names.get(decl.name)}.${node.member}`, Prec.Postfix];
        if (member && member.value !== null) return [this.literalText(member.value), Prec.Postfix];
        return [`${node.enumName}.${node.member}`, Prec.Postfix];
      }
      case 'class-of':
        return [`abstract new (...args: any) => ${this.type(node.type)}`, Prec.Union];
      case 'self':
        return ['this', Prec.Postfix];
      case 'opaque':
        if (node.language === 'typescript') return [node.text, Prec.Union];
        return ['unknown', Prec.Postfix];
      case 'raw':
        node.imports.forEach((i) => this.extraImports.add(i));
        return [node.text, Prec.Union];
    }
  }

  private primitive(name: Extract<TypeNode, { kind: 'primitive' }>['name']): string {
    switch (name) {
      case 'int':
        return this.int;
      case 'float':
      case 'number':
        return 'number';
      case 'complex':
        this.diagnostics.warn('unsupported-type', 'complex has no TypeScript counterpart; using unknown.', {
          path: this.path,
        });
        return 'unknown';
      case 'bytes':
        // pydantic serializes bytes as a UTF-8 (or base64, with ser_json_bytes) string.
        return this.mode === 'json' ? 'string' : 'Uint8Array';
      case 'none':
        return this.none;
      default:
        return name;
    }
  }

  private literal(node: Extract<TypeNode, { kind: 'literal' }>): string {
    const v = node.value;
    if (typeof v === 'string') return tsString(v, this.quote);
    if (typeof v === 'bigint') {
      if (this.int === 'bigint') return `${v}n`;
      this.diagnostics.warn(
        'lossy-conversion',
        `Literal ${v} is beyond Number.MAX_SAFE_INTEGER; it is typed as number.`,
        { path: this.path },
      );
      return 'number';
    }
    if (
      typeof v === 'number' &&
      this.int === 'bigint' &&
      Number.isInteger(v) &&
      !node.float &&
      this.module.language === 'python'
    )
      return `${v}n`;
    return String(v);
  }

  private tuple(node: Extract<TypeNode, { kind: 'tuple' }>): [string, Prec] {
    // tuple[T, ...] is an array of any length.
    if (node.elements.length === 1 && node.elements[0]!.rest === 'repeat') {
      return this.typeWithPrec({ kind: 'array', element: node.elements[0]!.type, readonly: node.readonly });
    }
    // Labels must be on every element or none.
    const labeled = node.elements.length > 0 && node.elements.every((e) => e.name);
    let seenOptional = false;
    const parts = node.elements.map((e) => {
      const label = labeled ? `${e.rest ? '...' : ''}${e.name}${e.optional ? '?' : ''}: ` : e.rest ? '...' : '';
      if (e.optional) seenOptional = true;
      let type =
        e.rest === 'repeat'
          ? `${this.type(e.type, Prec.Postfix)}[]`
          : this.type(e.type, e.optional && !labeled ? Prec.Postfix : Prec.Union);
      if (e.optional && !labeled) type += '?';
      return `${label}${type}`;
    });
    void seenOptional;
    const text = `[${parts.join(', ')}]`;
    return node.readonly ? [`readonly ${text}`, Prec.Operator] : [text, Prec.Postfix];
  }

  private record(node: Extract<TypeNode, { kind: 'record' }>): string {
    const key = node.key;
    let keyText: string;
    let partial = false;
    if (key.kind === 'primitive' && ['string', 'any', 'unknown'].includes(key.name)) keyText = 'string';
    else if (key.kind === 'primitive' && ['int', 'float', 'number'].includes(key.name)) keyText = 'number';
    else if (isLiteralKeys(key, this.enums)) {
      keyText = this.type(key);
      partial = true;
    } else {
      if (this.mode === 'runtime') {
        return `${this.global(node.readonly ? 'ReadonlyMap' : 'Map')}<${this.type(key)}, ${this.type(node.value)}>`;
      }
      this.diagnostics.info(
        'lossy-conversion',
        `JSON object keys are strings, so a ${this.type(key)} key is typed as string.`,
        { path: this.path },
      );
      keyText = 'string';
    }
    const value = this.type(node.value);
    let text: string;
    if (!partial && this.currentAlias && referencedNames([node.value]).has(this.currentAlias)) {
      // `Record<string, Json>` inside `type Json = ...` can be circular; an index signature never is.
      text = `{ ${node.readonly ? 'readonly ' : ''}[key: ${keyText}]: ${value} }`;
      return text;
    }
    text = `${this.global('Record')}<${keyText}, ${value}>`;
    // A dict need not have every key, unlike Record<'a' | 'b', V>.
    if (partial) text = `${this.global('Partial')}<${text}>`;
    if (node.readonly) text = `${this.global('Readonly')}<${text}>`;
    return text;
  }

  private wellKnown(node: Extract<TypeNode, { kind: 'well-known' }>): [string, Prec] {
    const json = this.mode === 'json';
    const arg = (i: number): string => (node.args[i] ? this.type(node.args[i]) : 'unknown');
    const g = (name: string, ...args: string[]): [string, Prec] => [
      `${this.global(name)}<${args.join(', ')}>`,
      Prec.Postfix,
    ];
    switch (node.name) {
      case 'datetime':
      case 'date':
        return [json ? 'string' : this.global('Date'), Prec.Postfix];
      case 'regex':
        return [json ? 'string' : this.global('RegExp'), Prec.Postfix];
      case 'time':
      case 'timedelta':
      case 'uuid':
      case 'decimal':
      case 'path':
      case 'url':
      case 'email':
      case 'ip-address':
      case 'secret':
        return ['string', Prec.Postfix];
      case 'error':
        return [this.global('Error'), Prec.Postfix];
      case 'iterable':
      case 'iterator':
        return json
          ? [`${this.type(node.args[0] ?? { kind: 'primitive', name: 'unknown' }, Prec.Postfix)}[]`, Prec.Postfix]
          : g(node.name === 'iterable' ? 'Iterable' : 'Iterator', arg(0));
      case 'async-iterable':
        return g('AsyncIterable', arg(0));
      case 'async-iterator':
        return g('AsyncIterator', arg(0));
      case 'generator':
        // Python Generator[Y, S, R] → TypeScript Generator<Y, R, S>.
        if (json)
          return [`${this.type(node.args[0] ?? { kind: 'primitive', name: 'unknown' }, Prec.Postfix)}[]`, Prec.Postfix];
        return g('Generator', arg(0), arg(2), arg(1));
      case 'async-generator':
        return g('AsyncGenerator', arg(0), 'void', arg(1));
      case 'awaitable':
        return g('Promise', arg(0));
    }
  }

  private union(members: TypeNode[]): [string, Prec] {
    // null/undefined last; members that print the same (int | float → number) once.
    const ordered = [...members.filter((m) => !isNullish(m)), ...members.filter(isNullish)];
    const texts = [...new Set(ordered.map((m) => this.type(m, Prec.Intersection)))];
    return [texts.join(' | '), texts.length > 1 ? Prec.Union : Prec.Postfix];
  }

  private signature(fn: FunctionType, arrow?: string): string {
    const params: string[] = [];
    let optionalSeen = false;
    let keywordOnly = false;
    for (const p of fn.params) {
      if (p.kind === 'keyword-only') keywordOnly = true;
      if (p.kind === 'var-positional') {
        params.push(`...${p.name}: ${this.type(p.type, Prec.Postfix)}[]`);
        continue;
      }
      if (p.kind === 'var-keyword') {
        params.push(this.kwargs(p));
        continue;
      }
      let optional = p.optional;
      if (optional) optionalSeen = true;
      else if (optionalSeen) {
        this.diagnostics.info(
          'lossy-conversion',
          `Parameter ${p.name} is required but follows an optional one; TypeScript requires it to be optional too.`,
          {
            path: this.path,
          },
        );
        optional = true;
      }
      params.push(`${safeParam(p.name)}${optional ? '?' : ''}: ${this.type(p.type)}`);
    }
    if (keywordOnly) {
      this.diagnostics.info('lossy-conversion', 'Keyword-only parameters are positional in TypeScript.', {
        path: this.path,
      });
    }
    if (fn.anyParams) params.push('...args: any[]');
    if (fn.paramSpec) params.push(`...args: ${fn.paramSpec}`);
    const typeParams = this.typeParams(fn.typeParams, false);
    const returns = this.type(fn.returns);
    const head = `${fn.construct ? 'new ' : ''}${typeParams}(${params.join(', ')})`;
    return arrow === ' => ' ? `${head} => ${returns}` : `${head}${arrow ?? ': '}${returns}`;
  }

  private kwargs(p: Parameter): string {
    if (p.unpacked) return `${safeParam(p.name)}: ${this.type(p.type)}`;
    this.diagnostics.info('lossy-conversion', `**${p.name} becomes a trailing options object.`, { path: this.path });
    return `${safeParam(p.name)}?: ${this.global('Record')}<string, ${this.type(p.type)}>`;
  }
}

function collectDeclTypes(decl: Declaration, out: TypeNode[]): void {
  switch (decl.kind) {
    case 'object':
      out.push(...decl.bases, ...decl.callSignatures, ...decl.indexSignatures.flatMap((s) => [s.key, s.value]));
      for (const m of decl.members) out.push(...(m.kind === 'property' ? [m.type] : m.signatures));
      return;
    case 'alias':
    case 'newtype':
      out.push(decl.type);
      return;
    case 'enum':
      return;
  }
}

function isStringKey(key: TypeNode): boolean {
  return key.kind === 'primitive' && ['string', 'any', 'unknown'].includes(key.name);
}

function isTop(node: TypeNode): boolean {
  return node.kind === 'primitive' && (node.name === 'any' || node.name === 'unknown');
}

/** Keys that are a finite set: literals and enum types. */
function isLiteralKeys(key: TypeNode, enums: Map<string, EnumDeclaration>): boolean {
  return unionMembers(key).every(
    (m) => m.kind === 'literal' || m.kind === 'enum-member' || (m.kind === 'reference' && enums.has(m.name)),
  );
}

const RESERVED_PARAMS = new Set([
  'this',
  'new',
  'class',
  'function',
  'delete',
  'default',
  'in',
  'typeof',
  'var',
  'void',
  'with',
  'enum',
  'export',
  'import',
  'super',
  'switch',
  'throw',
  'try',
  'catch',
  'case',
  'const',
  'continue',
  'debugger',
  'do',
  'else',
  'extends',
  'false',
  'finally',
  'for',
  'if',
  'instanceof',
  'null',
  'return',
  'true',
  'while',
  'break',
  'yield',
  'let',
  'static',
  'implements',
  'interface',
  'package',
  'private',
  'protected',
  'public',
  'await',
]);

function safeParam(name: string): string {
  return RESERVED_PARAMS.has(name) ? `${name}_` : name;
}
