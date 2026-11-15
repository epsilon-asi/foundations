import { describe, expect, it } from 'vitest';
import { ParseError } from '../src/index.js';
import { tokenizePython } from '../src/python/lexer.js';
import { parsePythonExpression, parsePythonSource } from '../src/python/parser.js';

const kinds = (source: string): string[] => parsePythonSource(source).body.map((s) => s.kind);

describe('tokenizer', () => {
  it('emits indentation tokens and joins lines inside brackets', () => {
    const { tokens } = tokenizePython('class A:\n    x: dict[\n        str, int\n    ]\n');
    expect(tokens.map((t) => t.type).filter((t) => t !== 'name' && t !== 'op')).toEqual([
      'newline',
      'indent',
      'newline',
      'dedent',
      'eof',
    ]);
  });

  it('decodes strings with every prefix', () => {
    const values = tokenizePython(`a = "x\\ty"\nb = r"x\\ty"\nc = b'\\x41'\nd = """multi\nline"""\ne = f"{x["k"]}"`)
      .tokens.filter((t) => t.type === 'string')
      .map((t) => t.string!.value);
    expect(values).toEqual(['x\ty', 'x\\ty', 'A', 'multi\nline', '{x["k"]}']);
  });

  it('reads every numeric form', () => {
    const numbers = tokenizePython('x = 1_000 + 0xFF + 0o7 + 0b1 + 1.5e-3 + .5 + 2j').tokens.filter(
      (t) => t.type === 'number',
    );
    expect(numbers.map((t) => t.value)).toEqual(['1_000', '0xFF', '0o7', '0b1', '1.5e-3', '.5', '2j']);
  });

  it('records comments with their lines', () => {
    expect(tokenizePython('#: doc\nx = 1  # trailing\n').comments).toEqual([
      { line: 1, text: ': doc', ownLine: true },
      { line: 2, text: ' trailing', ownLine: false },
    ]);
  });

  it('handles backslash continuations and tabs', () => {
    expect(kinds('x = 1 + \\\n    2\nif x:\n\ty = 1\n')).toEqual(['assign', 'block']);
  });

  it('reports unterminated strings and bad dedents', () => {
    expect(() => tokenizePython('x = "abc\n')).toThrow(ParseError);
    expect(() => tokenizePython('if x:\n        a = 1\n    b = 2\n')).toThrow(/unindent/);
    expect(() => tokenizePython('x = $')).toThrow(/unexpected character/);
  });
});

describe('statements', () => {
  it('parses the statements that carry types and skips the rest', () => {
    const source = `
import typing as t, collections.abc
from . import sibling
from ..pkg.mod import (A as B, C,)
@decorator(arg=1)
class X(Base, metaclass=Meta):
    pass
async def f(a, /, b: int = 1, *args: str, c, **kw: int) -> None:
    return await g()
type Alias[T: int = str, *Ts, **P] = list[T]
x: int = 1
y = z = 2
w += 1
print(x)
for i in range(3):
    pass
while True:
    break
try:
    import foo
except ImportError:
    foo = None
finally:
    pass
with open("f") as fh:
    pass
match x:
    case 1:
        pass
del x
raise ValueError
`;
    expect(kinds(source)).toEqual([
      'import',
      'import-from',
      'import-from',
      'class',
      'def',
      'type-alias',
      'annassign',
      'assign',
      'other',
      'expr',
      'block',
      'block',
      'block',
      'block',
      'block',
      'block',
      'block',
      'other',
      'other',
    ]);
  });

  it('keeps parameter kinds', () => {
    const [def] = parsePythonSource('def f(a, /, b, *, c, **d): ...').body;
    expect(def!.kind === 'def' && def!.params.map((p) => `${p.name}:${p.kind}`)).toEqual([
      'a:positional-only',
      'b:positional',
      'c:keyword-only',
      'd:var-keyword',
    ]);
  });

  it('parses PEP 695 type parameters', () => {
    const [stmt] = parsePythonSource('class C[T: (int, str), *Ts, **P = [int]]: pass').body;
    expect(stmt!.kind === 'class' && stmt!.typeParams.map((p) => p.kind)).toEqual([
      'type',
      'type-var-tuple',
      'param-spec',
    ]);
  });

  it('treats soft keywords as names', () => {
    expect(kinds('type = 1\nmatch = 2\ncase(3)\ntype(x)')).toEqual(['assign', 'assign', 'expr', 'expr']);
  });

  it('tolerates expressions it does not model in values', () => {
    expect(
      kinds(
        'x = [i for i in y if i]\ny = lambda a: a\nz = a if b else c\nq = {**a, "b": 1}\nr = (yield)\ns = a[1:2]\n',
      ),
    ).toEqual(['assign', 'assign', 'assign', 'assign', 'assign', 'assign']);
  });

  it('reports malformed annotations', () => {
    expect(() => parsePythonSource('x: list[int')).toThrow(ParseError);
    expect(() => parsePythonSource('class A(:\n    pass')).toThrow(ParseError);
  });

  it('includes a code frame in parse errors', () => {
    try {
      parsePythonSource('x: = 1');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ParseError);
      expect((error as ParseError).frame).toBe('1 | x: = 1\n       ^');
      expect((error as ParseError).loc).toEqual({ line: 1, column: 4 });
    }
  });
});

describe('expressions', () => {
  it('parses subscripts, unions and attributes', () => {
    const expr = parsePythonExpression('typing.Dict[str, list[int]] | None');
    expect(expr.kind).toBe('binop');
  });

  it('parses calls with keywords and starred arguments', () => {
    const expr = parsePythonExpression('Field(None, *a, alias="x", **kw)');
    expect(expr.kind === 'call' && [expr.args.length, expr.keywords.map((k) => k.name)]).toEqual([2, ['alias', null]]);
  });

  it('concatenates adjacent strings', () => {
    const expr = parsePythonExpression('"a" "b"');
    expect(expr.kind === 'constant' && expr.value).toEqual({ type: 'str', value: 'ab', prefix: '' });
  });

  it('parses displays', () => {
    for (const [text, kind] of [
      ['()', 'tuple'],
      ['(1,)', 'tuple'],
      ['[1, *a]', 'list'],
      ['{1, 2}', 'set'],
      ['{}', 'dict'],
      ['{"a": 1}', 'dict'],
      ['-x ** 2', 'unary'],
      ['not a and b or c', 'binop'],
      ['a is not b', 'binop'],
      ['a not in b', 'binop'],
      ['(x := 1)', 'other'],
    ] as const) {
      expect(parsePythonExpression(text).kind, text).toBe(kind);
    }
  });

  it('rejects trailing tokens', () => {
    expect(() => parsePythonExpression('int str')).toThrow(ParseError);
  });
});
