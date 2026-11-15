import ts from 'typescript';
import { DiagnosticBag, ParseError } from '../diagnostics.js';
import { t, unionOf } from '../ir/build.js';
import type {
  Declaration,
  DefaultValue,
  Doc,
  DocTag,
  EnumDeclaration,
  EnumMember,
  FunctionType,
  IndexSignature,
  MethodMember,
  ModuleImport,
  ObjectDeclaration,
  ObjectType,
  Parameter,
  PropertyMember,
  SourceLocation,
  TupleElement,
  TypeModule,
  TypeNode,
  TypeParam,
  Variance,
  WellKnownName,
} from '../ir/types.js';
import type { TypeMap } from '../options.js';
import { parseTsModule } from '../shared/modules.js';
import { createInputProgram, isInputDeclaration, isLibDeclaration } from './program.js';

export interface ParseTypeScriptOptions {
  /** Source-to-target overrides; see {@link TypeMap}. Default: none. */
  typeMap?: TypeMap;
  /** Keep members whose names start with `_`. Default: false. */
  includePrivate?: boolean;
}

/**
 * Parses TypeScript source into a {@link TypeModule} with the TypeScript compiler.
 *
 * Declarations are lowered from their syntax, so they keep the shape they were written in. Types that only exist
 * after evaluation (`Partial<T>`, `Pick`, mapped and conditional types, `keyof`, indexed access, `typeof`) are
 * resolved by the type checker. Throws `ParseError` on a syntax error.
 */
export function parseTypeScript(source: string, options: ParseTypeScriptOptions = {}): TypeModule {
  return new TypeScriptLowering(source, options).run();
}

/** Names TypeScript's default library declares that have a direct counterpart. */
type LibHandler = (args: TypeNode[]) => TypeNode;

const wk = (name: WellKnownName, args: TypeNode[] = []): TypeNode => ({ kind: 'well-known', name, args });
const BYTES = (): TypeNode => t.primitive('bytes');
const ERROR = (): TypeNode => wk('error');

const LIB_TYPES: Record<string, LibHandler> = {
  Array: (a) => t.array(a[0] ?? t.unknown()),
  ReadonlyArray: (a) => t.array(a[0] ?? t.unknown(), true),
  Set: (a) => ({ kind: 'set', element: a[0] ?? t.unknown(), readonly: false }),
  ReadonlySet: (a) => ({ kind: 'set', element: a[0] ?? t.unknown(), readonly: true }),
  WeakSet: (a) => ({ kind: 'set', element: a[0] ?? t.unknown(), readonly: false }),
  Map: (a) => ({ kind: 'map', key: a[0] ?? t.unknown(), value: a[1] ?? t.unknown(), readonly: false }),
  ReadonlyMap: (a) => ({ kind: 'map', key: a[0] ?? t.unknown(), value: a[1] ?? t.unknown(), readonly: true }),
  WeakMap: (a) => ({ kind: 'map', key: a[0] ?? t.unknown(), value: a[1] ?? t.unknown(), readonly: false, weak: true }),
  Promise: (a) => wk('awaitable', [a[0] ?? t.unknown()]),
  PromiseLike: (a) => wk('awaitable', [a[0] ?? t.unknown()]),
  Date: () => wk('datetime'),
  RegExp: () => wk('regex'),
  URL: () => wk('url'),
  Error: ERROR,
  TypeError: ERROR,
  RangeError: ERROR,
  SyntaxError: ERROR,
  EvalError: ERROR,
  ReferenceError: ERROR,
  URIError: ERROR,
  AggregateError: ERROR,
  Uint8Array: BYTES,
  Uint8ClampedArray: BYTES,
  ArrayBuffer: BYTES,
  SharedArrayBuffer: BYTES,
  DataView: BYTES,
  Buffer: BYTES,
  Blob: BYTES,
  Iterable: (a) => wk('iterable', [a[0] ?? t.unknown()]),
  Iterator: (a) => wk('iterator', [a[0] ?? t.unknown()]),
  IterableIterator: (a) => wk('iterator', [a[0] ?? t.unknown()]),
  IteratorObject: (a) => wk('iterator', [a[0] ?? t.unknown()]),
  AsyncIterable: (a) => wk('async-iterable', [a[0] ?? t.unknown()]),
  AsyncIterator: (a) => wk('async-iterator', [a[0] ?? t.unknown()]),
  AsyncIterableIterator: (a) => wk('async-iterator', [a[0] ?? t.unknown()]),
  // Generator<T, TReturn, TNext> → Python's Generator[Y, S, R] order: [yield, send, return].
  Generator: (a) => wk('generator', [a[0] ?? t.unknown(), a[2] ?? t.any(), a[1] ?? t.any()]),
  AsyncGenerator: (a) => wk('async-generator', [a[0] ?? t.unknown(), a[2] ?? t.any()]),
  Function: () => t.fn([], t.any(), { anyParams: true }),
  CallableFunction: () => t.fn([], t.any(), { anyParams: true }),
  Object: () => t.primitive('object'),
  String: () => t.primitive('string'),
  Number: () => t.primitive('number'),
  Boolean: () => t.primitive('boolean'),
  BigInt: () => t.primitive('bigint'),
  Symbol: () => t.primitive('symbol'),
  NoInfer: (a) => a[0] ?? t.unknown(),
};

