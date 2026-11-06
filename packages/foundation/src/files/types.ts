import * as z from "zod";
import * as YAML from "yaml";

export type FileFormat = "json" | "yaml";
export type ParseParams = Parameters<z.ZodType["safeParse"]>[1];
export type ErrorFormatter = (error: z.core.$ZodError) => string;
export type SchemaFileErrorKind =
    | "format" // could not determine json/yaml
    | "read" // filesystem read failed
    | "parse" // syntax error in JSON/YAML
    | "preprocess" // user preprocess hook threw
    | "validate" // schema validation failed while loading (or strategy "parse" on save)
    | "encode" // schema encoding failed while saving
    | "serialize" // JSON/YAML stringify failed
    | "write"; // filesystem write failed
export class SchemaFileError extends Error {
    readonly kind: SchemaFileErrorKind;
    readonly filePath?: string;
    /** Present for "validate" / "encode" errors that came from Zod. */
    readonly issues?: z.core.$ZodIssue[];

    constructor(
        kind: SchemaFileErrorKind,
        message: string,
        details: { filePath?: string; issues?: z.core.$ZodIssue[]; cause?: unknown } = {},
    ) {
        super(message, {cause: details.cause});
        this.name = "SchemaFileError";
        this.kind = kind;
        this.filePath = details.filePath;
        this.issues = details.issues;
    }
}

export type SafeResult<T> =
    | { success: true; data: T }
    | { success: false; error: SchemaFileError };

export interface PreprocessContext {
    format: FileFormat;
    filePath?: string;
}

export interface ParseOptions {
    /** Force a format. "auto" (default) uses the file extension, then sniffs content. */
    format?: FileFormat | "auto";
    /** Only used for error messages and extension-based format detection. */
    filePath?: string;
    /** Strip a leading UTF-8 BOM. Default: true. */
    stripBom?: boolean;
    /** Value handed to the schema when the content is empty/whitespace. Default: undefined. */
    emptyValue?: unknown;
    /** Hook to transform raw parsed data before validation (env interpolation, migrations, ...). */
    preprocess?: (raw: unknown, ctx: PreprocessContext) => unknown | Promise<unknown>;
    /** Extra params forwarded to schema.safeParse (e.g. custom error map). */
    parseParams?: ParseParams;
    /** Customize the human-readable validation message. Default: z.prettifyError. */
    formatError?: ErrorFormatter;
    json?: {
        reviver?: (this: unknown, key: string, value: unknown) => unknown;
    };
    /** Passed straight to YAML.parse (uniqueKeys, maxAliasCount, merge, version, strict, ...). */
    yaml?: YAML.ParseOptions & YAML.DocumentOptions & YAML.SchemaOptions & YAML.ToJSOptions;
}

export interface LoadOptions extends ParseOptions {
    encoding?: BufferEncoding;
    /** If the file does not exist, validate `missingValue` instead of throwing. Default: false. */
    allowMissing?: boolean;
    /** Input used when the file is missing and allowMissing is true. Default: {} (so schema defaults apply). */
    missingValue?: unknown;
}

/**
 * How the in-memory (output-typed) value is turned back into plain data:
 *  - "encode": z.encode(schema, value). Runs codecs in reverse (e.g. Date -> ISO string)
 *              and validates. Throws on one-way .transform(). Default.
 *  - "parse":  schema.parse(value). Validates and writes the *output* shape. Use for schemas
 *              with one-way transforms whose output is still valid input.
 *  - "none":   write the value as-is with no validation.
 */
export type SerializeStrategy = "encode" | "parse" | "none";

export interface SerializeOptions {
    format: FileFormat;
    strategy?: SerializeStrategy;
    /** Spaces of indentation. Default: 2. */
    indent?: number;
    /** Deterministic output: sort object keys recursively (true = default string order). */
    sortKeys?: boolean | ((a: string, b: string) => number);
    /** Ensure output ends with a newline. Default: true. */
    trailingNewline?: boolean;
    /** Customize the human-readable validation message. Default: z.prettifyError. */
    formatError?: ErrorFormatter;
    /** Only used for error messages. */
    filePath?: string;
    json?: {
        replacer?: (this: unknown, key: string, value: unknown) => unknown;
    };
    yaml?: {
        /** Options for new YAML.Document(...) (version, schema, aliasDuplicateObjects, keepUndefined, ...). */
        document?: YAML.DocumentOptions & YAML.SchemaOptions & YAML.CreateNodeOptions;
        /**
         * Options for doc.toString(...) (lineWidth, defaultStringType, flowCollectionPadding, ...).
         * Not named `toString`: every object literal inherits that, so TypeScript would reject any
         * `yaml` options that leave it out.
         */
        stringify?: YAML.ToStringOptions;
        /** Header comment written at the top of the file (multi-line allowed, no leading "#"). */
        comment?: string;
    };
}

export interface SaveOptions extends Omit<SerializeOptions, "format" | "filePath"> {
    /** "auto" (default) picks by extension: .json / .yaml / .yml. */
    format?: FileFormat | "auto";
    encoding?: BufferEncoding;
    /** Create parent directories. Default: true. */
    createDirs?: boolean;
    /** Write to a temp file then rename, so readers never see a half-written file. Default: true. */
    atomic?: boolean;
    /** Allow replacing an existing file. Default: true. */
    overwrite?: boolean;
    /** File permission bits for the written file, e.g. 0o600 for secrets. */
    mode?: number;
}

/** Where a layer came from: an extra file, the start directory, one of its ancestors, or a fallback path. */
export type LayerOrigin = "extra" | "local" | "ancestor" | "fallback";

/** One file discovered by discoverLayers(). */
export interface FileLayer {
    /** Absolute path of the file. */
    filePath: string;
    origin: LayerOrigin;
}

export interface DiscoverOptions {
    /**
     * Additional files to layer in, ranked above everything discovered; index 0 has the highest
     * precedence. Relative paths resolve against `startDir`, and `~/` is expanded. They are always
     * included, so loading a missing one fails with a "read" error unless `allowMissing` is set.
     */
    extraFiles?: readonly string[];
    /** Directory the upward walk starts from. Default: process.cwd(). */
    startDir?: string;
    /** Last directory the walk visits (inclusive). Default: the filesystem root. */
    stopDir?: string;
    /** Paths checked after the walk, in order; they rank below every directory match. `~/` is expanded. */
    fallbacks?: readonly string[];
}

/** Options for loadLayeredFile(): discovery, plus load options applied to every layer. */
export interface LayeredLoadOptions extends Omit<LoadOptions, "filePath">, DiscoverOptions {}

export interface LayeredResult<T> {
    /** The merged, validated value. */
    value: T;
    /** The layers that were merged, highest precedence first. */
    layers: FileLayer[];
}

export const EXTENSIONS: Record<string, FileFormat> = {
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
};

