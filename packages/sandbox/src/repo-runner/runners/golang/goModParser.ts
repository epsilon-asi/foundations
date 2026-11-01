import type { GoModFile } from './golang.contracts.js';

const DIRECTIVE = /^(?<name>module|go|toolchain)\s+(?<value>"[^"]*"|\S+)/;

function unquote(value: string): string {
  return value.startsWith('"') ? value.slice(1, -1) : value;
}

/**
 * Extracts the `module`, `go` and `toolchain` directives from `go.mod` source.
 * Comments are ignored; `require`/`replace`/... directives are not interpreted.
 *
 * @throws Error when there is no `module` directive.
 */
export function parseGoMod(source: string): GoModFile {
  const directives = new Map<string, string>();

  for (const line of source.split(/\r?\n/)) {
    const match = DIRECTIVE.exec(line.replace(/\/\/.*$/, '').trim());
    const name = match?.groups?.name;
    const value = match?.groups?.value;
    if (name !== undefined && value !== undefined && !directives.has(name)) {
      directives.set(name, unquote(value));
    }
  }

  const modulePath = directives.get('module');
  if (modulePath === undefined) {
    throw new Error('missing module directive');
  }

  return {
    modulePath,
    goVersion: directives.get('go') ?? null,
    toolchain: directives.get('toolchain') ?? null,
  };
}
