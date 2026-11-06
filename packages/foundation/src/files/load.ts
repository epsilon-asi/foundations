import * as z from "zod";
import {LoadOptions, SafeResult} from "./types";
import {readRawAsync, readRawSync, safely, safelySync, validateAsync, validateSync} from "./util";

/** Read a JSON/YAML file and return a validated, typed value. */
export async function loadFile<S extends z.ZodType>(
    filePath: string,
    schema: S,
    options: LoadOptions = {},
): Promise<z.output<S>> {
    return validateAsync(schema, await readRawAsync(filePath, options), {...options, filePath});
}

/** Synchronous variant. Fails if the schema contains async refinements/transforms. */
export function loadFileSync<S extends z.ZodType>(
    filePath: string,
    schema: S,
    options: LoadOptions = {},
): z.output<S> {
    return validateSync(schema, readRawSync(filePath, options), {...options, filePath});
}

/** Like loadFile, but returns a result object instead of throwing SchemaFileError. */
export function safeLoadFile<S extends z.ZodType>(
    filePath: string,
    schema: S,
    options: LoadOptions = {},
): Promise<SafeResult<z.output<S>>> {
    return safely(() => loadFile(filePath, schema, options));
}

export function safeLoadFileSync<S extends z.ZodType>(
    filePath: string,
    schema: S,
    options: LoadOptions = {},
): SafeResult<z.output<S>> {
    return safelySync(() => loadFileSync(filePath, schema, options));
}
