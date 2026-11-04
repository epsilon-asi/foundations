import * as z from "zod";
import {
    createSchemaFile,
    interpolateEnv,
    interpolateEnvHook,
    loadFile,
    loadFileSync,
    parseString,
    parseStringSync,
    safeLoadFile,
    safeLoadFileSync,
    saveFile,
    saveFileSync,
    SchemaFileError,
    serialize,
    serializeAsync,
} from "../../index";
import type {
    ErrorFormatter,
    FileFormat,
    LoadOptions,
    ParseOptions,
    PreprocessContext,
    SafeResult,
    SaveOptions,
    SchemaFileErrorKind,
    SerializeOptions,
    SerializeStrategy,
} from "../../index";
import * as root from "../../../index";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;

const isoDate = z.codec(z.iso.datetime(), z.date(), {
    decode: (text) => new Date(text),
    encode: (date) => date.toISOString(),
});

const AppConfig = z.object({name: z.string(), port: z.number().default(3000), at: isoDate});
type AppOutput = z.output<typeof AppConfig>;
type _shape = Expect<Same<AppOutput, {name: string; port: number; at: Date}>>;

const value: AppOutput = {name: "api", port: 1, at: new Date()};

// --- loading and parsing resolve to the schema output ---

export async function loading() {
    const loaded = await loadFile("app.yaml", AppConfig);
    const loadedSync = loadFileSync("app.yaml", AppConfig);
    const parsed = await parseString(AppConfig, "name: api");
    const parsedSync = parseStringSync(AppConfig, "name: api");

    type _loaded = Expect<Equal<typeof loaded, AppOutput>>;
    type _loadedSync = Expect<Equal<typeof loadedSync, AppOutput>>;
    type _parsed = Expect<Equal<typeof parsed, AppOutput>>;
    type _parsedSync = Expect<Equal<typeof parsedSync, AppOutput>>;

    const result = await safeLoadFile("app.yaml", AppConfig);
    if (result.success) {
        type _data = Expect<Equal<typeof result.data, AppOutput>>;
    } else {
        type _error = Expect<Equal<typeof result.error, SchemaFileError>>;
    }

    const syncResult = safeLoadFileSync("app.yaml", AppConfig);
    // @ts-expect-error data only exists on the success branch
    syncResult.data;

    loadFileSync("app", AppConfig, {format: "auto", allowMissing: true, missingValue: {}, encoding: "utf8"});
    // @ts-expect-error unsupported format
    loadFileSync("app.toml", AppConfig, {format: "toml"});
}

// --- saving and serializing take the schema output ---

export async function saving() {
    const text: string = await saveFile("app.json", AppConfig, value);
    const textSync: string = saveFileSync("app.json", AppConfig, value, {format: "auto", mode: 0o600});
    void [text, textSync];

    // @ts-expect-error the codec field takes the output type (Date), not the stored string
    saveFileSync("app.json", AppConfig, {...value, at: "2026-01-01T00:00:00.000Z"});

    // @ts-expect-error defaults fill input, but the output type still requires the field
    saveFileSync("app.json", AppConfig, {name: "api", at: new Date()});

    // @ts-expect-error unsupported format
    saveFileSync("app.toml", AppConfig, value, {format: "toml"});

    // @ts-expect-error unknown strategy
    saveFileSync("app.json", AppConfig, value, {strategy: "lossy"});

    serialize(AppConfig, value, {format: "yaml", strategy: "parse", sortKeys: true});
    await serializeAsync(AppConfig, value, {format: "json", sortKeys: (a, b) => a.localeCompare(b)});

    // @ts-expect-error serialize needs an explicit format
    serialize(AppConfig, value, {});

    // @ts-expect-error "auto" needs a path, so serialize does not accept it
    serialize(AppConfig, value, {format: "auto"});
}

// --- createSchemaFile keeps the bound schema's types ---

export async function bound() {
    const app = createSchemaFile(AppConfig, {load: {allowMissing: true}, save: {indent: 4}});

    type _schema = Expect<Equal<typeof app.schema, typeof AppConfig>>;

    const loaded = await app.load("app.yaml");
    const parsed = await app.parse("name: api");
    type _loaded = Expect<Equal<typeof loaded, AppOutput>>;
    type _parsed = Expect<Equal<typeof parsed, AppOutput>>;

    await app.save("app.yaml", value);
    // @ts-expect-error values are checked against the bound schema
    app.saveSync("app.yaml", {...value, port: "1"});

    await app.serialize(value, {format: "json"});
    // @ts-expect-error serialize needs an explicit format
    await app.serialize(value, {});
}

// --- interpolateEnv returns unknown data for the schema to validate ---

const interpolated = interpolateEnv({host: "${HOST}"}, {HOST: "db"});
type _interpolated = Expect<Equal<typeof interpolated, unknown>>;

loadFileSync("db.yaml", AppConfig, {preprocess: interpolateEnvHook()});
loadFileSync("db.yaml", AppConfig, {preprocess: interpolateEnvHook({HOST: "db"}, {strict: true})});
// @ts-expect-error a hook's second argument is the PreprocessContext, not an env; use interpolateEnvHook()
loadFileSync("db.yaml", AppConfig, {preprocess: interpolateEnv});

// --- yaml options can be passed on their own ---

serialize(AppConfig, value, {format: "yaml", yaml: {comment: "header"}});
serialize(AppConfig, value, {format: "yaml", yaml: {document: {aliasDuplicateObjects: false}}});
serialize(AppConfig, value, {format: "yaml", yaml: {stringify: {lineWidth: 0}}});
// @ts-expect-error the doc.toString options are named stringify
serialize(AppConfig, value, {format: "yaml", yaml: {toString: {lineWidth: 0}}});

// --- the error class and option types are public from the module, but not from the package root ---

// @ts-expect-error the files module is only exported from @epsilon-asi/foundation/files
root.SchemaFileError;
// @ts-expect-error the files module is only exported from @epsilon-asi/foundation/files
type _rootLoad = root.LoadOptions;

const kinds: SchemaFileErrorKind[] = ["format", "read", "parse", "preprocess", "validate", "encode", "serialize", "write"];
const formats: FileFormat[] = ["json", "yaml"];
const strategies: SerializeStrategy[] = ["encode", "parse", "none"];
const parseOptions: ParseOptions = {format: "auto", filePath: "app.yaml"};
const saveOptions: SaveOptions = {format: "auto", atomic: true};
const serializeOptions: SerializeOptions = {format: "json"};
const formatter: ErrorFormatter = (error) => error.message;
const context: PreprocessContext = {format: "yaml"};
const result: SafeResult<number> = {success: false, error: new SchemaFileError("read", "missing")};
void [kinds, formats, strategies, parseOptions, saveOptions, serializeOptions, formatter, context, result];
