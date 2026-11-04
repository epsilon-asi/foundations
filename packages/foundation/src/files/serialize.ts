import * as z from "zod";
import {SerializeOptions} from "./types";
import {render, toWireAsync, toWireSync} from "./util";

/** Validate/encode a value with the schema and render it as JSON or YAML text. */
export function serialize<S extends z.ZodType>(
    schema: S,
    value: z.output<S>,
    options: SerializeOptions,
): string {
    return render(toWireSync(schema, value, options), options);
}

/** Async variant; required when the schema has async refinements or codecs. */
export async function serializeAsync<S extends z.ZodType>(
    schema: S,
    value: z.output<S>,
    options: SerializeOptions,
): Promise<string> {
    return render(await toWireAsync(schema, value, options), options);
}