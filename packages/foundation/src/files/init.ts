import * as z from "zod";
import {LoadOptions, ParseOptions, SaveOptions, SerializeOptions} from "./types";
import {isPlainObject} from "./util";
import {serializeAsync} from "./serialize";
import {loadFile, loadFileSync, safeLoadFile, safeLoadFileSync} from "./load";
import {saveFile, saveFileSync} from "./save";
import {parseString} from "./parse";

/**
 * Bind a schema and default options once, reuse everywhere.
 * Per-call options are shallow-merged over the defaults.
 */
export function createSchemaFile<S extends z.ZodType>(
    schema: S,
    defaults: { load?: LoadOptions; save?: SaveOptions } = {},
) {
    const l = (o?: LoadOptions): LoadOptions => ({...defaults.load, ...o});
    const s = (o?: SaveOptions): SaveOptions => ({...defaults.save, ...o});
    return {
        schema,
        load: (filePath: string, o?: LoadOptions) => loadFile(filePath, schema, l(o)),
        loadSync: (filePath: string, o?: LoadOptions) => loadFileSync(filePath, schema, l(o)),
        safeLoad: (filePath: string, o?: LoadOptions) => safeLoadFile(filePath, schema, l(o)),
        safeLoadSync: (filePath: string, o?: LoadOptions) => safeLoadFileSync(filePath, schema, l(o)),
        parse: (text: string, o?: ParseOptions) => parseString(schema, text, l(o)),
        save: (filePath: string, value: z.output<S>, o?: SaveOptions) =>
            saveFile(filePath, schema, value, s(o)),
        saveSync: (filePath: string, value: z.output<S>, o?: SaveOptions) =>
            saveFileSync(filePath, schema, value, s(o)),
        serialize: (value: z.output<S>, o: SerializeOptions) =>
            serializeAsync(schema, value, {...defaults.save, ...o}),
    };
}

/**
 * Recursively replace ${VAR} and ${VAR:-fallback} in string values.
 * For a `preprocess` hook use interpolateEnvHook(): a hook's second argument is the
 * PreprocessContext, which this function would read as `env`. Note results are strings,
 * so use z.coerce.* in the schema for numeric/boolean fields filled from env vars.
 */
export function interpolateEnv(
    value: unknown,
    env: Record<string, string | undefined> = process.env,
    options: { strict?: boolean } = {},
): unknown {
    const pattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g;
    const walk = (v: unknown): unknown => {
        if (typeof v === "string") {
            return v.replace(pattern, (_m, name: string, fallback?: string) => {
                const found = env[name];
                if (found !== undefined && found !== "") return found;
                if (fallback !== undefined) return fallback;
                if (options.strict) throw new Error(`Environment variable "${name}" is not set`);
                return "";
            });
        }
        if (Array.isArray(v)) return v.map(walk);
        if (isPlainObject(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
        return v;
    };
    return walk(value);
}

/** A `preprocess` hook that runs interpolateEnv over the parsed data: { preprocess: interpolateEnvHook() }. */
export function interpolateEnvHook(
    env: Record<string, string | undefined> = process.env,
    options: { strict?: boolean } = {},
): (raw: unknown) => unknown {
    return (raw) => interpolateEnv(raw, env, options);
}
