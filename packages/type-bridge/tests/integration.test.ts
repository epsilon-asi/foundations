/**
 * Generated code is checked by the tools that will consume it: TypeScript output by the TypeScript compiler
 * (strict, exactOptionalPropertyTypes), Python output by pyright (strict) and by real interpreters, which both
 * compile it and execute it, so runtime-only rules (forward references, dataclass field order, TypedDict
 * inheritance) are covered too. Interpreters that are not installed are skipped.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PYTHON_VERSIONS,
  formatDiagnostic,
  pythonToTypeScript,
  typeScriptToPython,
  type PythonObjectStyle,
  type PythonVersion,
} from '../src/index.js';
import { compilePython, interpreter, pyright, runPython } from './helpers/python.js';
import { typecheckTypeScript } from './helpers/typescript.js';

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const API = fixture('api.ts');
const MODELS = fixture('models.py');
const PYDANTIC = fixture('pydantic_models.py');

const STYLES: PythonObjectStyle[] = ['typeddict', 'dataclass', 'pydantic', 'protocol'];

describe('TypeScript → Python', () => {
  for (const version of PYTHON_VERSIONS) {
    describe(`Python ${version}`, () => {
      for (const objectStyle of STYLES) {
        const { code, diagnostics } = typeScriptToPython(API, { pythonVersion: version, objectStyle });

        it(`${objectStyle}: reports no errors`, () => {
          expect(diagnostics.filter((d) => d.severity === 'error').map(formatDiagnostic)).toEqual([]);
        });

        const compiler = interpreter(version);
        it.skipIf(!compiler)(`${objectStyle}: compiles with python${version}`, () => {
          const result = compilePython(compiler!.bin, code);
          expect(result.output).toBe('');
          expect(result.ok).toBe(true);
        });

        const needs = objectStyle === 'pydantic' ? ['typing_extensions', 'pydantic'] : ['typing_extensions'];
        const runner = interpreter(version, ...needs);
        it.skipIf(!runner)(`${objectStyle}: executes with python${version}`, () => {
          const result = runPython(runner!.bin, code);
          expect(result.output).toBe('');
          expect(result.ok).toBe(true);
        });
      }
    });
  }

  // pyright is slower; one strict run per version covers every style at once.
  for (const version of ['3.11', '3.12', '3.13', '3.14'] as PythonVersion[]) {
    it(`passes pyright --strict for Python ${version}`, () => {
      const files = Object.fromEntries(
        STYLES.filter((s) => s !== 'pydantic').map((objectStyle) => [
          `${objectStyle}.py`,
          typeScriptToPython(API, { pythonVersion: version, objectStyle }).code,
        ]),
      );
      expect(pyright(files, version)).toEqual([]);
    }, 60_000);
  }
});

describe('Python → TypeScript', () => {
  for (const [name, source] of [
    ['models.py', MODELS],
    ['pydantic_models.py', PYDANTIC],
  ] as const) {
    for (const mode of ['json', 'runtime'] as const) {
      for (const enumStyle of ['union', 'enum', 'object'] as const) {
        it(`${name} (${mode}, enums as ${enumStyle}) type-checks`, () => {
          const { code } = pythonToTypeScript(source, { mode, enumStyle });
          expect(typecheckTypeScript(code)).toEqual([]);
        });
      }
    }
  }

  it('produces bigint output that type-checks', () => {
    expect(typecheckTypeScript(pythonToTypeScript(MODELS, { int: 'bigint' }).code)).toEqual([]);
  });
});

describe('round trips', () => {
  it('TypeScript → Python → TypeScript type-checks', () => {
    const python = typeScriptToPython(API).code;
    const back = pythonToTypeScript(python, { mode: 'runtime' });
    expect(typecheckTypeScript(back.code)).toEqual([]);
  });

  const runner = interpreter('3.11', 'typing_extensions');
  it.skipIf(!runner)('Python → TypeScript → Python executes', () => {
    const ts = pythonToTypeScript(MODELS, { mode: 'runtime', enumStyle: 'enum' }).code;
    const python = typeScriptToPython(ts, { pythonVersion: '3.11' }).code;
    const result = runPython(runner!.bin, python);
    expect(result.output).toBe('');
  });

  it('TypeScript → Python → TypeScript keeps the declared names', () => {
    const python = typeScriptToPython(API).code;
    const back = pythonToTypeScript(python).module.declarations.map((d) => d.name);
    for (const name of ['OrderStatus', 'User', 'Admin', 'Order', 'Page', 'Repository', 'Invoice', 'EventsCreated']) {
      expect(back).toContain(name);
    }
  });
});
