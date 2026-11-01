import type { OptionMetadata } from './types.js';

/** `logLevel` → `log-level`, `HTTPServer` → `http-server`. */
export function toKebabCase(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
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

/** Commander syntax for a positional argument: `<name>`, `[name]`, `<name...>` or `[name...]`. */
export function argumentSyntax(name: string, required: boolean, variadic: boolean): string {
  const inner = variadic ? `${name}...` : name;
  return required ? `<${inner}>` : `[${inner}]`;
}
