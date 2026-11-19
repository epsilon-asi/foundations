/** Split at separators, camel-case boundaries, and the end of acronyms such as HTTP in HTTPServer. */
function splitWords(name: string): string[] {
  return name
    .replace(/([\p{Ll}\p{Nd}])(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2')
    .toLowerCase()
    .match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** `ApiKey` → `apiKey`. */
export function toCamelCase(name: string): string {
  const [first = '', ...rest] = splitWords(name);
  return first + rest.map(capitalize).join('');
}

/** `api_key` → `ApiKey`. */
export function toPascalCase(name: string): string {
  return splitWords(name).map(capitalize).join('');
}

/** `apiKey` → `api_key`. */
export function toSnakeCase(name: string): string {
  return splitWords(name).join('_');
}

/** `logLevel` → `log-level`, `HTTPServer` → `http-server`. */
export function toKebabCase(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

/** `agent-engineer` → `AGENT_ENGINEER`, `myCli` → `MY_CLI`. Used for environment variable names. */
export function toScreamingSnakeCase(name: string): string {
  return toKebabCase(name)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}
