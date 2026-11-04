import * as YAML from "yaml";
import * as z from "zod";
import {access, chmod, mkdir, readFile, readlink, realpath, rename, stat, unlink, writeFile} from "node:fs/promises";
import path from "node:path";
import {
    chmodSync,
    existsSync,
    mkdirSync,
    readFileSync,
    readlinkSync,
    realpathSync,
    renameSync,
    statSync,
    unlinkSync,
    writeFileSync
} from "node:fs";
import {
    ErrorFormatter,
    EXTENSIONS,
    FileFormat,
    LoadOptions,
    ParseOptions,
    SaveOptions,
    SchemaFileError,
    SerializeOptions,
    SerializeStrategy
} from "./types";


const MISSING = Symbol("missing");


export function label(filePath?: string): string {
    return filePath ?? "input";
}

function errMsg(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
    if (typeof v !== "object" || v === null) return false;
    const proto = Object.getPrototypeOf(v);
    return proto === Object.prototype || proto === null;
}

function isNotFound(e: unknown): boolean {
    return (e as NodeJS.ErrnoException)?.code === "ENOENT";
}

export function decodeText(text: string, format: FileFormat, opts: ParseOptions): unknown {
    const src = opts.stripBom !== false && text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    if (src.trim() === "") return opts.emptyValue;
    try {
        return format === "json" ? JSON.parse(src, opts.json?.reviver) : YAML.parse(src, opts.yaml);
    } catch (cause) {
        throw new SchemaFileError(
            "parse",
            `Failed to parse ${label(opts.filePath)} as ${format.toUpperCase()}: ${errMsg(cause)}`,
            {filePath: opts.filePath, cause},
        );
    }
}

export function formatFromExtension(filePath: string): FileFormat | undefined {
    return EXTENSIONS[path.extname(filePath).toLowerCase()];
}

/**
 * Resolve a format from an explicit option, the extension, or (last) the content.
 * Content sniffing falls back to YAML because YAML 1.2 is a superset of JSON.
 */
export function resolveFormat(
    format: FileFormat | "auto" | undefined,
    filePath?: string,
    content?: string,
): FileFormat {
    if (format && format !== "auto") return format;
    const byExt = filePath ? formatFromExtension(filePath) : undefined;
    if (byExt) return byExt;
    if (content !== undefined) return "yaml";
    throw new SchemaFileError(
        "format",
        `Cannot determine format for ${label(filePath)}; pass { format: "json" | "yaml" }`,
        {filePath},
    );
}

export function toRaw(text: string | typeof MISSING, opts: LoadOptions): { raw: unknown; format: FileFormat } {
    if (text === MISSING) {
        return {
            raw: "missingValue" in opts ? opts.missingValue : {},
            format: resolveFormat(opts.format, opts.filePath, ""),
        };
    }
    const format = resolveFormat(opts.format, opts.filePath, text);
    return {raw: decodeText(text, format, opts), format};
}

export async function readTextAsync(filePath: string, opts: LoadOptions): Promise<string | typeof MISSING> {
    try {
        return await readFile(filePath, {encoding: opts.encoding ?? "utf8"});
    } catch (cause) {
        if (opts.allowMissing && isNotFound(cause)) return MISSING;
        throw new SchemaFileError("read", `Failed to read ${filePath}: ${errMsg(cause)}`, {filePath, cause});
    }
}

export function readTextSync(filePath: string, opts: LoadOptions): string | typeof MISSING {
    try {
        return readFileSync(filePath, {encoding: opts.encoding ?? "utf8"});
    } catch (cause) {
        if (opts.allowMissing && isNotFound(cause)) return MISSING;
        throw new SchemaFileError("read", `Failed to read ${filePath}: ${errMsg(cause)}`, {filePath, cause});
    }
}

export async function runPreprocess(raw: unknown, format: FileFormat, opts: ParseOptions): Promise<unknown> {
    if (!opts.preprocess) return raw;
    try {
        return await opts.preprocess(raw, {format, filePath: opts.filePath});
    } catch (cause) {
        throw preprocessError(cause, opts.filePath);
    }
}

export function runPreprocessSync(raw: unknown, format: FileFormat, opts: ParseOptions): unknown {
    if (!opts.preprocess) return raw;
    let result: unknown;
    try {
        result = opts.preprocess(raw, {format, filePath: opts.filePath});
    } catch (cause) {
        throw preprocessError(cause, opts.filePath);
    }
    if (result instanceof Promise) {
        // Nobody will await it, so keep a rejection from surfacing as an unhandledRejection.
        result.catch(() => {
        });
        throw new SchemaFileError("preprocess", "preprocess returned a Promise; use the async API instead", {
            filePath: opts.filePath,
        });
    }
    return result;
}

