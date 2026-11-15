import { ParseError } from '../diagnostics.js';
import type { SourceLocation } from '../ir/types.js';
import type { PyConstant, PyExpr, PyKeyword, PyModule, PyParam, PyParamKind, PyStmt, PyTypeParam } from './ast.js';
import { type PyToken, tokenizePython } from './lexer.js';

const COMPOUND = new Set(['if', 'elif', 'else', 'while', 'for', 'try', 'except', 'finally', 'with']);
const SIMPLE_KEYWORDS = new Set([
  'return',
  'raise',
  'del',
  'global',
  'nonlocal',
  'assert',
  'break',
  'continue',
  'yield',
  'await',
]);
const COMPARISON = new Set(['<', '>', '==', '>=', '<=', '!=']);
const AUGMENTED = new Set(['+=', '-=', '*=', '/=', '//=', '%=', '**=', '>>=', '<<=', '&=', '|=', '^=', '@=']);

/**
 * Parses Python source into the type-relevant AST.
 *
 * Annotations are parsed strictly: a malformed one is a {@link ParseError}. Code that carries no type information
 * (function bodies, arbitrary expressions) is parsed leniently and skipped when it uses syntax this parser does not
 * model, so real-world modules convert without the parser needing all of Python.
 */
export function parsePythonSource(source: string): PyModule {
  const { tokens, comments } = tokenizePython(source);
  const parser = new Parser(tokens, source.replace(/\r\n?/g, '\n'));
  const body = parser.parseModule();
  const byLine = new Map<number, { text: string; ownLine: boolean }>();
  for (const c of comments) byLine.set(c.line, { text: c.text, ownLine: c.ownLine });
  return { body, comments: byLine };
}

/** Parses a single expression, such as the contents of a string forward reference (`"list[Node]"`). */
export function parsePythonExpression(text: string): PyExpr {
  const { tokens } = tokenizePython(text.trim());
  const parser = new Parser(tokens, text.trim());
  return parser.parseStandaloneExpression();
}

class Parser {
  private pos = 0;

  parseStandaloneExpression(): PyExpr {
    const expr = this.parseExpression();
    this.eat('newline');
    if (!this.at('eof')) this.fail(`unexpected '${this.peek().value}'`);
    return expr;
  }

  private readonly tokens: PyToken[];
  private readonly source: string;

  constructor(tokens: PyToken[], source: string) {
    this.tokens = tokens;
    this.source = source;
  }

  // -------------------------------------------------------------------------
  // Token helpers
  // -------------------------------------------------------------------------

