import type {ProjectTemplate} from './schema.js';

/** `{{var}}`, with optional spaces inside the braces. */
const VARIABLE = /\{\{\s*([A-Za-z]\w*)\s*\}\}/g;

/** Files with this suffix have their contents rendered; the suffix is dropped. */
export const TEMPLATE_SUFFIX = '.tmpl';

/** What a project name may look like. It is also the default target folder. */
export const PROJECT_NAME = /^[A-Za-z][A-Za-z0-9._-]*$/;

export type Variables = Record<string, string>;

function lookup(vars: Variables, key: string, where: string): string {
    const value = vars[key];
    if (value === undefined) {
        throw new Error(`Unknown variable '{{${key}}}' in ${where}`);
    }
    return value;
}

/** Fills every `{{var}}` in `text`. An unknown variable throws, naming `where`. */
export function renderString(text: string, vars: Variables, where = 'template'): string {
    return text.replace(VARIABLE, (_match, key: string) => lookup(vars, key, where));
}

/** Fills every `{{var}}` in a relative path and drops a trailing `.tmpl`. */
export function renderPath(relPath: string, vars: Variables): string {
    const rendered = renderString(relPath, vars, relPath);
    return rendered.endsWith(TEMPLATE_SUFFIX) ? rendered.slice(0, -TEMPLATE_SUFFIX.length) : rendered;
}

/** The variable names `text` refers to, in order of first appearance. */
export function referencedVariables(text: string): string[] {
    return [...new Set(Array.from(text.matchAll(VARIABLE), (match) => match[1] as string))];
}

/** Parses trailing CLI arguments: `["port=8080"]` → `{ port: "8080" }`. Splits on the first `=`. */
export function parseVarArgs(args: readonly string[]): Variables {
    const vars: Variables = {};
    for (const arg of args) {
        const index = arg.indexOf('=');
        if (index <= 0) {
            throw new Error(`Expected key=value, got '${arg}'`);
        }
        const key = arg.slice(0, index);
        if (key in vars) {
            throw new Error(`Variable '${key}' was given more than once`);
        }
        vars[key] = arg.slice(index + 1);
    }
    return vars;
}

function words(text: string): string[] {
    return text
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .split(/[^A-Za-z0-9]+/)
        .filter((word) => word.length > 0);
}

/** `OrdersAPI service` → `orders-api-service`. */
export function toKebab(text: string): string {
    return words(text).map((word) => word.toLowerCase()).join('-');
}

/** `orders-api` → `OrdersApi`. */
export function toPascal(text: string): string {
    return words(text)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

/** `name`, `packageName` and `PascalName` for a project name. */
export function builtInVariables(name: string): Variables {
    if (!PROJECT_NAME.test(name)) {
        throw new Error(
            `Invalid project name '${name}': it must start with a letter and contain only letters, digits, '.', '_' and '-'`,
        );
    }
    return {name, packageName: toKebab(name), PascalName: toPascal(name)};
}

/**
 * The values every `{{var}}` in a template resolves to: the built-ins, then each
 * declared variable from `given`, else its default, else an error if it is
 * required, else an empty string. Defaults may use the built-ins only.
 */
export function resolveVariables(template: ProjectTemplate, name: string, given: Variables): Variables {
    const builtIns = builtInVariables(name);

    const unknown = Object.keys(given).filter((key) => !(key in template.variables));
    if (unknown.length > 0) {
        const declared = Object.keys(template.variables);
        throw new Error(
            `Template '${template.id}' has no variable ${unknown.map((key) => `'${key}'`).join(', ')}` +
                (declared.length > 0 ? ` (declared: ${declared.join(', ')})` : ' (it declares none)'),
        );
    }

    const vars: Variables = {...builtIns};
    const missing: string[] = [];
    for (const [key, spec] of Object.entries(template.variables)) {
        const value = given[key];
        if (value !== undefined) {
            vars[key] = value;
        } else if (spec.default !== undefined) {
            vars[key] = renderString(spec.default, builtIns, `the default of '${key}'`);
        } else if (spec.required) {
            missing.push(`${key}=<value> (${spec.description})`);
        } else {
            vars[key] = '';
        }
    }

    if (missing.length > 0) {
        throw new Error(`Template '${template.id}' requires ${missing.join(', ')}`);
    }
    return vars;
}