function preprocessError(cause: unknown, filePath?: string): SchemaFileError {
    return new SchemaFileError("preprocess", `Preprocess failed for ${label(filePath)}: ${errMsg(cause)}`, {
        filePath,
        cause,
    });
}

function zodError(
    kind: "validate" | "encode",
    error: z.core.$ZodError,
    formatError: ErrorFormatter | undefined,
    filePath?: string,
): SchemaFileError {
    const pretty = (formatError ?? z.prettifyError)(error);
    const verb = kind === "encode" ? "Encoding" : "Validation";
    return new SchemaFileError(kind, `${verb} failed for ${label(filePath)}:\n${pretty}`, {
        filePath,
        issues: error.issues,
        cause: error,
    });
}

export async function validateAsync<S extends z.ZodType>(schema: S, raw: unknown, opts: ParseOptions) {
    const result = await schema.safeParseAsync(raw, opts.parseParams);
    if (result.success) return result.data as z.output<S>;
    throw zodError("validate", result.error, opts.formatError, opts.filePath);
}

export function validateSync<S extends z.ZodType>(schema: S, raw: unknown, opts: ParseOptions) {
    let result: ReturnType<S["safeParse"]>;
    try {
        result = schema.safeParse(raw, opts.parseParams) as ReturnType<S["safeParse"]>;
    } catch (cause) {
        // e.g. "Encountered Promise during synchronous parse" for async refinements
        throw new SchemaFileError(
            "validate",
            `Synchronous validation failed for ${label(opts.filePath)}: ${errMsg(cause)} (try the async API)`,
            {filePath: opts.filePath, cause},
        );
    }
    if (result.success) return result.data as z.output<S>;
    throw zodError("validate", result.error, opts.formatError, opts.filePath);
}

function wireError(cause: unknown, strategy: SerializeStrategy, opts: SerializeOptions): SchemaFileError {
    const kind = strategy === "encode" ? "encode" : "validate";
    if (cause instanceof z.core.$ZodError) return zodError(kind, cause, opts.formatError, opts.filePath);
    const hint =
        cause instanceof z.core.$ZodAsyncError
            ? " (try the async API)"
            : cause instanceof z.core.$ZodEncodeError
                ? ' (one-way .transform() cannot be encoded; use z.codec() or strategy: "parse")'
                : "";
    return new SchemaFileError(kind, `Could not ${strategy} value for ${label(opts.filePath)}: ${errMsg(cause)}${hint}`, {
        filePath: opts.filePath,
        cause,
    });
}

export function toWireSync<S extends z.ZodType>(schema: S, value: z.output<S>, opts: SerializeOptions): unknown {
    const strategy = opts.strategy ?? "encode";
    if (strategy === "none") return value;
    try {
        return strategy === "encode" ? z.encode(schema, value) : schema.parse(value);
    } catch (cause) {
        throw wireError(cause, strategy, opts);
    }
}

export async function toWireAsync<S extends z.ZodType>(
    schema: S,
    value: z.output<S>,
    opts: SerializeOptions,
): Promise<unknown> {
    const strategy = opts.strategy ?? "encode";
    if (strategy === "none") return value;
    try {
        return strategy === "encode" ? await z.encodeAsync(schema, value) : await schema.parseAsync(value);
    } catch (cause) {
        throw wireError(cause, strategy, opts);
    }
}

function sortKeysDeep(v: unknown, compare?: (a: string, b: string) => number): unknown {
    if (Array.isArray(v)) return v.map((x) => sortKeysDeep(x, compare));
    if (isPlainObject(v)) {
        return Object.fromEntries(
            Object.keys(v)
                .sort(compare)
                .map((k) => [k, sortKeysDeep(v[k], compare)]),
        );
    }
    return v;
}