  private peek(offset = 0): PyToken {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)]!;
  }

  private next(): PyToken {
    const token = this.peek();
    if (this.pos < this.tokens.length - 1) this.pos++;
    return token;
  }

  private at(type: PyToken['type'], value?: string, offset = 0): boolean {
    const token = this.peek(offset);
    return token.type === type && (value === undefined || token.value === value);
  }

  private atOp(value: string, offset = 0): boolean {
    return this.at('op', value, offset);
  }

  private atName(value?: string, offset = 0): boolean {
    return this.at('name', value, offset);
  }

  private eat(type: PyToken['type'], value?: string): PyToken | undefined {
    return this.at(type, value) ? this.next() : undefined;
  }

  private expect(type: PyToken['type'], value?: string): PyToken {
    if (this.at(type, value)) return this.next();
    const token = this.peek();
    const found = token.type === 'newline' ? 'end of line' : token.type === 'eof' ? 'end of file' : `'${token.value}'`;
    return this.fail(`expected ${value ? `'${value}'` : type}, found ${found}`, token);
  }

  private fail(message: string, token: PyToken = this.peek()): never {
    throw new ParseError({ language: 'python', message, loc: token.loc, source: this.source });
  }

  private get prevEnd(): number {
    return this.tokens[this.pos - 1]?.end ?? 0;
  }

  private node<T extends object>(start: PyToken, fields: T): T & { loc: SourceLocation; start: number; end: number } {
    return { ...fields, loc: start.loc, start: start.start, end: this.prevEnd };
  }

  /** Runs `fn`; on a parse error rewinds and returns undefined. */
  private attempt<T>(fn: () => T): T | undefined {
    const saved = this.pos;
    try {
      return fn();
    } catch (error) {
      if (!(error instanceof ParseError)) throw error;
      this.pos = saved;
      return undefined;
    }
  }

  /** Skips to the end of the current simple statement (`;` or newline outside brackets). */
  private skipSimpleStatement(): void {
    let depth = 0;
    while (!this.at('eof')) {
      const token = this.peek();
      if (token.type === 'newline' || (depth === 0 && token.type === 'op' && token.value === ';')) return;
      if (token.type === 'op' && '([{'.includes(token.value)) depth++;
      if (token.type === 'op' && ')]}'.includes(token.value)) depth--;
      this.next();
    }
  }

  private endOfSimpleStatement(): boolean {
    return this.at('newline') || this.atOp(';') || this.at('eof');
  }

  // -------------------------------------------------------------------------
  // Statements
  // -------------------------------------------------------------------------

  parseModule(): PyStmt[] {
    const body: PyStmt[] = [];
    while (!this.at('eof')) {
      if (this.eat('newline') || this.eat('indent') || this.eat('dedent')) continue;
      body.push(...this.parseStatement());
    }
    return body;
  }

  private parseStatement(): PyStmt[] {
    const start = this.peek();
    if (this.atOp('@')) return [this.parseDecorated()];
    if (this.atName('class')) return [this.parseClass([], start)];
    if (this.atName('def')) return [this.parseDef([], start, false)];
    if (this.atName('async') && this.atName('def', 1)) {
      this.next();
      return [this.parseDef([], start, true)];
    }
    if (this.atName('async') && (this.atName('with', 1) || this.atName('for', 1))) this.next();
    if (start.type === 'name' && COMPOUND.has(start.value)) return [this.parseBlockStatement()];
    if ((this.atName('match') || this.atName('case')) && this.lineIsBlockHeader()) return [this.parseBlockStatement()];
    return this.parseSimpleStatements();
  }

  /** True when the logical line ends with `:` and an indented block or a statement follows (soft keywords). */
  private lineIsBlockHeader(): boolean {
    let depth = 0;
    for (let i = this.pos; i < this.tokens.length; i++) {
      const token = this.tokens[i]!;
      if (token.type === 'newline' || token.type === 'eof') return false;
      if (token.type === 'op' && '([{'.includes(token.value)) depth++;
      if (token.type === 'op' && ')]}'.includes(token.value)) depth--;
      if (depth === 0 && token.type === 'op' && token.value === ':' && i > this.pos + 1) {
        return this.tokens[i + 1]?.type === 'newline';
      }
    }
    return false;
  }

  private parseDecorated(): PyStmt {
    const start = this.peek();
    const decorators: PyExpr[] = [];
    while (this.eat('op', '@')) {
      decorators.push(this.parseNamedExpression());
      this.expect('newline');
    }
    if (this.atName('class')) return this.parseClass(decorators, start);
    if (this.atName('async')) {
      this.next();
      return this.parseDef(decorators, start, true);
    }
    if (this.atName('def')) return this.parseDef(decorators, start, false);
    return this.fail('expected class or function definition after decorator');
  }

  private parseClass(decorators: PyExpr[], start: PyToken): PyStmt {
    this.expect('name', 'class');
    const name = this.expect('name').value;
    const typeParams = this.atOp('[') ? this.parseTypeParams() : [];
    const bases: PyExpr[] = [];
    const keywords: PyKeyword[] = [];
    if (this.eat('op', '(')) {
      const args = this.parseCallArguments();
      bases.push(...args.args);
      keywords.push(...args.keywords);
    }
    this.expect('op', ':');
    const body = this.parseSuite();
    return this.node(start, { kind: 'class' as const, name, typeParams, bases, keywords, decorators, body });
  }

  private parseDef(decorators: PyExpr[], start: PyToken, isAsync: boolean): PyStmt {
    this.expect('name', 'def');
    const name = this.expect('name').value;
    const typeParams = this.atOp('[') ? this.parseTypeParams() : [];
    this.expect('op', '(');
    const params = this.parseParameters(')', true);
    this.expect('op', ')');
    let returns: PyExpr | undefined;
    if (this.eat('op', '->')) returns = this.parseExpression();
    this.expect('op', ':');
    const body = this.parseSuite();
    const def = { kind: 'def' as const, name, async: isAsync, typeParams, params, decorators, body };
    return this.node(start, returns ? { ...def, returns } : def);
  }

  /** Parameters up to (not including) `close`. Lambdas pass `annotations: false`. */
  private parseParameters(close: string, annotations: boolean): PyParam[] {
    const params: PyParam[] = [];
    let kind: PyParamKind = 'positional';
    while (!this.atOp(close)) {
      const token = this.peek();
      if (this.eat('op', '/')) {
        for (const p of params) if (p.kind === 'positional') p.kind = 'positional-only';
      } else if (this.eat('op', '**')) {
        params.push(this.parseParam('var-keyword', annotations));
      } else if (this.eat('op', '*')) {
        if (this.atOp(',') || this.atOp(close)) kind = 'keyword-only';
        else {
          params.push(this.parseParam('var-positional', annotations));
          kind = 'keyword-only';
        }
      } else {
        params.push(this.parseParam(kind, annotations));
      }
      if (!this.eat('op', ',')) break;
      void token;
    }
    return params;
  }

  private parseParam(kind: PyParamKind, annotations: boolean): PyParam {
    const token = this.expect('name');
    const param: PyParam = { name: token.value, kind, loc: token.loc };
    if (annotations && this.eat('op', ':')) {
      // `*args: *Ts` (PEP 646) is a starred annotation.
      param.annotation = this.atOp('*') ? this.parseStarred() : this.parseExpression();
    }
    if (this.eat('op', '=')) param.default = this.parseExpression();
    return param;
  }

  private parseTypeParams(): PyTypeParam[] {
    this.expect('op', '[');
    const params: PyTypeParam[] = [];
    while (!this.atOp(']')) {
      const token = this.peek();
      let kind: PyTypeParam['kind'] = 'type';
      if (this.eat('op', '**')) kind = 'param-spec';
      else if (this.eat('op', '*')) kind = 'type-var-tuple';
      const name = this.expect('name').value;
      const param: PyTypeParam = { name, kind, loc: token.loc };
      if (this.eat('op', ':')) param.bound = this.parseExpression();
      if (this.eat('op', '=')) param.default = this.atOp('*') ? this.parseStarred() : this.parseExpression();
      params.push(param);
      if (!this.eat('op', ',')) break;
    }
    this.expect('op', ']');
    return params;
  }

  /** The body after `:`: an indented block or simple statements on the same line. */
  private parseSuite(): PyStmt[] {
    if (!this.eat('newline')) {
      const body = this.parseSimpleStatements();
      return body;
    }
    this.expect('indent');
    const body: PyStmt[] = [];
    while (!this.at('dedent') && !this.at('eof')) {
      if (this.eat('newline')) continue;
      body.push(...this.parseStatement());
    }
    this.eat('dedent');
    return body;
  }

  private parseBlockStatement(): PyStmt {
    const start = this.next();
    const keyword = start.value;
    let test: PyExpr | undefined;
    if (keyword === 'if' || keyword === 'elif' || keyword === 'while') {
      test = this.attempt(() => {
        const expr = this.parseNamedExpression();
        if (!this.atOp(':')) this.fail('expected :');
        return expr;
      });
    }
    // Skip whatever remains of the header up to its `:`.
    let depth = 0;
    while (!this.at('eof')) {
      const token = this.peek();
      if (depth === 0 && token.type === 'op' && token.value === ':') break;
      if (token.type === 'newline') this.fail("expected ':'");
      if (token.type === 'op' && '([{'.includes(token.value)) depth++;
      if (token.type === 'op' && ')]}'.includes(token.value)) depth--;
      this.next();
    }
    this.expect('op', ':');
    const body = this.parseSuite();
    return this.node(
      start,
      test ? { kind: 'block' as const, keyword, test, body } : { kind: 'block' as const, keyword, body },
    );
  }

  private parseSimpleStatements(): PyStmt[] {
    const statements: PyStmt[] = [];
    for (;;) {
      statements.push(this.parseSimpleStatement());
      if (!this.eat('op', ';') || this.at('newline') || this.at('eof')) break;
    }
    this.eat('newline');
    return statements;
  }

  private parseSimpleStatement(): PyStmt {
    const start = this.peek();
    if (this.atName('pass')) {
      this.next();
      return this.node(start, { kind: 'pass' as const });
    }
    if (this.atName('import')) return this.parseImport();
    if (this.atName('from') && !this.atOp('=', 1)) return this.parseImportFrom();
    if (this.atName('type') && this.at('name', undefined, 1) && (this.atOp('=', 2) || this.atOp('[', 2))) {
      return this.parseTypeAlias();
    }
    if (start.type === 'name' && SIMPLE_KEYWORDS.has(start.value) && !this.atOp('=', 1) && !this.atOp(':', 1)) {
      return this.skipAsOther(start);
    }

    const target = this.attempt(() => this.parseStarExpressions());
    if (!target) return this.skipAsOther(start);

    if (this.eat('op', ':')) {
      const annotation = this.parseExpression();
      if (this.eat('op', '=')) {
        const value = this.parseValue();
        return this.node(start, { kind: 'annassign' as const, target, annotation, value });
      }
      return this.node(start, { kind: 'annassign' as const, target, annotation });
    }
    if (this.atOp('=')) {
      const targets = [target];
      let value: PyExpr | undefined;
      while (this.eat('op', '=')) {
        value = this.parseValue();
        if (this.atOp('=')) targets.push(value);
      }
      return this.node(start, { kind: 'assign' as const, targets, value: value! });
    }
    if (this.peek().type === 'op' && AUGMENTED.has(this.peek().value)) return this.skipAsOther(start);
    if (!this.endOfSimpleStatement()) return this.skipAsOther(start);
    return this.node(start, { kind: 'expr' as const, value: target });
  }

  /** A right-hand side: parsed when possible, otherwise kept as source text. */
  private parseValue(): PyExpr {
    const start = this.peek();
    const value = this.attempt(() => {
      const expr = this.parseStarExpressions();
      if (!this.endOfSimpleStatement() && !this.atOp('=')) this.fail('unexpected token');
      return expr;
    });
    if (value) return value;
    this.skipSimpleStatement();
    return this.node(start, { kind: 'other' as const, text: this.source.slice(start.start, this.prevEnd) });
  }

  private skipAsOther(start: PyToken): PyStmt {
    this.skipSimpleStatement();
    return this.node(start, { kind: 'other' as const, text: this.source.slice(start.start, this.prevEnd) });
  }

  private parseImport(): PyStmt {
    const start = this.expect('name', 'import');
    const names: { name: string; asname?: string }[] = [];
    do {
      const name = this.parseDottedName();
      names.push(this.eat('name', 'as') ? { name, asname: this.expect('name').value } : { name });
    } while (this.eat('op', ','));
    return this.node(start, { kind: 'import' as const, names });
  }

  private parseImportFrom(): PyStmt {
    const start = this.expect('name', 'from');
    let level = 0;
    for (;;) {
      if (this.eat('op', '.')) level++;
      else if (this.eat('op', '...')) level += 3;
      else break;
    }
    const module = this.atName('import') ? '' : this.parseDottedName();
    this.expect('name', 'import');
    const names: { name: string; asname?: string }[] = [];
    if (this.eat('op', '*')) names.push({ name: '*' });
    else {
      const paren = this.eat('op', '(');
      do {
        if (paren && this.atOp(')')) break;
        const name = this.expect('name').value;
        names.push(this.eat('name', 'as') ? { name, asname: this.expect('name').value } : { name });
      } while (this.eat('op', ','));
      if (paren) this.expect('op', ')');
    }
    return this.node(start, { kind: 'import-from' as const, module, level, names });
  }

  private parseDottedName(): string {
    let name = this.expect('name').value;
    while (this.eat('op', '.')) name += `.${this.expect('name').value}`;
    return name;
  }

  private parseTypeAlias(): PyStmt {
    const start = this.expect('name', 'type');
    const name = this.expect('name').value;
    const typeParams = this.atOp('[') ? this.parseTypeParams() : [];
    this.expect('op', '=');
    const value = this.parseExpression();
    return this.node(start, { kind: 'type-alias' as const, name, typeParams, value });
  }

  // -------------------------------------------------------------------------
  // Expressions
  // -------------------------------------------------------------------------

  /** `a, b` (a tuple without parentheses), `*a, b`, or a single expression. */
  private parseStarExpressions(): PyExpr {
    const start = this.peek();
    const first = this.atOp('*') ? this.parseStarred() : this.parseNamedExpression();
    if (!this.atOp(',')) return first;
    const elements = [first];
    while (this.eat('op', ',')) {
      if (this.endOfSimpleStatement() || this.atOp('=') || this.atOp(')') || this.atOp(':')) break;
      elements.push(this.atOp('*') ? this.parseStarred() : this.parseNamedExpression());
    }
    return this.node(start, { kind: 'tuple' as const, elements, parenthesized: false });
  }

  private parseStarred(): PyExpr {
    const start = this.peek();
    const double = this.eat('op', '**') !== undefined;
    if (!double) this.expect('op', '*');
    const value = this.parseExpression();
    return this.node(start, { kind: 'starred' as const, value, double });
  }

  private parseNamedExpression(): PyExpr {
    const start = this.peek();
    const expr = this.parseExpression();
    if (this.eat('op', ':=')) {
      this.parseExpression();
      return this.other(start);
    }
    return expr;
  }

  /** A full expression, including lambda and conditional expressions (which become `other`). */
  parseExpression(): PyExpr {
    const start = this.peek();
    if (this.atName('lambda')) {
      this.next();
      this.parseParameters(':', false);
      this.expect('op', ':');
      this.parseExpression();
      return this.other(start);
    }
    const expr = this.parseOr();
    if (this.atName('if')) {
      this.next();
      this.parseOr();
      this.expect('name', 'else');
      this.parseExpression();
      return this.other(start);
    }
    return expr;
  }

  private other(start: PyToken): PyExpr {
    return this.node(start, { kind: 'other' as const, text: this.source.slice(start.start, this.prevEnd) });
  }

  private parseOr(): PyExpr {
    return this.parseBinary(
      () => this.parseAnd(),
      (t) => t.type === 'name' && t.value === 'or',
    );
  }

  private parseAnd(): PyExpr {
    return this.parseBinary(
      () => this.parseNot(),
      (t) => t.type === 'name' && t.value === 'and',
    );
  }

  private parseNot(): PyExpr {
    const start = this.peek();
    if (this.eat('name', 'not')) {
      const operand = this.parseNot();
      return this.node(start, { kind: 'unary' as const, op: 'not', operand });
    }
    return this.parseComparison();
  }

  private parseComparison(): PyExpr {
    const start = this.peek();
    let left = this.parseBitOr();
    for (;;) {
      const token = this.peek();
      let op: string | undefined;
      if (token.type === 'op' && COMPARISON.has(token.value)) op = this.next().value;
      else if (this.atName('in')) op = this.next().value;
      else if (this.atName('not') && this.atName('in', 1)) {
        this.next();
        this.next();
        op = 'not in';
      } else if (this.atName('is')) {
        this.next();
        op = this.eat('name', 'not') ? 'is not' : 'is';
      }
      if (!op) return left;
      const right = this.parseBitOr();
      left = this.node(start, { kind: 'binop' as const, op, left, right });
    }
  }

  private parseBitOr(): PyExpr {
    return this.parseBinaryOps(() => this.parseBitXor(), ['|']);
  }

  private parseBitXor(): PyExpr {
    return this.parseBinaryOps(() => this.parseBitAnd(), ['^']);
  }

  private parseBitAnd(): PyExpr {
    return this.parseBinaryOps(() => this.parseShift(), ['&']);
  }

  private parseShift(): PyExpr {
    return this.parseBinaryOps(() => this.parseArith(), ['<<', '>>']);
  }

  private parseArith(): PyExpr {
    return this.parseBinaryOps(() => this.parseTerm(), ['+', '-']);
  }

  private parseTerm(): PyExpr {
    return this.parseBinaryOps(() => this.parseFactor(), ['*', '/', '//', '%', '@']);
  }

  private parseBinaryOps(operand: () => PyExpr, ops: string[]): PyExpr {
    return this.parseBinary(operand, (t) => t.type === 'op' && ops.includes(t.value));
  }

  private parseBinary(operand: () => PyExpr, isOp: (token: PyToken) => boolean): PyExpr {
    const start = this.peek();
    let left = operand();
    while (isOp(this.peek())) {
      const op = this.next().value;
      const right = operand();
      left = this.node(start, { kind: 'binop' as const, op, left, right });
    }
    return left;
  }

  private parseFactor(): PyExpr {
    const start = this.peek();
    if (this.atOp('-') || this.atOp('+') || this.atOp('~')) {
      const op = this.next().value;
      const operand = this.parseFactor();
      return this.node(start, { kind: 'unary' as const, op, operand });
    }
    return this.parsePower();
  }

  private parsePower(): PyExpr {
    const start = this.peek();
    if (this.atName('await')) {
      this.next();
      this.parsePrimary();
      return this.other(start);
    }
    const base = this.parsePrimary();
    if (this.eat('op', '**')) {
      const exponent = this.parseFactor();
      return this.node(start, { kind: 'binop' as const, op: '**', left: base, right: exponent });
    }
    return base;
  }

  private parsePrimary(): PyExpr {
    const start = this.peek();
    let expr = this.parseAtom();
    for (;;) {
      if (this.eat('op', '.')) {
        const attr = this.expect('name').value;
        expr = this.node(start, { kind: 'attribute' as const, value: expr, attr });
      } else if (this.eat('op', '(')) {
        const { args, keywords } = this.parseCallArguments();
        expr = this.node(start, { kind: 'call' as const, func: expr, args, keywords });
      } else if (this.eat('op', '[')) {
        const index = this.parseSubscript();
        this.expect('op', ']');
        expr = this.node(start, { kind: 'subscript' as const, value: expr, index });
      } else {
        return expr;
      }
    }
  }

  /** Arguments after `(` through the closing `)`. */
  private parseCallArguments(): { args: PyExpr[]; keywords: PyKeyword[] } {
    const args: PyExpr[] = [];
    const keywords: PyKeyword[] = [];
    const open = this.tokens[this.pos - 1]!;
    while (!this.atOp(')')) {
      if (this.at('name') && this.atOp('=', 1)) {
        const name = this.next().value;
        this.next();
        keywords.push({ name, value: this.parseExpression() });
      } else if (this.eat('op', '**')) {
        keywords.push({ name: null, value: this.parseExpression() });
      } else if (this.atOp('*')) {
        args.push(this.parseStarred());
      } else {
        const arg = this.parseNamedExpression();
        if (this.atName('for') || this.atName('async')) {
          this.skipToClose(')');
          args.push(this.other(open));
          return { args, keywords };
        }
        args.push(arg);
      }
      if (!this.eat('op', ',')) break;
    }
    this.expect('op', ')');
    return { args, keywords };
  }

  /** Skips a comprehension tail up to and including the closing bracket. */
  private skipToClose(close: string): void {
    let depth = 0;
    while (!this.at('eof')) {
      const token = this.peek();
      if (token.type === 'op' && '([{'.includes(token.value)) depth++;
      if (token.type === 'op' && ')]}'.includes(token.value)) {
        if (depth === 0) {
          this.expect('op', close);
          return;
        }
        depth--;
      }
      this.next();
    }
    this.expect('op', close);
  }

  /** The inside of `x[...]`: one element, or a tuple of them. Slices become `other`. */
  private parseSubscript(): PyExpr {
    const start = this.peek();
    const elements: PyExpr[] = [];
    let trailingComma = false;
    while (!this.atOp(']')) {
      elements.push(this.parseSliceItem());
      trailingComma = false;
      if (!this.eat('op', ',')) break;
      trailingComma = true;
    }
    if (elements.length === 1 && !trailingComma) return elements[0]!;
    return this.node(start, { kind: 'tuple' as const, elements, parenthesized: false });
  }

  private parseSliceItem(): PyExpr {
    const start = this.peek();
    if (this.atOp('*')) return this.parseStarred();
    if (this.atOp(':')) {
      while (!this.atOp(',') && !this.atOp(']')) this.next();
      return this.other(start);
    }
    const expr = this.parseNamedExpression();
    if (this.atOp(':')) {
      while (!this.atOp(',') && !this.atOp(']')) {
        this.next();
        if (!this.atOp(',') && !this.atOp(']') && !this.atOp(':')) this.parseExpression();
      }
      return this.other(start);
    }
    return expr;
  }

  private parseAtom(): PyExpr {
    const token = this.peek();
    switch (token.type) {
      case 'name': {
        this.next();
        if (token.value === 'None') return this.constant(token, { type: 'none' });
        if (token.value === 'True') return this.constant(token, { type: 'bool', value: true });
        if (token.value === 'False') return this.constant(token, { type: 'bool', value: false });
        return this.node(token, { kind: 'name' as const, id: token.value });
      }
      case 'number':
        this.next();
        return this.constant(token, parseNumber(token.value));
      case 'string':
        return this.parseStrings();
      case 'op':
        if (token.value === '...') {
          this.next();
          return this.constant(token, { type: 'ellipsis' });
        }
        if (token.value === '(') return this.parseParenthesized();
        if (token.value === '[') return this.parseList();
        if (token.value === '{') return this.parseBraces();
        break;
      default:
        break;
    }
    return this.fail(`unexpected ${token.type === 'newline' ? 'end of line' : `'${token.value}'`}`);
  }

  private constant(start: PyToken, value: PyConstant): PyExpr {
    return this.node(start, { kind: 'constant' as const, value });
  }

  /** Adjacent string literals concatenate. */
  private parseStrings(): PyExpr {
    const start = this.peek();
    let value = '';
    let prefix = '';
    let bytes = false;
    while (this.at('string')) {
      const token = this.next();
      value += token.string!.value;
      if (token.string!.prefix.includes('b')) bytes = true;
      if (/[ft]/.test(token.string!.prefix)) prefix = token.string!.prefix;
    }
    return this.constant(start, bytes ? { type: 'bytes', value } : { type: 'str', value, prefix });
  }

  private parseParenthesized(): PyExpr {
    const start = this.expect('op', '(');
    if (this.eat('op', ')')) return this.node(start, { kind: 'tuple' as const, elements: [], parenthesized: true });
    const first = this.atOp('*') ? this.parseStarred() : this.parseNamedExpression();
    if (this.atName('for') || this.atName('async')) {
      this.skipToClose(')');
      return this.other(start);
    }
    if (this.eat('op', ')')) return first;
    const elements = [first];
    while (this.eat('op', ',')) {
      if (this.atOp(')')) break;
      elements.push(this.atOp('*') ? this.parseStarred() : this.parseNamedExpression());
    }
    this.expect('op', ')');
    return this.node(start, { kind: 'tuple' as const, elements, parenthesized: true });
  }

  private parseList(): PyExpr {
    const start = this.expect('op', '[');
    const elements: PyExpr[] = [];
    while (!this.atOp(']')) {
      elements.push(this.atOp('*') ? this.parseStarred() : this.parseNamedExpression());
      if (elements.length === 1 && (this.atName('for') || this.atName('async'))) {
        this.skipToClose(']');
        return this.other(start);
      }
      if (!this.eat('op', ',')) break;
    }
    this.expect('op', ']');
    return this.node(start, { kind: 'list' as const, elements });
  }

  private parseBraces(): PyExpr {
    const start = this.expect('op', '{');
    if (this.eat('op', '}')) return this.node(start, { kind: 'dict' as const, entries: [] });
    const entries: { key: PyExpr | null; value: PyExpr }[] = [];
    const elements: PyExpr[] = [];
    let isDict: boolean | undefined;
    while (!this.atOp('}')) {
      if (this.eat('op', '**')) {
        isDict = true;
        entries.push({ key: null, value: this.parseBitOr() });
      } else if (this.atOp('*')) {
        isDict = false;
        elements.push(this.parseStarred());
      } else {
        const key = this.parseNamedExpression();
        if (isDict !== false && this.eat('op', ':')) {
          isDict = true;
          entries.push({ key, value: this.parseExpression() });
        } else {
          isDict = false;
          elements.push(key);
        }
      }
      if (this.atName('for') || this.atName('async')) {
        this.skipToClose('}');
        return this.other(start);
      }
      if (!this.eat('op', ',')) break;
    }
    this.expect('op', '}');
    return isDict
      ? this.node(start, { kind: 'dict' as const, entries })
      : this.node(start, { kind: 'set' as const, elements });
  }
}

function parseNumber(text: string): PyConstant {
  const clean = text.replace(/_/g, '');
  if (/[jJ]$/.test(clean)) return { type: 'complex', text };
  if (/^0[xXoObB]/.test(clean)) return { type: 'int', value: BigInt(clean) };
  if (/[.eE]/.test(clean)) return { type: 'float', value: Number(clean) };
  return { type: 'int', value: BigInt(clean) };
}
