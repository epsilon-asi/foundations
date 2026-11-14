import type { SourceLocation } from '../ir/types.js';

/** The subset of Python's AST that carries type information. Everything else parses to `other`. */

interface Node {
  loc: SourceLocation;
  /** Source offsets. */
  start: number;
  end: number;
}

export type PyExpr =
  | (Node & { kind: 'name'; id: string })
  | (Node & { kind: 'attribute'; value: PyExpr; attr: string })
  | (Node & { kind: 'subscript'; value: PyExpr; index: PyExpr })
  | (Node & { kind: 'constant'; value: PyConstant })
  | (Node & { kind: 'binop'; op: string; left: PyExpr; right: PyExpr })
  | (Node & { kind: 'unary'; op: string; operand: PyExpr })
  | (Node & { kind: 'call'; func: PyExpr; args: PyExpr[]; keywords: PyKeyword[] })
  | (Node & { kind: 'tuple'; elements: PyExpr[]; parenthesized: boolean })
  | (Node & { kind: 'list'; elements: PyExpr[] })
  | (Node & { kind: 'set'; elements: PyExpr[] })
  | (Node & { kind: 'dict'; entries: { key: PyExpr | null; value: PyExpr }[] })
  | (Node & { kind: 'starred'; value: PyExpr; double: boolean })
  /** Anything else (lambda, comprehension, ternary, slice, ...), kept as source text. */
  | (Node & { kind: 'other'; text: string });

export type PyConstant =
  | { type: 'str'; value: string; prefix: string }
  | { type: 'bytes'; value: string }
  | { type: 'int'; value: bigint }
  | { type: 'float'; value: number }
  | { type: 'complex'; text: string }
  | { type: 'bool'; value: boolean }
  | { type: 'none' }
  | { type: 'ellipsis' };

export interface PyKeyword {
  /** `null` for `**mapping`. */
  name: string | null;
  value: PyExpr;
}

export type PyParamKind = 'positional-only' | 'positional' | 'keyword-only' | 'var-positional' | 'var-keyword';

export interface PyParam {
  name: string;
  annotation?: PyExpr;
  default?: PyExpr;
  kind: PyParamKind;
  loc: SourceLocation;
}

/** A PEP 695 type parameter: `T`, `T: int`, `*Ts`, `**P`, `T = str`. */
export interface PyTypeParam {
  name: string;
  kind: 'type' | 'type-var-tuple' | 'param-spec';
  bound?: PyExpr;
  default?: PyExpr;
  loc: SourceLocation;
}

export type PyStmt =
  | (Node & {
      kind: 'class';
      name: string;
      typeParams: PyTypeParam[];
      bases: PyExpr[];
      keywords: PyKeyword[];
      decorators: PyExpr[];
      body: PyStmt[];
    })
  | (Node & {
      kind: 'def';
      name: string;
      async: boolean;
      typeParams: PyTypeParam[];
      params: PyParam[];
      returns?: PyExpr;
      decorators: PyExpr[];
      body: PyStmt[];
    })
  | (Node & { kind: 'assign'; targets: PyExpr[]; value: PyExpr })
  | (Node & { kind: 'annassign'; target: PyExpr; annotation: PyExpr; value?: PyExpr })
  | (Node & { kind: 'type-alias'; name: string; typeParams: PyTypeParam[]; value: PyExpr })
  | (Node & { kind: 'import'; names: { name: string; asname?: string }[] })
  | (Node & { kind: 'import-from'; module: string; level: number; names: { name: string; asname?: string }[] })
  | (Node & { kind: 'expr'; value: PyExpr })
  /** `if`/`elif`/`else`, `try`/`except`/`finally`, `with`, `for`, `while`, `match`: the header and nested statements. */
  | (Node & { kind: 'block'; keyword: string; test?: PyExpr; body: PyStmt[] })
  | (Node & { kind: 'pass' })
  | (Node & { kind: 'other'; text: string });

export interface PyModule {
  body: PyStmt[];
  /** Comments by line, for `#:` attribute docs. */
  comments: Map<number, { text: string; ownLine: boolean }>;
}
