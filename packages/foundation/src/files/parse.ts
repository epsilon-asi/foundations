import * as z from "zod";
import {ParseOptions} from "./types";
import {decodeText, resolveFormat, runPreprocess, runPreprocessSync, validateAsync, validateSync} from "./util";

/** Parse and validate a string already in memory. */
export async function parseString<S extends z.ZodType>(
    schema: S,
    text: string,
    options: ParseOptions = {},
): Promise<z.output<S>> {
    const format = resolveFormat(options.format, options.filePath, text);
    const raw = await runPreprocess(decodeText(text, format, options), format, options);
    return validateAsync(schema, raw, options);
}

export function parseStringSync<S extends z.ZodType>(
    schema: S,
    text: string,
    options: ParseOptions = {},
): z.output<S> {
    const format = resolveFormat(options.format, options.filePath, text);
    const raw = runPreprocessSync(decodeText(text, format, options), format, options);
    return validateSync(schema, raw, options);
}