for (const name of ['Int8Array', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array']) {
  LIB_TYPES[name] = () => t.array(t.primitive('int'));
}
for (const name of ['Float16Array', 'Float32Array', 'Float64Array'])
  LIB_TYPES[name] = () => t.array(t.primitive('float'));
for (const name of ['BigInt64Array', 'BigUint64Array']) LIB_TYPES[name] = () => t.array(t.primitive('bigint'));

const BRAND_KEY = /^_{1,2}[A-Za-z]*(brand|type|tag|kind|opaque|nominal|flavor|flavour)$/i;

interface Ctx {
  /** Type parameter names in scope. */
  scope: Set<string>;
  path: string;
  /** The alias being lowered: its own alias symbol must not be turned back into a reference to itself. */
  self?: ts.Symbol;
}

type DeclNode = ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration | ts.ClassDeclaration;

class TypeScriptLowering {
  private readonly diagnostics = new DiagnosticBag();
  private readonly checker: ts.TypeChecker;
  private readonly sourceFile: ts.SourceFile;
  private readonly source: string;
  private readonly options: ParseTypeScriptOptions;
  /** Declared symbol → the (namespace-flattened) name it is emitted under. */
  private readonly names = new Map<ts.Symbol, string>();
  private readonly exportedNames = new Set<string>();
  /** Member names of each declared enum, to fold a union of all of them back into the enum. */
  private readonly enumMembers = new Map<string, string[]>();
  private readonly imports: ModuleImport[] = [];
  private readonly declarations: Declaration[] = [];
  private depth = 0;

  constructor(source: string, options: ParseTypeScriptOptions) {
    this.source = source;
    this.options = options;
    const { program, checker, sourceFile } = createInputProgram(source);
    this.checker = checker;
    this.sourceFile = sourceFile;
    const syntax = program.getSyntacticDiagnostics(sourceFile);
    if (syntax.length) {
      const first = syntax[0]!;
      throw new ParseError({
        language: 'typescript',
        message: ts.flattenDiagnosticMessageText(first.messageText, '\n'),
        loc: this.locAt(first.start ?? 0),
        source,
      });
    }
  }

  run(): TypeModule {
    const found: { node: DeclNode; name: string; exported: boolean }[] = [];
    this.collect(this.sourceFile.statements, '', false, found);

    // Interfaces merge across declarations (and into a class of the same name).
    const groups = new Map<string, { node: DeclNode; exported: boolean }[]>();
    for (const item of found) {
      const group = groups.get(item.name) ?? [];
      group.push(item);
      groups.set(item.name, group);
    }
    for (const [name, group] of groups) {
      const exported = group.some((g) => g.exported) || this.exportedNames.has(name);
      const decl = this.lowerGroup(
        name,
        group.map((g) => g.node),
      );
      if (!decl) continue;
      decl.exported = exported;
      this.declarations.push(decl);
    }
    return {
      language: 'typescript',
      declarations: this.declarations,
      imports: this.imports,
      diagnostics: this.diagnostics.items,
    };
  }

  // -------------------------------------------------------------------------
  // Collection
  // -------------------------------------------------------------------------

  private collect(
    statements: readonly ts.Statement[],
    prefix: string,
    inNamespace: boolean,
    out: { node: DeclNode; name: string; exported: boolean }[],
  ): void {
    for (const stmt of statements) {
      const exported = inNamespace || hasModifier(stmt, ts.SyntaxKind.ExportKeyword);
      if (
        ts.isInterfaceDeclaration(stmt) ||
        ts.isTypeAliasDeclaration(stmt) ||
        ts.isEnumDeclaration(stmt) ||
        (ts.isClassDeclaration(stmt) && stmt.name)
      ) {
        const name = prefix + stmt.name!.text;
        if (ts.isEnumDeclaration(stmt)) {
          const members = this.enumMembers.get(name) ?? [];
          members.push(...stmt.members.map((m) => m.name.getText().replace(/^['"]|['"]$/g, '')));
          this.enumMembers.set(name, members);
        }
        const symbol = this.checker.getSymbolAtLocation(stmt.name!);
        if (symbol) this.names.set(symbol, name);
        out.push({ node: stmt, name, exported });
      } else if (ts.isModuleDeclaration(stmt)) {
        this.collectNamespace(stmt, prefix, out);
      } else if (ts.isImportDeclaration(stmt)) {
        this.collectImport(stmt);
      } else if (
        ts.isExportDeclaration(stmt) &&
        !stmt.moduleSpecifier &&
        stmt.exportClause &&
        ts.isNamedExports(stmt.exportClause)
      ) {
        for (const spec of stmt.exportClause.elements)
          this.exportedNames.add(prefix + (spec.propertyName ?? spec.name).getText());
      } else if (ts.isExportAssignment(stmt) && ts.isIdentifier(stmt.expression)) {
        this.exportedNames.add(prefix + stmt.expression.text);
      } else if (ts.isFunctionDeclaration(stmt) && stmt.name) {
        this.diagnostics.info('skipped-statement', `Function ${stmt.name.text} is not a type and was skipped.`, {
          loc: this.loc(stmt),
          path: stmt.name.text,
        });
      }
    }
  }

  private collectNamespace(
    stmt: ts.ModuleDeclaration,
    prefix: string,
    out: { node: DeclNode; name: string; exported: boolean }[],
  ): void {
    // `declare global {}` and `declare module 'x' {}` contribute their declarations unprefixed.
    const isGlobal =
      stmt.name.kind === ts.SyntaxKind.StringLiteral || (stmt.flags & ts.NodeFlags.GlobalAugmentation) !== 0;
    let body = stmt.body;
    let name = isGlobal ? '' : stmt.name.text;
    while (body && ts.isModuleDeclaration(body)) {
      name += body.name.text;
      body = body.body;
    }
    if (!body || !ts.isModuleBlock(body)) return;
    if (name) {
      this.diagnostics.info('restructured', `Namespace ${name}'s declarations are flattened to ${name}<Name>.`, {
        loc: this.loc(stmt),
        path: name,
      });
    }
    this.collect(body.statements, prefix + name, true, out);
  }

  private collectImport(stmt: ts.ImportDeclaration): void {
    if (!ts.isStringLiteral(stmt.moduleSpecifier) || !stmt.importClause) return;
    const clause = stmt.importClause;
    const names: { name: string; alias?: string }[] = [];
    if (clause.name) names.push({ name: 'default', alias: clause.name.text });
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const el of clause.namedBindings.elements) {
        names.push(el.propertyName ? { name: el.propertyName.getText(), alias: el.name.text } : { name: el.name.text });
      }
    }
    if (names.length)
      this.imports.push({ module: parseTsModule(stmt.moduleSpecifier.text), names, loc: this.loc(stmt) });
  }

  // -------------------------------------------------------------------------
  // Declarations
  // -------------------------------------------------------------------------

  private lowerGroup(name: string, nodes: DeclNode[]): Declaration | undefined {
    const first = nodes[0]!;
    if (ts.isTypeAliasDeclaration(first)) return this.lowerAlias(name, first);
    if (ts.isEnumDeclaration(first)) return this.lowerEnum(name, nodes.filter(ts.isEnumDeclaration));
    const classNode = nodes.find(ts.isClassDeclaration);
    const decl = this.objectDeclaration(name, classNode ?? first, classNode ? 'class' : 'interface');
    for (const node of nodes) {
      if (ts.isInterfaceDeclaration(node)) this.fillInterface(decl, node);
      else if (ts.isClassDeclaration(node)) this.fillClass(decl, node);
    }
    return decl;
  }

  private objectDeclaration(
    name: string,
    node: ts.InterfaceDeclaration | ts.ClassDeclaration,
    flavor: 'interface' | 'class',
  ): ObjectDeclaration {
    const ctx = this.ctx(name);
    const typeParams = this.lowerTypeParams(node.typeParameters, ctx);
    const decl: ObjectDeclaration = {
      kind: 'object',
      name,
      flavor,
      typeParams,
      bases: [],
      members: [],
      indexSignatures: [],
      callSignatures: [],
      exported: false,
      loc: this.loc(node),
    };
    const doc = this.docOf(node);
    if (doc) decl.doc = doc;
    if (ts.isClassDeclaration(node) && hasModifier(node, ts.SyntaxKind.AbstractKeyword)) decl.abstract = true;
    return decl;
  }

  private ctx(path: string, scope: Iterable<string> = []): Ctx {
    return { scope: new Set(scope), path };
  }

  private declCtx(decl: ObjectDeclaration, node: ts.Node): Ctx {
    void node;
    return this.ctx(
      decl.name,
      decl.typeParams.map((p) => p.name),
    );
  }

  private fillInterface(decl: ObjectDeclaration, node: ts.InterfaceDeclaration): void {
    const ctx = this.declCtx(decl, node);
    for (const clause of node.heritageClauses ?? []) {
      for (const base of clause.types) this.addBase(decl, base, ctx);
    }
    for (const member of node.members) this.addTypeElement(decl, member, ctx);
  }

  /** A base is kept as a reference when it names a declaration; otherwise (`extends Omit<A, 'x'>`) its members are copied in. */
  private addBase(decl: ObjectDeclaration, base: ts.ExpressionWithTypeArguments, ctx: Ctx): void {
    const symbol = this.resolveSymbol(this.checker.getSymbolAtLocation(base.expression));
    if (symbol && this.names.has(symbol)) {
      const args = (base.typeArguments ?? []).map((a) => this.lowerTypeNode(a, ctx));
      decl.bases.push(t.reference(this.names.get(symbol)!, args, 'declaration'));
      return;
    }
    if (symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0) {
      decl.bases.push(
        t.reference(
          base.expression.getText(),
          (base.typeArguments ?? []).map((a) => this.lowerTypeNode(a, ctx)),
          'import',
        ),
      );
      return;
    }
    const type = this.checker.getTypeAtLocation(base);
    const lowered = this.typeToIR(type, ctx);
    if (lowered.kind === 'object') {
      decl.members.push(...lowered.members);
      decl.indexSignatures.push(...lowered.indexSignatures);
      this.diagnostics.info('restructured', `Base ${base.getText()} was expanded into ${decl.name}'s own members.`, {
        loc: this.loc(base),
        path: decl.name,
      });
    } else if (lowered.kind === 'reference') decl.bases.push(lowered);
    else {
      this.diagnostics.warn('unsupported-type', `Base ${base.getText()} is not an object type; it was dropped.`, {
        loc: this.loc(base),
        path: decl.name,
      });
    }
  }

  private addTypeElement(target: ObjectDeclaration | ObjectType, member: ts.TypeElement, ctx: Ctx): void {
    const path = (name: string): string => `${ctx.path}.${name}`;
    if (ts.isPropertySignature(member)) {
      const name = this.propertyName(member.name, ctx);
      if (name === undefined || this.isPrivateName(name)) return;
      const prop: PropertyMember = {
        kind: 'property',
        name,
        type: member.type ? this.lowerTypeNode(member.type, { ...ctx, path: path(name) }) : t.any(),
        optional: member.questionToken !== undefined,
        readonly: hasModifier(member, ts.SyntaxKind.ReadonlyKeyword),
        loc: this.loc(member),
      };
      if (prop.optional) prop.type = stripUndefined(prop.type);
      const doc = this.docOf(member);
      if (doc) prop.doc = doc;
      target.members.push(prop);
    } else if (ts.isMethodSignature(member)) {
      const name = this.propertyName(member.name, ctx);
      if (name === undefined || this.isPrivateName(name)) return;
      const signature = this.lowerSignature(member, { ...ctx, path: path(name) });
      const existing = target.members.find((m): m is MethodMember => m.kind === 'method' && m.name === name);
      if (existing) existing.signatures.push(signature);
      else {
        const method: MethodMember = {
          kind: 'method',
          name,
          signatures: [signature],
          optional: member.questionToken !== undefined,
          loc: this.loc(member),
        };
        const doc = this.docOf(member);
        if (doc) method.doc = doc;
        target.members.push(method);
      }
    } else if (ts.isCallSignatureDeclaration(member)) {
      target.callSignatures.push(this.lowerSignature(member, ctx));
    } else if (ts.isIndexSignatureDeclaration(member)) {
      const sig = this.lowerIndexSignature(member, ctx);
      if (sig) target.indexSignatures.push(sig);
    } else if (ts.isConstructSignatureDeclaration(member)) {
      this.diagnostics.warn('unsupported-syntax', 'Construct signatures in an object type are not converted.', {
        loc: this.loc(member),
        path: ctx.path,
      });
    } else if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
      this.addAccessor(target, member, ctx);
    }
  }

  private addAccessor(
    target: ObjectDeclaration | ObjectType,
    member: ts.GetAccessorDeclaration | ts.SetAccessorDeclaration,
    ctx: Ctx,
  ): void {
    const name = this.propertyName(member.name, ctx);
    if (name === undefined || this.isPrivateName(name)) return;
    const existing = target.members.find((m): m is PropertyMember => m.kind === 'property' && m.name === name);
    if (ts.isSetAccessorDeclaration(member)) {
      if (existing) existing.readonly = false;
      else {
        const param = member.parameters[0];
        const type = param?.type ? this.lowerTypeNode(param.type, ctx) : t.any();
        target.members.push({ kind: 'property', name, type, optional: false, readonly: false, loc: this.loc(member) });
      }
      return;
    }
    const type = member.type
      ? this.lowerTypeNode(member.type, ctx)
      : this.typeToIR(this.checker.getTypeAtLocation(member.name), ctx);
    if (existing) {
      existing.type = type;
      return;
    }
    // A getter alone is read-only; a matching setter later makes it writable.
    const hasSetter = (
      member.parent as ts.ClassLikeDeclaration | ts.InterfaceDeclaration | ts.TypeLiteralNode
    ).members.some((m: ts.Node) => ts.isSetAccessorDeclaration(m) && m.name.getText() === member.name.getText());
    const prop: PropertyMember = {
      kind: 'property',
      name,
      type,
      optional: false,
      readonly: !hasSetter,
      loc: this.loc(member),
    };
    if (hasModifier(member, ts.SyntaxKind.StaticKeyword)) prop.static = true;
    const doc = this.docOf(member);
    if (doc) prop.doc = doc;
    target.members.push(prop);
  }

  private lowerIndexSignature(member: ts.IndexSignatureDeclaration, ctx: Ctx): IndexSignature | undefined {
    const param = member.parameters[0];
    if (!param?.type) return undefined;
    return {
      key: this.lowerTypeNode(param.type, ctx),
      value: this.lowerTypeNode(member.type, ctx),
      readonly: hasModifier(member, ts.SyntaxKind.ReadonlyKeyword),
    };
  }

  private fillClass(decl: ObjectDeclaration, node: ts.ClassDeclaration): void {
    const ctx = this.declCtx(decl, node);
    for (const clause of node.heritageClauses ?? []) {
      if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
      for (const base of clause.types) this.addBase(decl, base, ctx);
    }
    for (const member of node.members) {
      if (ts.isPropertyDeclaration(member)) this.addClassProperty(decl, member, ctx);
      else if (ts.isMethodDeclaration(member)) this.addClassMethod(decl, member, ctx);
      else if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
        if (!this.isHidden(member)) this.addAccessor(decl, member, ctx);
      } else if (ts.isConstructorDeclaration(member)) {
        for (const param of member.parameters) {
          if (!ts.isParameterPropertyDeclaration(param, member) || this.isHidden(param) || !ts.isIdentifier(param.name))
            continue;
          const name = param.name.text;
          const prop: PropertyMember = {
            kind: 'property',
            name,
            type: param.type
              ? this.lowerTypeNode(param.type, ctx)
              : this.typeToIR(this.checker.getTypeAtLocation(param), ctx),
            optional: param.questionToken !== undefined,
            readonly: hasModifier(param, ts.SyntaxKind.ReadonlyKeyword),
            loc: this.loc(param),
          };
          if (param.initializer) prop.default = this.defaultOf(param.initializer);
          decl.members.push(prop);
        }
      } else if (ts.isIndexSignatureDeclaration(member)) {
        const sig = this.lowerIndexSignature(member, ctx);
        if (sig) decl.indexSignatures.push(sig);
      }
    }
  }

  /** `private`, `protected` and `#private` members are not part of the public shape. */
  private isHidden(node: ts.Declaration): boolean {
    const flags = ts.getCombinedModifierFlags(node);
    if (flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) return true;
    const name = (node as ts.NamedDeclaration).name;
    return name !== undefined && ts.isPrivateIdentifier(name);
  }

  private addClassProperty(decl: ObjectDeclaration, member: ts.PropertyDeclaration, ctx: Ctx): void {
    if (this.isHidden(member)) return;
    const name = this.propertyName(member.name, ctx);
    if (name === undefined || this.isPrivateName(name)) return;
    const type = member.type
      ? this.lowerTypeNode(member.type, { ...ctx, path: `${ctx.path}.${name}` })
      : this.typeToIR(this.checker.getTypeAtLocation(member), { ...ctx, path: `${ctx.path}.${name}` });
    const prop: PropertyMember = {
      kind: 'property',
      name,
      type: member.questionToken ? stripUndefined(type) : type,
      optional: member.questionToken !== undefined,
      readonly: hasModifier(member, ts.SyntaxKind.ReadonlyKeyword),
      loc: this.loc(member),
    };
    if (hasModifier(member, ts.SyntaxKind.StaticKeyword)) prop.static = true;
    if (member.initializer) prop.default = this.defaultOf(member.initializer);
    const doc = this.docOf(member);
    if (doc) prop.doc = doc;
    decl.members.push(prop);
  }

  private addClassMethod(decl: ObjectDeclaration, member: ts.MethodDeclaration, ctx: Ctx): void {
    if (this.isHidden(member)) return;
    const name = this.propertyName(member.name, ctx);
    if (name === undefined || this.isPrivateName(name)) return;
    // With overloads, the implementation signature is not externally visible.
    const siblings = decl.members.find((m): m is MethodMember => m.kind === 'method' && m.name === name);
    if (
      member.body &&
      siblings &&
      (member.parent as ts.ClassLikeDeclaration).members.some(
        (m: ts.ClassElement) =>
          m !== member && ts.isMethodDeclaration(m) && !m.body && m.name.getText() === member.name.getText(),
      )
    ) {
      return;
    }
    const signature = this.lowerSignature(member, { ...ctx, path: `${ctx.path}.${name}` });
    if (siblings) {
      siblings.signatures.push(signature);
      return;
    }
    const method: MethodMember = {
      kind: 'method',
      name,
      signatures: [signature],
      optional: member.questionToken !== undefined,
      loc: this.loc(member),
    };
    if (hasModifier(member, ts.SyntaxKind.StaticKeyword)) method.static = true;
    const doc = this.docOf(member);
    if (doc) method.doc = doc;
    decl.members.push(method);
  }

  private defaultOf(expr: ts.Expression): DefaultValue {
    const text = expr.getText();
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr))
      return { kind: 'literal', value: expr.text, text };
    if (ts.isNumericLiteral(expr)) return { kind: 'literal', value: Number(expr.text), text };
    if (
      ts.isPrefixUnaryExpression(expr) &&
      expr.operator === ts.SyntaxKind.MinusToken &&
      ts.isNumericLiteral(expr.operand)
    ) {
      return { kind: 'literal', value: -Number(expr.operand.text), text };
    }
    if (expr.kind === ts.SyntaxKind.TrueKeyword) return { kind: 'literal', value: true, text };
    if (expr.kind === ts.SyntaxKind.FalseKeyword) return { kind: 'literal', value: false, text };
    if (expr.kind === ts.SyntaxKind.NullKeyword) return { kind: 'literal', value: null, text };
    if (ts.isArrayLiteralExpression(expr) || ts.isObjectLiteralExpression(expr) || ts.isNewExpression(expr)) {
      return { kind: 'factory', text };
    }
    return { kind: 'expression', text, language: 'typescript' };
  }

  private lowerAlias(name: string, node: ts.TypeAliasDeclaration): Declaration {
    const ctx = this.ctx(name);
    const typeParams = this.lowerTypeParams(node.typeParameters, ctx);
    ctx.scope = new Set(typeParams.map((p) => p.name));
    const symbol = this.checker.getSymbolAtLocation(node.name);
    if (symbol) ctx.self = symbol;
    const doc = this.docOf(node);
    const base = { name, typeParams, exported: false, loc: this.loc(node), ...(doc ? { doc } : {}) };

    const brand = this.brandedBase(node.type, ctx);
    if (brand) return { kind: 'newtype', ...base, type: brand };

    // An alias of an object literal is an object declaration in all but name.
    if (ts.isTypeLiteralNode(node.type)) {
      const object = this.lowerTypeNode(node.type, ctx) as ObjectType;
      return {
        kind: 'object',
        flavor: 'type-literal',
        ...base,
        bases: [],
        members: object.members,
        indexSignatures: object.indexSignatures,
        callSignatures: object.callSignatures,
      };
    }
    return { kind: 'alias', ...base, type: this.lowerTypeNode(node.type, ctx) };
  }

  /** `string & { readonly __brand: 'UserId' }` is a nominal type over `string`: Python's NewType. */
  private brandedBase(node: ts.TypeNode, ctx: Ctx): TypeNode | undefined {
    if (!ts.isIntersectionTypeNode(node)) return undefined;
    const brands = node.types.filter(
      (m) =>
        ts.isTypeLiteralNode(m) &&
        m.members.length > 0 &&
        m.members.every((p) => {
          if (!ts.isPropertySignature(p)) return false;
          if (ts.isComputedPropertyName(p.name)) return true; // [brand]: unique symbol
          return BRAND_KEY.test(p.name.getText().replace(/['"]/g, ''));
        }),
    );
    const rest = node.types.filter((m) => !brands.includes(m));
    if (brands.length === 0 || rest.length !== 1) return undefined;
    const base = this.lowerTypeNode(rest[0]!, ctx);
    return base.kind === 'primitive' || base.kind === 'reference' || base.kind === 'well-known' ? base : undefined;
  }

  private lowerEnum(name: string, nodes: ts.EnumDeclaration[]): EnumDeclaration {
    const members: EnumMember[] = [];
    let flagHint = false;
    for (const node of nodes) {
      for (const member of node.members) {
        const memberName = member.name.getText().replace(/^['"]|['"]$/g, '');
        const value = this.checker.getConstantValue(member);
        if (member.initializer && ts.isBinaryExpression(member.initializer)) {
          const op = member.initializer.operatorToken.kind;
          if (op === ts.SyntaxKind.LessThanLessThanToken || op === ts.SyntaxKind.BarToken) flagHint = true;
        }
        const entry: EnumMember = { name: memberName, value: value ?? null, loc: this.loc(member) };
        if (value === undefined) {
          this.diagnostics.warn(
            'unsupported-type',
            `Enum member ${name}.${memberName} is computed at runtime; it is emitted as null.`,
            {
              loc: this.loc(member),
              path: `${name}.${memberName}`,
            },
          );
        }
        const doc = this.docOf(member);
        if (doc) entry.doc = doc;
        members.push(entry);
      }
    }
    const values = members.map((m) => m.value);
    const flavor = values.every((v) => typeof v === 'string')
      ? 'string'
      : values.every((v) => typeof v === 'number')
        ? flagHint
          ? 'flag'
          : 'number'
        : 'mixed';
    const decl: EnumDeclaration = {
      kind: 'enum',
      name,
      flavor,
      members,
      typeParams: [],
      exported: false,
      loc: this.loc(nodes[0]!),
    };
    if (nodes.some((n) => hasModifier(n, ts.SyntaxKind.ConstKeyword))) decl.const = true;
    const doc = this.docOf(nodes[0]!);
    if (doc) decl.doc = doc;
    return decl;
  }

  // -------------------------------------------------------------------------
  // Signatures and type parameters
  // -------------------------------------------------------------------------

  private lowerTypeParams(params: ts.NodeArray<ts.TypeParameterDeclaration> | undefined, ctx: Ctx): TypeParam[] {
    if (!params) return [];
    const inner: Ctx = { ...ctx, scope: new Set([...ctx.scope, ...params.map((p) => p.name.text)]) };
    return params.map((p) => {
      const isIn = hasModifier(p, ts.SyntaxKind.InKeyword);
      const isOut = hasModifier(p, ts.SyntaxKind.OutKeyword);
      const variance: Variance =
        isIn && isOut ? 'invariant' : isIn ? 'contravariant' : isOut ? 'covariant' : 'inferred';
      const param: TypeParam = { name: p.name.text, kind: 'type', variance };
      if (p.constraint) param.bound = this.lowerTypeNode(p.constraint, inner);
      if (p.default) param.default = this.lowerTypeNode(p.default, inner);
      if (hasModifier(p, ts.SyntaxKind.ConstKeyword)) param.const = true;
      return param;
    });
  }

  private lowerSignature(node: ts.SignatureDeclarationBase, outer: Ctx): FunctionType {
    const typeParams = this.lowerTypeParams(node.typeParameters, outer);
    const ctx: Ctx = { ...outer, scope: new Set([...outer.scope, ...typeParams.map((p) => p.name)]) };
    const params: Parameter[] = [];
    for (const p of node.parameters) {
      const name = ts.isIdentifier(p.name) ? p.name.text : `arg${params.length}`;
      if (name === 'this') continue;
      const type = p.type ? this.lowerTypeNode(p.type, ctx) : t.any();
      if (p.dotDotDotToken) {
        if (type.kind === 'array') params.push({ name, type: type.element, optional: false, kind: 'var-positional' });
        else if (type.kind === 'tuple' && type.elements.every((e) => !e.rest)) {
          // `...args: [a: string, b?: number]` is a positional list.
          type.elements.forEach((e, i) =>
            params.push({ name: e.name ?? `arg${i}`, type: e.type, optional: e.optional ?? false, kind: 'positional' }),
          );
        } else {
          this.diagnostics.info(
            'lossy-conversion',
            `Rest parameter ${name}: ${p.type?.getText() ?? 'any'} is typed as Any.`,
            { loc: this.loc(p), path: ctx.path },
          );
          params.push({ name, type: t.any(), optional: false, kind: 'var-positional' });
        }
        continue;
      }
      const optional = p.questionToken !== undefined || p.initializer !== undefined;
      const param: Parameter = { name, type: optional ? stripUndefined(type) : type, optional, kind: 'positional' };
      if (p.initializer) param.defaultText = p.initializer.getText();
      params.push(param);
    }
    let returns: TypeNode;
    if (!node.type) {
      const signature = this.checker.getSignatureFromDeclaration(node as ts.SignatureDeclaration);
      returns = signature ? this.typeToIR(this.checker.getReturnTypeOfSignature(signature), ctx) : t.any();
    } else if (ts.isTypePredicateNode(node.type)) {
      returns = node.type.assertsModifier ? t.primitive('void') : t.primitive('boolean');
    } else returns = this.lowerTypeNode(node.type, ctx);
    const fn: FunctionType = { kind: 'function', params, returns, typeParams };
    if (ts.isConstructorTypeNode(node) || ts.isConstructSignatureDeclaration(node)) fn.construct = true;
    return fn;
  }

  // -------------------------------------------------------------------------
  // Type nodes
  // -------------------------------------------------------------------------

  lowerTypeNode(node: ts.TypeNode, ctx: Ctx): TypeNode {
    switch (node.kind) {
      case ts.SyntaxKind.StringKeyword:
        return t.primitive('string');
      case ts.SyntaxKind.NumberKeyword:
        return t.primitive('number');
      case ts.SyntaxKind.BooleanKeyword:
        return t.primitive('boolean');
      case ts.SyntaxKind.BigIntKeyword:
        return t.primitive('bigint');
      case ts.SyntaxKind.SymbolKeyword:
        return t.primitive('symbol');
      case ts.SyntaxKind.ObjectKeyword:
        return t.primitive('object');
      case ts.SyntaxKind.AnyKeyword:
        return t.any();
      case ts.SyntaxKind.UnknownKeyword:
        return t.unknown();
      case ts.SyntaxKind.NeverKeyword:
        return t.never();
      case ts.SyntaxKind.VoidKeyword:
        return t.primitive('void');
      case ts.SyntaxKind.UndefinedKeyword:
        return t.primitive('undefined');
      case ts.SyntaxKind.NullKeyword:
        return t.primitive('null');
      case ts.SyntaxKind.ThisType:
        return { kind: 'self' };
      default:
        break;
    }

    if (ts.isLiteralTypeNode(node)) return this.lowerLiteral(node, ctx);
    if (ts.isParenthesizedTypeNode(node)) return this.lowerTypeNode(node.type, ctx);
    if (ts.isArrayTypeNode(node)) return t.array(this.lowerTypeNode(node.elementType, ctx));
    if (ts.isTupleTypeNode(node)) return this.lowerTuple(node, ctx);
    if (ts.isUnionTypeNode(node)) return unionOf(node.types.map((m) => this.lowerTypeNode(m, ctx)));
    if (ts.isIntersectionTypeNode(node)) {
      return { kind: 'intersection', members: node.types.map((m) => this.lowerTypeNode(m, ctx)) };
    }
    if (ts.isTypeLiteralNode(node)) {
      const object: ObjectType = { kind: 'object', members: [], indexSignatures: [], callSignatures: [] };
      for (const member of node.members) this.addTypeElement(object, member, ctx);
      return object;
    }
    if (ts.isFunctionTypeNode(node)) return this.lowerSignature(node, ctx);
    if (ts.isConstructorTypeNode(node)) {
      const fn = this.lowerSignature(node, ctx);
      if (fn.params.length) {
        this.diagnostics.info('lossy-conversion', `Constructor type ${node.getText()} keeps only its instance type.`, {
          loc: this.loc(node),
          path: ctx.path,
        });
      }
      return { kind: 'class-of', type: fn.returns };
    }
    if (ts.isTypeOperatorNode(node)) {
      if (node.operator === ts.SyntaxKind.ReadonlyKeyword) {
        const inner = this.lowerTypeNode(node.type, ctx);
        if (inner.kind === 'array' || inner.kind === 'tuple') return { ...inner, readonly: true };
        return inner;
      }
      if (node.operator === ts.SyntaxKind.UniqueKeyword) return t.primitive('symbol');
      // keyof: list the keys in declaration order (the checker's union is ordered by type identity).
      const operand = this.checker.getTypeFromTypeNode(node.type);
      if (!(operand.flags & ts.TypeFlags.TypeParameter) && this.checker.getIndexInfosOfType(operand).length === 0) {
        const keys = this.checker.getPropertiesOfType(operand).filter((p) => !p.name.startsWith('__@'));
        if (keys.length) return unionOf(keys.map((p) => t.literal(p.name)));
      }
      return this.evaluate(node, ctx);
    }
    if (ts.isTemplateLiteralTypeNode(node)) {
      const parts: (string | TypeNode)[] = [node.head.text];
      for (const span of node.templateSpans) parts.push(this.lowerTypeNode(span.type, ctx), span.literal.text);
      return { kind: 'template', parts: parts.filter((p) => p !== '') };
    }
    if (ts.isTypeReferenceNode(node)) return this.lowerTypeReference(node, ctx);
    if (ts.isTypeQueryNode(node)) {
      const symbol = this.resolveSymbol(this.checker.getSymbolAtLocation(node.exprName));
      if (symbol && this.names.has(symbol) && symbol.flags & (ts.SymbolFlags.Class | ts.SymbolFlags.Enum)) {
        return { kind: 'class-of', type: t.reference(this.names.get(symbol)!, [], 'declaration') };
      }
      return this.evaluate(node, ctx);
    }
    if (ts.isTypePredicateNode(node)) return t.primitive('boolean');
    if (ts.isImportTypeNode(node)) {
      const name = node.qualifier ? node.qualifier.getText() : 'default';
      return t.reference(
        name,
        (node.typeArguments ?? []).map((a) => this.lowerTypeNode(a, ctx)),
        'import',
      );
    }
    if (ts.isOptionalTypeNode(node) || ts.isRestTypeNode(node)) return this.lowerTypeNode(node.type, ctx);
    if (ts.isNamedTupleMember(node)) return this.lowerTypeNode(node.type, ctx);
    // Indexed access, mapped and conditional types.
    return this.evaluate(node, ctx);
  }

  private lowerLiteral(node: ts.LiteralTypeNode, ctx: Ctx): TypeNode {
    const lit = node.literal;
    if (lit.kind === ts.SyntaxKind.NullKeyword) return t.primitive('null');
    if (lit.kind === ts.SyntaxKind.TrueKeyword) return t.literal(true);
    if (lit.kind === ts.SyntaxKind.FalseKeyword) return t.literal(false);
    if (ts.isStringLiteral(lit) || ts.isNoSubstitutionTemplateLiteral(lit)) return t.literal(lit.text);
    if (ts.isNumericLiteral(lit)) return numberLiteral(lit.text, false);
    if (ts.isBigIntLiteral(lit)) return t.literal(BigInt(lit.text.slice(0, -1)));
    if (ts.isPrefixUnaryExpression(lit) && lit.operator === ts.SyntaxKind.MinusToken) {
      if (ts.isNumericLiteral(lit.operand)) return numberLiteral(lit.operand.text, true);
      if (ts.isBigIntLiteral(lit.operand)) return t.literal(-BigInt(lit.operand.text.slice(0, -1)));
    }
    return this.evaluate(node, ctx);
  }

  private lowerTuple(node: ts.TupleTypeNode, ctx: Ctx): TypeNode {
    const elements: TupleElement[] = node.elements.map((el) => {
      let name: string | undefined;
      let optional = false;
      let rest = false;
      let inner: ts.TypeNode = el;
      if (ts.isNamedTupleMember(el)) {
        name = el.name.text;
        optional = el.questionToken !== undefined;
        rest = el.dotDotDotToken !== undefined;
        inner = el.type;
      }
      if (ts.isOptionalTypeNode(inner)) {
        optional = true;
        inner = inner.type;
      }
      if (ts.isRestTypeNode(inner)) {
        rest = true;
        inner = inner.type;
      }
      const type = this.lowerTypeNode(inner, ctx);
      const element: TupleElement = { type };
      if (name) element.name = name;
      if (optional) element.optional = true;
      if (rest) {
        if (type.kind === 'array') {
          element.type = type.element;
          element.rest = 'repeat';
        } else element.rest = 'spread';
      }
      return element;
    });
    return { kind: 'tuple', elements, readonly: false };
  }

  private lowerTypeReference(node: ts.TypeReferenceNode, ctx: Ctx): TypeNode {
    const written = node.typeName.getText();
    const args = (): TypeNode[] => (node.typeArguments ?? []).map((a) => this.lowerTypeNode(a, ctx));

    const mapped = this.options.typeMap?.[written];
    if (mapped !== undefined) {
      return typeof mapped === 'string'
        ? { kind: 'raw', text: mapped, imports: [] }
        : { kind: 'raw', text: mapped.type, imports: mapped.imports ?? [] };
    }
    if (ctx.scope.has(written)) return t.reference(written, args(), 'type-param');

    const raw = this.checker.getSymbolAtLocation(node.typeName);
    if (!raw) {
      this.diagnostics.warn(
        'unresolved-reference',
        `'${written}' is not declared or imported; it is emitted as written.`,
        { loc: this.loc(node), path: ctx.path },
      );
      return t.reference(written, args(), 'unresolved');
    }
    if (raw.flags & ts.SymbolFlags.Alias) {
      const target = this.checker.getAliasedSymbol(raw);
      if (!this.names.has(target)) return t.reference(written, args(), 'import');
    }
    const symbol = this.resolveSymbol(raw)!;
    if (symbol.flags & ts.SymbolFlags.TypeParameter) return t.reference(written, args(), 'type-param');
    if (symbol.flags & ts.SymbolFlags.EnumMember) {
      const parent = this.resolveSymbol((symbol as ts.Symbol & { parent?: ts.Symbol }).parent);
      if (parent && this.names.has(parent))
        return { kind: 'enum-member', enumName: this.names.get(parent)!, member: symbol.name };
    }
    if (this.names.has(symbol)) return t.reference(this.names.get(symbol)!, args(), 'declaration');

    const declarations = symbol.declarations ?? [];
    if (declarations.length && declarations.every(isLibDeclaration)) {
      const handler = LIB_TYPES[symbol.name];
      if (handler) return handler(args());
      if (symbol.name === 'Record') {
        const [key, value] = args();
        if (key && value && isIndexKey(key)) return { kind: 'record', key, value, readonly: false };
      }
      if (symbol.name === 'Readonly') {
        const inner = args()[0];
        if (inner && (inner.kind === 'array' || inner.kind === 'tuple')) return { ...inner, readonly: true };
      }
      // Partial, Pick, Omit, Required, Readonly, Exclude, Extract, NonNullable, ReturnType, Awaited, ...
      const evaluated = this.evaluate(node, ctx);
      if (evaluated.kind === 'object') {
        const argNames = [...(node.typeArguments ?? [])].flatMap((a) =>
          ts.isTypeReferenceNode(a) ? [a.typeName.getText().replace(/\W/g, '')] : [],
        );
        evaluated.nameHint = `${symbol.name}${argNames.join('')}`;
      }
      return evaluated;
    }
    if (declarations.some(isInputDeclaration)) {
      // A declaration we do not emit (a variable, a function): evaluate its type.
      return this.evaluate(node, ctx);
    }
    this.diagnostics.warn(
      'unresolved-reference',
      `'${written}' comes from an ambient declaration this converter does not know; it is emitted as written.`,
      {
        loc: this.loc(node),
        path: ctx.path,
      },
    );
    return t.reference(written, args(), 'unresolved');
  }

  private resolveSymbol(symbol: ts.Symbol | undefined): ts.Symbol | undefined {
    if (!symbol) return undefined;
    if (symbol.flags & ts.SymbolFlags.Alias) {
      const target = this.checker.getAliasedSymbol(symbol);
      if (target && target.name !== 'unknown') return target;
    }
    return symbol;
  }

  /** Resolves a type node with the checker and lowers the result. */
  private evaluate(node: ts.TypeNode, ctx: Ctx): TypeNode {
    const type = this.checker.getTypeFromTypeNode(node);
    return this.typeToIR(type, ctx, node);
  }

  // -------------------------------------------------------------------------
  // Checker types
  // -------------------------------------------------------------------------

  /** Lowers a type the checker computed. `origin` is the syntax it came from, for diagnostics and fallback text. */
  typeToIR(type: ts.Type, ctx: Ctx, origin?: ts.Node): TypeNode {
    if (this.depth > 12) return t.any();
    this.depth++;
    try {
      return this.typeToIRInner(type, ctx, origin);
    } finally {
      this.depth--;
    }
  }

  private typeToIRInner(type: ts.Type, ctx: Ctx, origin?: ts.Node): TypeNode {
    const f = type.flags;
    const aliasSymbol = type.aliasSymbol;
    if (aliasSymbol && aliasSymbol !== ctx.self && this.names.has(aliasSymbol)) {
      const args = (type.aliasTypeArguments ?? []).map((a) => this.typeToIR(a, ctx));
      return t.reference(this.names.get(aliasSymbol)!, args, 'declaration');
    }
    if (f & ts.TypeFlags.Any) return t.any();
    if (f & ts.TypeFlags.Unknown) return t.unknown();
    if (f & ts.TypeFlags.Never) return t.never();
    if (f & ts.TypeFlags.Void) return t.primitive('void');
    if (f & ts.TypeFlags.Undefined) return t.primitive('undefined');
    if (f & ts.TypeFlags.Null) return t.primitive('null');
    if (f & ts.TypeFlags.EnumLiteral && type.symbol) {
      const parent = (type.symbol as ts.Symbol & { parent?: ts.Symbol }).parent;
      if (parent && this.names.has(parent) && type.symbol.flags & ts.SymbolFlags.EnumMember) {
        return { kind: 'enum-member', enumName: this.names.get(parent)!, member: type.symbol.name };
      }
      if (this.names.has(type.symbol)) return t.reference(this.names.get(type.symbol)!, [], 'declaration');
    }
    if (f & ts.TypeFlags.StringLiteral) return t.literal((type as ts.StringLiteralType).value);
    if (f & ts.TypeFlags.NumberLiteral) {
      const value = (type as ts.NumberLiteralType).value;
      return t.literal(value, !Number.isInteger(value));
    }
    if (f & ts.TypeFlags.BigIntLiteral) {
      const v = (type as ts.BigIntLiteralType).value;
      return t.literal(BigInt(`${v.negative ? '-' : ''}${v.base10Value}`));
    }
    if (f & ts.TypeFlags.BooleanLiteral)
      return t.literal((type as { intrinsicName?: string }).intrinsicName === 'true');
    if (f & ts.TypeFlags.String) return t.primitive('string');
    if (f & ts.TypeFlags.Number) return t.primitive('number');
    if (f & ts.TypeFlags.Boolean) return t.primitive('boolean');
    if (f & ts.TypeFlags.BigInt) return t.primitive('bigint');
    if (f & (ts.TypeFlags.ESSymbol | ts.TypeFlags.UniqueESSymbol)) return t.primitive('symbol');
    if (f & ts.TypeFlags.NonPrimitive) return t.primitive('object');
    if (f & ts.TypeFlags.TypeParameter) {
      const name = type.symbol?.name;
      if (name && ctx.scope.has(name)) return t.reference(name, [], 'type-param');
      if ((type as { isThisType?: boolean }).isThisType) return { kind: 'self' };
      return this.opaque(type, ctx, origin, 'it depends on a type parameter that is not in scope');
    }
    if (type.isUnion()) return this.foldEnums(unionOf(type.types.map((m) => this.typeToIR(m, ctx))));
    if (type.isIntersection()) return { kind: 'intersection', members: type.types.map((m) => this.typeToIR(m, ctx)) };
    if (f & ts.TypeFlags.TemplateLiteral) {
      const tpl = type as ts.TemplateLiteralType;
      const parts: (string | TypeNode)[] = [tpl.texts[0]!];
      tpl.types.forEach((m, i) => parts.push(this.typeToIR(m, ctx), tpl.texts[i + 1]!));
      return { kind: 'template', parts: parts.filter((p) => p !== '') };
    }
    if (f & ts.TypeFlags.StringMapping) return t.primitive('string');
    if (f & (ts.TypeFlags.Conditional | ts.TypeFlags.Substitution | ts.TypeFlags.Index | ts.TypeFlags.IndexedAccess)) {
      return this.opaque(type, ctx, origin, 'it cannot be resolved without knowing its type parameters');
    }
    if (f & ts.TypeFlags.Object) return this.objectTypeToIR(type as ts.ObjectType, ctx, origin);
    return this.opaque(type, ctx, origin, 'the converter does not model it');
  }

  private objectTypeToIR(type: ts.ObjectType, ctx: Ctx, origin?: ts.Node): TypeNode {
    const checker = this.checker;
    if (checker.isTupleType(type)) {
      const ref = type as ts.TupleTypeReference;
      const target = ref.target;
      const args = checker.getTypeArguments(ref);
      const elements: TupleElement[] = args.map((arg, i) => {
        const flags = target.elementFlags[i]!;
        const element: TupleElement = { type: this.typeToIR(arg, ctx) };
        const label = target.labeledElementDeclarations?.[i];
        if (label && ts.isNamedTupleMember(label)) element.name = label.name.text;
        if (flags & ts.ElementFlags.Optional) {
          element.optional = true;
          element.type = stripUndefined(element.type);
        }
        if (flags & ts.ElementFlags.Rest) element.rest = 'repeat';
        if (flags & ts.ElementFlags.Variadic) element.rest = 'spread';
        return element;
      });
      return { kind: 'tuple', elements, readonly: target.readonly };
    }
    if (checker.isArrayType(type)) {
      const element = checker.getTypeArguments(type as ts.TypeReference)[0];
      return t.array(element ? this.typeToIR(element, ctx) : t.unknown(), type.symbol?.name === 'ReadonlyArray');
    }
    const symbol = type.symbol as ts.Symbol | undefined;
    const isReference = (type.objectFlags & ts.ObjectFlags.Reference) !== 0;
    const typeArgs = (): TypeNode[] =>
      isReference ? checker.getTypeArguments(type as ts.TypeReference).map((a) => this.typeToIR(a, ctx)) : [];
    if (symbol && this.names.has(symbol)) return t.reference(this.names.get(symbol)!, typeArgs(), 'declaration');
    if (symbol?.declarations?.length && symbol.declarations.every(isLibDeclaration) && LIB_TYPES[symbol.name]) {
      return LIB_TYPES[symbol.name]!(typeArgs());
    }

    // An anonymous object: a type literal, or the result of a mapped type.
    const calls = checker.getSignaturesOfType(type, ts.SignatureKind.Call);
    const properties = checker.getPropertiesOfType(type);
    const indexInfos = checker.getIndexInfosOfType(type);
    if (calls.length === 1 && properties.length === 0 && indexInfos.length === 0)
      return this.signatureToIR(calls[0]!, ctx);
    if (properties.length === 0 && indexInfos.length === 1 && calls.length === 0) {
      const info = indexInfos[0]!;
      return {
        kind: 'record',
        key: this.typeToIR(info.keyType, ctx),
        value: this.typeToIR(info.type, ctx),
        readonly: info.isReadonly,
      };
    }
    if (type.objectFlags & ts.ObjectFlags.Mapped && properties.length === 0 && indexInfos.length === 0) {
      return this.opaque(type, ctx, origin, 'the mapped type is generic');
    }
    const object: ObjectType = {
      kind: 'object',
      members: [],
      indexSignatures: [],
      callSignatures: calls.map((s) => this.signatureToIR(s, ctx)),
    };
    for (const prop of properties) {
      if (this.isPrivateName(prop.name) || prop.name.startsWith('__@')) continue;
      const optional = (prop.flags & ts.SymbolFlags.Optional) !== 0;
      let propType = this.typeToIR(checker.getTypeOfSymbol(prop), { ...ctx, path: `${ctx.path}.${prop.name}` });
      if (optional) propType = stripUndefined(propType);
      const decl = prop.valueDeclaration ?? prop.declarations?.[0];
      if (decl && (ts.isMethodSignature(decl) || ts.isMethodDeclaration(decl))) {
        const signatures = checker
          .getSignaturesOfType(checker.getTypeOfSymbol(prop), ts.SignatureKind.Call)
          .map((s) => this.signatureToIR(s, ctx));
        object.members.push({ kind: 'method', name: prop.name, signatures, optional });
        continue;
      }
      const member: PropertyMember = {
        kind: 'property',
        name: prop.name,
        type: propType,
        optional,
        readonly: isReadonlySymbol(prop),
      };
      const doc = this.docOfSymbol(prop);
      if (doc) member.doc = doc;
      object.members.push(member);
    }
    for (const info of indexInfos) {
      object.indexSignatures.push({
        key: this.typeToIR(info.keyType, ctx),
        value: this.typeToIR(info.type, ctx),
        readonly: info.isReadonly,
      });
    }
    return object;
  }

  /** The checker expands an enum type into its members; when all of them are present, it is the enum again. */
  private foldEnums(node: TypeNode): TypeNode {
    if (node.kind !== 'union') return node;
    const byEnum = new Map<string, Set<string>>();
    for (const m of node.members) {
      if (m.kind === 'enum-member') byEnum.set(m.enumName, (byEnum.get(m.enumName) ?? new Set()).add(m.member));
    }
    const complete = [...byEnum].filter(([name, members]) => this.enumMembers.get(name)?.every((m) => members.has(m)));
    if (!complete.length) return node;
    const out: TypeNode[] = [];
    const placed = new Set<string>();
    for (const m of node.members) {
      const full = m.kind === 'enum-member' && complete.some(([name]) => name === m.enumName);
      if (!full) out.push(m);
      else if (!placed.has(m.enumName)) {
        placed.add(m.enumName);
        out.push(t.reference(m.enumName, [], 'declaration'));
      }
    }
    return unionOf(out);
  }

  private signatureToIR(signature: ts.Signature, ctx: Ctx): FunctionType {
    const params: Parameter[] = signature.getParameters().map((p) => {
      const decl = p.valueDeclaration as ts.ParameterDeclaration | undefined;
      const optional = decl ? decl.questionToken !== undefined || decl.initializer !== undefined : false;
      const type = this.typeToIR(this.checker.getTypeOfSymbol(p), ctx);
      if (decl?.dotDotDotToken) {
        return {
          name: p.name,
          type: type.kind === 'array' ? type.element : t.any(),
          optional: false,
          kind: 'var-positional',
        };
      }
      return { name: p.name, type: optional ? stripUndefined(type) : type, optional, kind: 'positional' };
    });
    return { kind: 'function', params, returns: this.typeToIR(signature.getReturnType(), ctx), typeParams: [] };
  }

  private opaque(type: ts.Type, ctx: Ctx, origin: ts.Node | undefined, reason: string): TypeNode {
    const text = origin?.getText() ?? this.checker.typeToString(type);
    this.diagnostics.warn('unsupported-type', `${text} cannot be converted: ${reason}.`, {
      loc: origin ? this.loc(origin) : undefined,
      path: ctx.path,
    });
    return { kind: 'opaque', text, language: 'typescript' };
  }

  // -------------------------------------------------------------------------
  // Names, docs, locations
  // -------------------------------------------------------------------------

  private propertyName(name: ts.PropertyName, ctx: Ctx): string | undefined {
    if (
      ts.isIdentifier(name) ||
      ts.isStringLiteral(name) ||
      ts.isNumericLiteral(name) ||
      ts.isNoSubstitutionTemplateLiteral(name)
    )
      return name.text;
    if (ts.isPrivateIdentifier(name)) return undefined;
    if (ts.isComputedPropertyName(name)) {
      if (ts.isStringLiteralLike(name.expression) || ts.isNumericLiteral(name.expression)) return name.expression.text;
      const type = this.checker.getTypeAtLocation(name.expression);
      if (type.isStringLiteral() || type.isNumberLiteral()) return String(type.value);
      this.diagnostics.warn(
        'unsupported-syntax',
        `Computed property ${name.getText()} has no static name; it was skipped.`,
        { loc: this.loc(name), path: ctx.path },
      );
    }
    return undefined;
  }

  private isPrivateName(name: string): boolean {
    return name.startsWith('_') && !this.options.includePrivate;
  }

  private docOf(node: ts.Node): Doc | undefined {
    const named = node as ts.NamedDeclaration;
    const symbol = named.name ? this.checker.getSymbolAtLocation(named.name) : undefined;
    // A symbol merges docs from every declaration; for one node, read its own JSDoc.
    const jsDocs = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
    if (!jsDocs.length) return symbol && ts.isEnumMember(node) ? this.docOfSymbol(symbol) : undefined;
    const texts: string[] = [];
    const tags: DocTag[] = [];
    let deprecated: string | undefined;
    for (const jsDoc of jsDocs) {
      const text = ts.getTextOfJSDocComment(jsDoc.comment);
      if (text) texts.push(text.trim());
      for (const tag of jsDoc.tags ?? []) {
        const name = tag.tagName.text;
        const tagText = (ts.getTextOfJSDocComment(tag.comment) ?? '').trim();
        if (name === 'deprecated') deprecated = tagText;
        else if (!['param', 'returns', 'return', 'template', 'typeParam'].includes(name))
          tags.push({ name, text: tagText });
      }
    }
    if (!texts.length && !tags.length && deprecated === undefined) return undefined;
    const doc: Doc = { text: texts.join('\n\n'), tags };
    if (deprecated !== undefined) doc.deprecated = deprecated;
    return doc;
  }

  private docOfSymbol(symbol: ts.Symbol): Doc | undefined {
    const text = ts.displayPartsToString(symbol.getDocumentationComment(this.checker)).trim();
    const tags: DocTag[] = [];
    let deprecated: string | undefined;
    for (const tag of symbol.getJsDocTags(this.checker)) {
      const tagText = ts.displayPartsToString(tag.text).trim();
      if (tag.name === 'deprecated') deprecated = tagText;
      else if (!['param', 'returns', 'return', 'template'].includes(tag.name))
        tags.push({ name: tag.name, text: tagText });
    }
    if (!text && !tags.length && deprecated === undefined) return undefined;
    const doc: Doc = { text, tags };
    if (deprecated !== undefined) doc.deprecated = deprecated;
    return doc;
  }

  private loc(node: ts.Node): SourceLocation {
    return this.locAt(node.getStart(this.sourceFile));
  }

  private locAt(offset: number): SourceLocation {
    const { line, character } = ts.getLineAndCharacterOfPosition(this.sourceFile, offset);
    void this.source;
    return { line: line + 1, column: character + 1 };
  }
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined)?.some((m) => m.kind === kind) ?? false;
}

/** Readonly from a declaration's modifier, or from a mapped type such as `Readonly<T>` (an internal check flag). */
function isReadonlySymbol(symbol: ts.Symbol): boolean {
  const decl = symbol.valueDeclaration ?? symbol.declarations?.[0];
  if (decl && (ts.getCombinedModifierFlags(decl) & ts.ModifierFlags.Readonly) !== 0) {
    // A homomorphic mapped type (`-readonly`) can strip it; the check flags below are authoritative when present.
    const links = (symbol as { links?: { checkFlags?: number } }).links;
    if (links?.checkFlags === undefined) return true;
  }
  const checkFlags =
    (symbol as { links?: { checkFlags?: number }; checkFlags?: number }).links?.checkFlags ??
    (symbol as { checkFlags?: number }).checkFlags ??
    0;
  return (checkFlags & 8) !== 0;
}

/** Under `strictNullChecks` an optional member's type includes `undefined`; the `?` already says that. */
function stripUndefined(node: TypeNode): TypeNode {
  if (node.kind !== 'union') return node;
  const members = node.members.filter((m) => !(m.kind === 'primitive' && m.name === 'undefined'));
  return members.length === node.members.length ? node : unionOf(members);
}

function isIndexKey(node: TypeNode): boolean {
  return (node.kind === 'primitive' && ['string', 'number', 'symbol'].includes(node.name)) || node.kind === 'template';
}

function numberLiteral(text: string, negative: boolean): TypeNode {
  const value = Number(text.replace(/_/g, '')) * (negative ? -1 : 1);
  return t.literal(value, !Number.isInteger(value));
}
