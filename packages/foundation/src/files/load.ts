import * as z from "zod";
import {LoadOptions, SafeResult, SchemaFileError} from "./types";
import {
    readTextAsync,
    readTextSync,
    runPreprocess,
    runPreprocessSync,
    toRaw,
    validateAsync,
    validateSync
} from "./util";

/** Read a JSON/YAML file and return a validated, typed value. */
export async function loadFile<S extends z.ZodType>(
    filePath: string,
    schema: S,
    options: LoadOptions = {},
): Promise<z.output<S>> {
    const opts = {...options, filePath};
    const {raw, format} = toRaw(await readTextAsync(filePath, opts), opts);
    return validateAsync(schema, await runPreprocess(raw, format, opts), opts);
}

/** Synchronous variant. Fails if the schema contains async refinements/transforms. */
export function loadFileSync<S extends z.ZodType>(
    filePath: string,
    schema: S,
    options: LoadOptions = {},
): z.output<S> {
    const opts = {...options, filePath};
    const {raw, format} = toRaw(readTextSync(filePath, opts), opts);
    return validateSync(schema, runPreprocessSync(raw, format, opts), opts);
}

/** Like loadFile, but returns a result object instead of throwing SchemaFileError. */
export async function safeLoadFile<S extends z.ZodType>(
    filePath: string,
    schema: S,
    options: LoadOptions = {},
): Promise<SafeResult<z.output<S>>> {
    try {
        return {success: true, data: await loadFile(filePath, schema, options)};
    } catch (error) {
        if (error instanceof SchemaFileError) return {success: false, error};
        throw error;
    }
}

export function safeLoadFileSync<S extends z.ZodType>(
    filePath: string,
    schema: S,
    options: LoadOptions = {},
): SafeResult<z.output<S>> {
    try {
        return {success: true, data: loadFileSync(filePath, schema, options)};
    } catch (error) {
        if (error instanceof SchemaFileError) return {success: false, error};
        throw error;
    }
}