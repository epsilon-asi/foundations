/** Identifier rules and case conversion for both languages. */

/** Hard keywords: never valid as a Python identifier. Soft keywords (`match`, `case`, `type`, `_`) are. */
export const PYTHON_KEYWORDS: ReadonlySet<string> = new Set([
  'False',
  'None',
  'True',
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
]);

/** Words TypeScript rejects as the name of an interface, type alias, enum or class. */
export const TYPESCRIPT_RESERVED_TYPE_NAMES: ReadonlySet<string> = new Set([
  // ECMAScript reserved words
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  // Strict-mode reserved words (modules are strict)
  'implements',
  'interface',
  'let',
  'package',
  'private',
  'protected',
  'public',
  'static',
  'yield',
  'await',
  // Predefined type names
  'any',
  'unknown',
  'never',
  'number',
  'bigint',
  'boolean',
  'string',
  'symbol',
  'object',
  'undefined',
]);

const PYTHON_IDENTIFIER = /^[\p{L}\p{Nl}_][\p{L}\p{Nl}\p{Mn}\p{Mc}\p{Nd}\p{Pc}]*$/u;
const TS_IDENTIFIER = /^[\p{ID_Start}$_][\p{ID_Continue}$‌‍]*$/u;

export function isPythonIdentifier(name: string): boolean {
  return PYTHON_IDENTIFIER.test(name) && !PYTHON_KEYWORDS.has(name);
}

/** True when `name` can be written unquoted as a TypeScript property key. Reserved words are allowed there. */
export function isTsPropertyIdentifier(name: string): boolean {
  return TS_IDENTIFIER.test(name);
}

export function isTsTypeName(name: string): boolean {
  return TS_IDENTIFIER.test(name) && !TYPESCRIPT_RESERVED_TYPE_NAMES.has(name);
}

/**
 * Makes `name` a valid Python identifier: invalid characters become `_`, a leading digit gets a `_` prefix and a
 * keyword gets a `_` suffix (`from` → `from_`, PEP 8's convention).
 */
export function toPythonIdentifier(name: string): string {
  if (isPythonIdentifier(name)) return name;
  if (PYTHON_KEYWORDS.has(name)) return `${name}_`;
  let out = '';
  for (const ch of name) out += /[\p{L}\p{Nl}\p{Mn}\p{Mc}\p{Nd}\p{Pc}]/u.test(ch) ? ch : '_';
  if (out === '' || /^\p{Nd}/u.test(out)) out = `_${out}`;
  return PYTHON_KEYWORDS.has(out) ? `${out}_` : out;
}

/** Makes `name` a valid TypeScript type name: reserved words get a `_` suffix, invalid characters become `_`. */
export function toTsTypeName(name: string): string {
  if (isTsTypeName(name)) return name;
  if (TYPESCRIPT_RESERVED_TYPE_NAMES.has(name)) return `${name}_`;
  let out = '';
  for (const ch of name) out += /[\p{ID_Continue}$]/u.test(ch) ? ch : '_';
  if (out === '' || !/^[\p{ID_Start}$_]/u.test(out)) out = `_${out}`;
  return out;
}

/**
 * Splits an identifier into lowercase words. Handles camelCase, PascalCase, snake_case, kebab-case and acronyms:
 * `HTTPServerError2` → `['http', 'server', 'error2']`. Leading and trailing underscores are not words.
 */
export function splitWords(name: string): string[] {
  return name
    .replace(/([\p{Ll}\p{Nd}])(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2')
    .split(/[\s_\-.]+/u)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/** Leading/trailing underscores carry meaning (`_private`, `class_`), so case conversion keeps them. */
function keepAffixes(name: string, convert: (core: string) => string): string {
  const match = /^(_*)(.*?)(_*)$/su.exec(name)!;
  const core = match[2]!;
  return core ? `${match[1]}${convert(core)}${match[3]}` : name;
}

export function toCamelCase(name: string): string {
  return keepAffixes(name, (core) => {
    const words = splitWords(core);
    return words.map((w, i) => (i === 0 ? w : capitalize(w))).join('') || core;
  });
}

export function toPascalCase(name: string): string {
  return keepAffixes(name, (core) => splitWords(core).map(capitalize).join('') || core);
}

export function toSnakeCase(name: string): string {
  return keepAffixes(name, (core) => splitWords(core).join('_') || core);
}

/** How property names are rewritten. A function receives the source name and returns the target name. */
export type PropertyCase = 'preserve' | 'camelCase' | 'snake_case' | 'PascalCase' | ((name: string) => string);

export function applyCase(name: string, style: PropertyCase): string {
  if (typeof style === 'function') return style(name);
  switch (style) {
    case 'preserve':
      return name;
    case 'camelCase':
      return toCamelCase(name);
    case 'snake_case':
      return toSnakeCase(name);
    case 'PascalCase':
      return toPascalCase(name);
  }
}

/** Returns `base`, or `base2`, `base3`, ... — the first not in `taken` — and adds it to `taken`. */
export function uniqueName(base: string, taken: Set<string>): string {
  let name = base;
  for (let i = 2; taken.has(name); i++) name = `${base}${i}`;
  taken.add(name);
  return name;
}

/** A naive singular for naming the element type of a plural property: `items` → `Item`, `addresses` → `Address`. */
export function singularize(word: string): string {
  if (/ies$/i.test(word) && word.length > 4) return word.slice(0, -3) + 'y';
  if (/(ss|us|is)$/i.test(word)) return word;
  if (/(x|ch|sh|ss|ses)es$/i.test(word)) return word.slice(0, -2);
  if (/s$/i.test(word) && word.length > 1) return word.slice(0, -1);
  return word;
}
