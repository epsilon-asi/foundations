import { ConversionError } from './diagnostics.js';
import type { Diagnostic, TypeModule } from './ir/types.js';
import type { PythonToTypeScriptOptions, TypeScriptToPythonOptions } from './options.js';
import { emitPython } from './python/emitter.js';
import { parsePython } from './python/lower.js';
import { emitTypeScript } from './typescript/emitter.js';
import { parseTypeScript } from './typescript/lower.js';

export interface ConversionResult {
  /** The generated source. */
  code: string;
  /** Everything worth knowing about the conversion, from parsing and emitting, in source order. */
  diagnostics: Diagnostic[];
  /** The intermediate model, for inspection or a custom emitter. */
  module: TypeModule;
}

/**
 * Converts Python type declarations to TypeScript.
 *
 * ```ts
 * const { code } = pythonToTypeScript(source);
 * const { code } = pythonToTypeScript(source, { mode: 'runtime', enumStyle: 'enum' });
 * ```
 */
export function pythonToTypeScript(source: string, options: PythonToTypeScriptOptions = {}): ConversionResult {
  const { typeMap, includePrivate, strict = false, ...emitOptions } = options;
  const module = parsePython(source, {
    ...(typeMap ? { typeMap } : {}),
    ...(includePrivate !== undefined ? { includePrivate } : {}),
  });
  const emitted = emitTypeScript(module, emitOptions);
  return finish(module, emitted.code, emitted.diagnostics, strict);
}

/**
 * Converts TypeScript type declarations to Python.
 *
 * ```ts
 * const { code } = typeScriptToPython(source);
 * const { code } = typeScriptToPython(source, { objectStyle: 'pydantic', pythonVersion: '3.10' });
 * ```
 */
export function typeScriptToPython(source: string, options: TypeScriptToPythonOptions = {}): ConversionResult {
  const { typeMap, includePrivate, strict = false, ...emitOptions } = options;
  const module = parseTypeScript(source, {
    ...(typeMap ? { typeMap } : {}),
    ...(includePrivate !== undefined ? { includePrivate } : {}),
  });
  const emitted = emitPython(module, emitOptions);
  return finish(module, emitted.code, emitted.diagnostics, strict);
}

export interface ConverterOptions {
  /** Defaults for every Python → TypeScript conversion. */
  typescript?: PythonToTypeScriptOptions;
  /** Defaults for every TypeScript → Python conversion. */
  python?: TypeScriptToPythonOptions;
}

export interface Converter {
  pythonToTypeScript(source: string, options?: PythonToTypeScriptOptions): ConversionResult;
  typeScriptToPython(source: string, options?: TypeScriptToPythonOptions): ConversionResult;
}

/**
 * Binds options shared by many conversions. Per-call options are merged over the bound ones.
 *
 * ```ts
 * const convert = createConverter({ python: { objectStyle: 'pydantic', pythonVersion: '3.11' } });
 * convert.typeScriptToPython(source);
 * ```
 */
export function createConverter(options: ConverterOptions = {}): Converter {
  return {
    pythonToTypeScript: (source, overrides = {}) => pythonToTypeScript(source, merge(options.typescript, overrides)),
    typeScriptToPython: (source, overrides = {}) => typeScriptToPython(source, merge(options.python, overrides)),
  };
}

function merge<T extends { typeMap?: Record<string, unknown> }>(base: T | undefined, overrides: T): T {
  const merged = { ...base, ...overrides };
  if (base?.typeMap && overrides.typeMap) merged.typeMap = { ...base.typeMap, ...overrides.typeMap };
  return merged;
}

const ORDER = { error: 0, warning: 1, info: 2 } as const;

function finish(module: TypeModule, code: string, emitted: Diagnostic[], strict: boolean): ConversionResult {
  const diagnostics = [...module.diagnostics, ...emitted].sort(
    (a, b) => (a.loc?.line ?? Infinity) - (b.loc?.line ?? Infinity) || ORDER[a.severity] - ORDER[b.severity],
  );
  if (strict) {
    const serious = diagnostics.filter((d) => d.severity !== 'info');
    if (serious.length) throw new ConversionError(serious);
  }
  return { code, diagnostics, module };
}
