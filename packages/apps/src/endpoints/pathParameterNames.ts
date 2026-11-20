import { ApiDefinitionError } from './ApiDefinitionError.js';

// Express route templates use :name and *name, with identifier or quoted names.
// Consume escaped literals first so an escaped marker never claims a request field.
const tokens = /\\[\s\S]|[{}]|[:*](?:([$_\p{ID_Start}][$\u200c\u200d\p{ID_Continue}]*)|"((?:[^"\\]|\\[\s\S])*)")?/gu;

/** The Express route shape, independent of parameter names, case and trailing slashes. */
export function routePathKey(path: string): string {
  const withoutTrailingSlashes = path === '/' ? path : path.replace(/\/+$/, '');
  const template = withoutTrailingSlashes.replace(tokens, token => {
    if (!token.startsWith('\\')) return token[0];
    const literal = token.slice(1);
    return ':*{}\\'.includes(literal) ? token : literal;
  });
  // Express 5 uses a case-insensitive regexp without the Unicode flag. Each UTF-16
  // code unit folds independently, without expanding ß to SS or folding ſ to S.
  return template.replace(/[a-z\u0080-\uFFFF]/g, char => {
    const upper = char.toUpperCase();
    if (upper.length !== 1 || (char.charCodeAt(0) >= 128 && upper.charCodeAt(0) < 128)) return char;
    return upper;
  });
}

/** Reads the parameters of a route, tracking which can be omitted with their group. */
export function pathParameters(path: string) {
  const parameters: { name: string; optional: boolean }[] = [];
  let groupDepth = 0;
  for (const [token, identifier, quoted] of path.matchAll(tokens)) {
    if (token.startsWith('\\')) continue;
    if (token === '{') {
      groupDepth++;
      continue;
    }
    if (token === '}') {
      if (groupDepth === 0) throw new ApiDefinitionError(`Unexpected closing brace in route "${path}".`);
      groupDepth--;
      continue;
    }
    const name = identifier ?? quoted?.replace(/\\([\s\S])/gu, '$1');
    if (!name) throw new ApiDefinitionError(`Expected a named path parameter in route "${path}".`);
    parameters.push({ name, optional: groupDepth > 0 });
  }
  if (groupDepth !== 0) throw new ApiDefinitionError(`Unclosed path group in route "${path}".`);
  return parameters;
}

export function pathParameterNames(path: string): string[] {
  return pathParameters(path).map(parameter => parameter.name);
}
