import type { OptionMetadata } from './types.js';

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

/** `InfoCommand` → `info`, `AgentEngineerCli` → `agent-engineer`. */
export function commandNameFromClass(className: string): string {
  const stripped = className.replace(/(Command|Cli|CLI)$/, '');
  return toKebabCase(stripped === '' ? className : stripped);
}

/** Commander flags for an option, derived from the property name unless `flags` is given. */
export function optionFlags(propertyName: string, metadata: OptionMetadata): string {
  if (metadata.flags !== undefined) return metadata.flags;

  const kebab = toKebabCase(propertyName);
  const long = `--${kebab}`;
  const flags = metadata.short === undefined ? long : `-${metadata.short}, ${long}`;

  if (metadata.type === 'boolean') return flags;
  return `${flags} <${metadata.valueName ?? kebab}>`;
}

export interface ParsedFlags {
  /** The short flag without its dash, e.g. `l`. */
  readonly short: string | undefined;
  /** The long flag without its dashes, e.g. `log-level`. */
  readonly long: string | undefined;
}

/** The flag names in a commander flags string: `-l, --log-level <level>` → `l` and `log-level`. */
export function parseFlags(flags: string): ParsedFlags {
  let short: string | undefined;
  let long: string | undefined;

  for (const token of flags.split(/[\s,|]+/)) {
    if (token.startsWith('--')) long ??= token.slice(2);
    else if (/^-[^-]$/.test(token)) short ??= token.slice(1);
  }

  return { short, long };
}

/** Commander syntax for a positional argument: `<name>`, `[name]`, `<name...>` or `[name...]`. */
export function argumentSyntax(name: string, required: boolean, variadic: boolean): string {
  const inner = variadic ? `${name}...` : name;
  return required ? `<${inner}>` : `[${inner}]`;
}
