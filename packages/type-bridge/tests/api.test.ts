import { describe, expect, it } from 'vitest';
import {
  ConversionError,
  DEFAULT_HEADER,
  ParseError,
  createConverter,
  emitPython,
  emitTypeScript,
  formatDiagnostic,
  parsePython,
  parseTypeScript,
  pythonToTypeScript,
  typeScriptToPython,
} from '../src/index.js';

describe('public API', () => {
  it('needs no options for the common case', () => {
    const { code, diagnostics, module } = pythonToTypeScript('class A:\n    x: int');
    expect(code).toBe(`// ${DEFAULT_HEADER}\n\nexport interface A {\n  x: number;\n}\n`);
    expect(diagnostics).toEqual([]);
    expect(module.language).toBe('python');
  });

  it('exposes the parse and emit stages separately', () => {
    const module = parseTypeScript('export interface A { x: number }');
    expect(emitPython(module, { header: false }).code).toBe(
      'from typing import TypedDict\n\n\nclass A(TypedDict):\n    x: float\n',
    );
    expect(
      emitTypeScript(parsePython('class A:\n    x: int'), { header: false, semicolons: false, indent: 4 }).code,
    ).toBe('export interface A {\n    x: number;\n}\n');
  });

  it('writes custom headers', () => {
    expect(typeScriptToPython('export type A = string;', { header: 'Line 1\nLine 2' }).code).toMatch(
      /^# Line 1\n# Line 2\n/,
    );
    expect(pythonToTypeScript('A = int', { header: 'Mine' }).code).toMatch(/^\/\/ Mine\n/);
  });

  it('binds options with createConverter and merges per-call options', () => {
    const convert = createConverter({
      python: { objectStyle: 'dataclass', typeMap: { A: 'int' } },
      typescript: { enumStyle: 'enum', header: false },
    });
    const py = convert.typeScriptToPython('export interface X { a: A; b: B }', {
      typeMap: { B: 'str' },
      header: false,
    });
    expect(py.code).toContain('@dataclass');
    expect(py.code).toContain('a: int\n    b: str');
    expect(convert.pythonToTypeScript('from enum import Enum\nclass E(Enum):\n    A = 1').code).toContain(
      'export enum E {',
    );
    expect(createConverter().pythonToTypeScript('A = int').code).toContain('export type A = number;');
  });

  it('throws ParseError on invalid source in either language', () => {
    expect(() => pythonToTypeScript('class A(\n')).toThrow(ParseError);
    expect(() => typeScriptToPython('interface A { x: }')).toThrow(ParseError);
    try {
      typeScriptToPython('export interface A {\n  x: number;\n  y: ;\n}');
    } catch (error) {
      expect((error as ParseError).language).toBe('typescript');
      expect((error as ParseError).loc.line).toBe(3);
    }
  });

  it('throws ConversionError in strict mode when anything was lost', () => {
    expect(() => pythonToTypeScript('class A:\n    x: Mystery', { strict: true })).toThrow(ConversionError);
    expect(() => typeScriptToPython('export type A = symbol;', { strict: true })).toThrow(/unsupported-type/);
    // info diagnostics are not failures
    expect(() => typeScriptToPython('export interface A { b: { c: string } }', { strict: true })).not.toThrow();
  });

  it('formats diagnostics', () => {
    const [diagnostic] = pythonToTypeScript('class A:\n    x: Mystery').diagnostics;
    expect(formatDiagnostic(diagnostic!)).toBe(
      "warning[unresolved-reference] A.x (2:8): 'Mystery' is not defined or imported in this module; it is emitted as written.",
    );
    expect(formatDiagnostic({ severity: 'info', code: 'restructured', message: 'm' })).toBe('info[restructured]: m');
  });

  it('includes private members on request', () => {
    const source = 'class A:\n    _x: int\n    def _m(self) -> None: ...';
    expect(pythonToTypeScript(source).code).not.toContain('_x');
    expect(pythonToTypeScript(source, { includePrivate: true }).code).toContain('_x: number;');
    expect(typeScriptToPython('export interface A { _x: number }', { includePrivate: true }).code).toContain(
      '_x: float',
    );
  });
});