export function render(data: unknown, opts: SerializeOptions): string {
    const input = opts.sortKeys
        ? sortKeysDeep(data, typeof opts.sortKeys === "function" ? opts.sortKeys : undefined)
        : data;
    const indent = opts.indent ?? 2;
    const trailingNewline = opts.trailingNewline !== false;

    try {
        if (opts.format === "json") {
            const out = JSON.stringify(input, opts.json?.replacer, indent);
            if (out === undefined) throw new Error("value is not JSON-serializable");
            return trailingNewline ? `${out}\n` : out;
        }

        const doc = new YAML.Document(input, opts.yaml?.document);
        if (opts.yaml?.comment) {
            doc.commentBefore = opts.yaml.comment
                .split("\n")
                .map((line) => (line ? ` ${line}` : line))
                .join("\n");
        }
        const out = doc.toString({indent, ...opts.yaml?.stringify});
        return trailingNewline ? out : out.replace(/\n$/, "");
    } catch (cause) {
        throw new SchemaFileError(
            "serialize",
            `Failed to serialize ${label(opts.filePath)} as ${opts.format.toUpperCase()}: ${errMsg(cause)}`,
            {filePath: opts.filePath, cause},
        );
    }
}

function tempPathFor(filePath: string): string {
    const rand = Math.random().toString(36).slice(2, 10);
    return path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${rand}.tmp`);
}

/**
 * The rename in an atomic write replaces whatever sits at the path, so it has to target the file a
 * symlink points at (even one that does not exist yet), or the link itself gets replaced.
 */
async function atomicTargetAsync(filePath: string): Promise<string> {
    try {
        return await realpath(filePath);
    } catch {
        return readlink(filePath).then((link) => path.resolve(path.dirname(filePath), link), () => filePath);
    }
}

function atomicTargetSync(filePath: string): string {
    try {
        return realpathSync(filePath);
    } catch {
        try {
            return path.resolve(path.dirname(filePath), readlinkSync(filePath));
        } catch {
            return filePath;
        }
    }
}

/** The rename also swaps in a new file, so an explicit `mode` aside, keep the replaced file's permissions. */
async function preservedModeAsync(target: string, opts: SaveOptions): Promise<number | undefined> {
    if (opts.mode !== undefined) return undefined;
    return stat(target).then((stats) => stats.mode & 0o777, () => undefined);
}

function preservedModeSync(target: string, opts: SaveOptions): number | undefined {
    if (opts.mode !== undefined) return undefined;
    try {
        return statSync(target).mode & 0o777;
    } catch {
        return undefined;
    }
}

export async function writeTextAsync(filePath: string, text: string, opts: SaveOptions): Promise<void> {
    try {
        if (opts.createDirs !== false) await mkdir(path.dirname(filePath), {recursive: true});
        if (opts.overwrite === false && (await access(filePath).then(() => true, () => false))) {
            throw new SchemaFileError("write", `Refusing to overwrite existing file ${filePath}`, {filePath});
        }
        const base = {encoding: opts.encoding ?? "utf8", mode: opts.mode} as const;
        if (opts.atomic === false) {
            await writeFile(filePath, text, {...base, flag: opts.overwrite === false ? "wx" : "w"});
            return;
        }
        const target = await atomicTargetAsync(filePath);
        const preserved = await preservedModeAsync(target, opts);
        const tmp = tempPathFor(target);
        try {
            await writeFile(tmp, text, {...base, flag: "wx"});
            if (preserved !== undefined) await chmod(tmp, preserved);
            await rename(tmp, target);
        } catch (e) {
            await unlink(tmp).catch(() => {
            });
            throw e;
        }
    } catch (cause) {
        if (cause instanceof SchemaFileError) throw cause;
        throw new SchemaFileError("write", `Failed to write ${filePath}: ${errMsg(cause)}`, {filePath, cause});
    }
}

export function writeTextSync(filePath: string, text: string, opts: SaveOptions): void {
    try {
        if (opts.createDirs !== false) mkdirSync(path.dirname(filePath), {recursive: true});
        if (opts.overwrite === false && existsSync(filePath)) {
            throw new SchemaFileError("write", `Refusing to overwrite existing file ${filePath}`, {filePath});
        }
        const base = {encoding: opts.encoding ?? "utf8", mode: opts.mode} as const;
        if (opts.atomic === false) {
            writeFileSync(filePath, text, {...base, flag: opts.overwrite === false ? "wx" : "w"});
            return;
        }
        const target = atomicTargetSync(filePath);
        const preserved = preservedModeSync(target, opts);
        const tmp = tempPathFor(target);
        try {
            writeFileSync(tmp, text, {...base, flag: "wx"});
            if (preserved !== undefined) chmodSync(tmp, preserved);
            renameSync(tmp, target);
        } catch (e) {
            try {
                unlinkSync(tmp);
            } catch {
                /* ignore */
            }
            throw e;
        }
    } catch (cause) {
        if (cause instanceof SchemaFileError) throw cause;
        throw new SchemaFileError("write", `Failed to write ${filePath}: ${errMsg(cause)}`, {filePath, cause});
    }
}