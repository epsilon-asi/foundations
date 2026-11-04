import * as z from "zod";
import {SaveOptions} from "./types";
import {serialize, serializeAsync} from "./serialize";
import {resolveFormat, writeTextAsync, writeTextSync} from "./util";

export function saveFileSync<S extends z.ZodType>(
    filePath: string,
    schema: S,
    value: z.output<S>,
    options: SaveOptions = {},
): string {
    const format = resolveFormat(options.format, filePath);
    const text = serialize(schema, value, {...options, format, filePath});
    writeTextSync(filePath, text, options);
    return text;
}

/** Serialize and write to disk. Returns the text that was written. */
export async function saveFile<S extends z.ZodType>(
    filePath: string,
    schema: S,
    value: z.output<S>,
    options: SaveOptions = {},
): Promise<string> {
    const format = resolveFormat(options.format, filePath);
    const text = await serializeAsync(schema, value, {...options, format, filePath});
    await writeTextAsync(filePath, text, options);
    return text;
}