import * as z from "zod";
import {existsSync} from "node:fs";
import path from "node:path";
import {
    DiscoverOptions,
    FileLayer,
    LayeredLoadOptions,
    LayeredResult,
    LoadOptions,
    SafeResult,
    SchemaFileError,
} from "./types";
import {
    deepMerge,
    expandHome,
    isPlainObject,
    pathExists,
    readRawAsync,
    readRawSync,
    safely,
    safelySync,
    validateAsync,
    validateSync,
} from "./util";

/**
 * Every place `fileName` may live, highest precedence first: the extra files, the start directory, each
 * ancestor up to `stopDir` (or the root), then the fallbacks. Duplicates keep their highest-precedence slot.
 */
function candidates(fileName: string, options: DiscoverOptions): FileLayer[] {
    const start = path.resolve(expandHome(options.startDir ?? process.cwd()));
    const stopAt = options.stopDir === undefined ? undefined : path.resolve(expandHome(options.stopDir));
    const all: FileLayer[] = (options.extraFiles ?? []).map((extra) => ({
        filePath: path.resolve(start, expandHome(extra)),
        origin: "extra",
    }));

    for (let dir = start; ; dir = path.dirname(dir)) {
        all.push({filePath: path.join(dir, fileName), origin: dir === start ? "local" : "ancestor"});
        if (dir === stopAt || dir === path.dirname(dir)) break;
    }
    for (const fallback of options.fallbacks ?? []) {
        all.push({filePath: path.resolve(expandHome(fallback)), origin: "fallback"});
    }

    const seen = new Set<string>();
    return all.filter(({filePath}) => !seen.has(filePath) && Boolean(seen.add(filePath)));
}

/** Extra files are kept whether or not they exist, so a missing one is reported when it loads. */
const isRequested = (layer: FileLayer): boolean => layer.origin === "extra";

/**
 * Find every existing `fileName` (a name or a relative path such as `.tool/config.yaml`) from
 * `startDir` upwards, then among `fallbacks`, after any `extraFiles`. Results are ordered highest
 * precedence first.
 */
export async function discoverLayers(fileName: string, options: DiscoverOptions = {}): Promise<FileLayer[]> {
    const all = candidates(fileName, options);
    const present = await Promise.all(all.map((layer) => isRequested(layer) || pathExists(layer.filePath)));
    return all.filter((_, i) => present[i]);
}

export function discoverLayersSync(fileName: string, options: DiscoverOptions = {}): FileLayer[] {
    return candidates(fileName, options).filter((layer) => isRequested(layer) || existsSync(layer.filePath));
}

/** A layer must be a mapping to merge; an empty file contributes nothing. */
function asLayer(raw: unknown, filePath: string): unknown {
    if (raw === undefined || isPlainObject(raw)) return raw;
    throw new SchemaFileError("validate", `Cannot merge ${filePath}: its top level must be a mapping`, {filePath});
}

/** Validation runs on the merged value, so errors name every file that went into it. */
function mergedOptions(filePaths: readonly string[], options: LoadOptions): LoadOptions {
    const filePath = filePaths.length > 1 ? `merged ${filePaths.join(", ")}` : filePaths[0];
    return {...options, filePath};
}

/**
 * Load several JSON/YAML files, deep-merge them and validate the result once.
 * `filePaths` is highest precedence first. Each file is read raw (no schema defaults), so a
 * lower layer's value is never masked by a default; defaults apply only to keys no layer sets.
 */
export async function loadMergedFiles<S extends z.ZodType>(
    filePaths: readonly string[],
    schema: S,
    options: LoadOptions = {},
): Promise<z.output<S>> {
    const layers = await Promise.all(
        filePaths.map(async (filePath) => asLayer(await readRawAsync(filePath, options), filePath)),
    );
    return validateAsync(schema, deepMerge(...layers.reverse()), mergedOptions(filePaths, options));
}

export function loadMergedFilesSync<S extends z.ZodType>(
    filePaths: readonly string[],
    schema: S,
    options: LoadOptions = {},
): z.output<S> {
    const layers = filePaths.map((filePath) => asLayer(readRawSync(filePath, options), filePath));
    return validateSync(schema, deepMerge(...layers.reverse()), mergedOptions(filePaths, options));
}

/**
 * Discover every `fileName` layer (see discoverLayers), merge them and validate.
 * Precedence: extraFiles (in order) > start directory > nearer ancestors > farther ancestors > fallbacks (in order).
 * With no layers found, the schema validates `{}`, so its defaults apply.
 */
export async function loadLayeredFile<S extends z.ZodType>(
    fileName: string,
    schema: S,
    options: LayeredLoadOptions = {},
): Promise<LayeredResult<z.output<S>>> {
    const layers = await discoverLayers(fileName, options);
    const value = await loadMergedFiles(layers.map((layer) => layer.filePath), schema, options);
    return {value, layers};
}

/** Synchronous variant. Fails if the schema contains async refinements/transforms. */
export function loadLayeredFileSync<S extends z.ZodType>(
    fileName: string,
    schema: S,
    options: LayeredLoadOptions = {},
): LayeredResult<z.output<S>> {
    const layers = discoverLayersSync(fileName, options);
    const value = loadMergedFilesSync(layers.map((layer) => layer.filePath), schema, options);
    return {value, layers};
}

/** Like loadLayeredFile, but returns a result object instead of throwing SchemaFileError. */
export function safeLoadLayeredFile<S extends z.ZodType>(
    fileName: string,
    schema: S,
    options: LayeredLoadOptions = {},
): Promise<SafeResult<LayeredResult<z.output<S>>>> {
    return safely(() => loadLayeredFile(fileName, schema, options));
}

export function safeLoadLayeredFileSync<S extends z.ZodType>(
    fileName: string,
    schema: S,
    options: LayeredLoadOptions = {},
): SafeResult<LayeredResult<z.output<S>>> {
    return safelySync(() => loadLayeredFileSync(fileName, schema, options));
}

/**
 * Bind a schema, file name and default options once, reuse everywhere.
 * Per-call options are shallow-merged over the defaults, e.g. `config.load({startDir})`.
 *
 * @example
 * const Config = createLayeredFile(ConfigSchema, "tool.yaml", {fallbacks: ["~/.tool/tool.yaml"]});
 * const {value, layers} = await Config.load();
 */
export function createLayeredFile<S extends z.ZodType>(
    schema: S,
    fileName: string,
    defaults: LayeredLoadOptions = {},
) {
    const o = (options?: LayeredLoadOptions): LayeredLoadOptions => ({...defaults, ...options});
    return {
        schema,
        fileName,
        discover: (options?: DiscoverOptions) => discoverLayers(fileName, o(options)),
        discoverSync: (options?: DiscoverOptions) => discoverLayersSync(fileName, o(options)),
        load: (options?: LayeredLoadOptions) => loadLayeredFile(fileName, schema, o(options)),
        loadSync: (options?: LayeredLoadOptions) => loadLayeredFileSync(fileName, schema, o(options)),
        safeLoad: (options?: LayeredLoadOptions) => safeLoadLayeredFile(fileName, schema, o(options)),
        safeLoadSync: (options?: LayeredLoadOptions) => safeLoadLayeredFileSync(fileName, schema, o(options)),
    };
}
