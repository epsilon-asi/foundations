import * as z from "zod";
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createSchemaFile, interpolateEnv, interpolateEnvHook, loadFile, loadFileSync, SchemaFileError} from "../index";

function caught(run: () => unknown): SchemaFileError {
    try {
        run();
    } catch (error) {
        return error as SchemaFileError;
    }
    throw new Error("Expected the call to throw.");
}

const AppConfig = z.object({name: z.string(), port: z.number().default(3000)});

let dir: string;

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "schema-file-init-"));
});

afterEach(() => {
    rmSync(dir, {recursive: true, force: true});
});

describe("createSchemaFile", () => {
    test("binds the schema to every operation", async () => {
        const config = createSchemaFile(AppConfig);
        const filePath = join(dir, "app.yaml");

        expect(config.schema).toBe(AppConfig);

        expect(await config.save(filePath, {name: "api", port: 1})).toBe("name: api\nport: 1\n");
        expect(await config.load(filePath)).toEqual({name: "api", port: 1});
        expect(config.loadSync(filePath)).toEqual({name: "api", port: 1});
        expect(await config.safeLoad(filePath)).toEqual({success: true, data: {name: "api", port: 1}});
        expect(config.safeLoadSync(filePath)).toEqual({success: true, data: {name: "api", port: 1}});

        expect(config.saveSync(join(dir, "app.json"), {name: "sync", port: 2})).toBe(
            `${JSON.stringify({name: "sync", port: 2}, null, 2)}\n`,
        );
        expect(await config.parse("name: parsed\n")).toEqual({name: "parsed", port: 3000});
        expect(await config.serialize({name: "api", port: 1}, {format: "json", indent: 0})).toBe(
            '{"name":"api","port":1}\n',
        );
    });

    test("applies default load options, with per-call options taking precedence", async () => {
        const config = createSchemaFile(AppConfig, {load: {allowMissing: true, missingValue: {name: "fallback"}}});
        const missing = join(dir, "missing.yaml");

        expect(await config.load(missing)).toEqual({name: "fallback", port: 3000});
        expect(config.loadSync(missing, {missingValue: {name: "override"}})).toEqual({name: "override", port: 3000});

        const strict = config.safeLoadSync(missing, {allowMissing: false});
        expect(!strict.success && strict.error).toBeInstanceOf(SchemaFileError);
        expect(!strict.success && strict.error.kind).toBe("read");

        const asyncStrict = await config.safeLoad(missing, {allowMissing: false});
        expect(!asyncStrict.success && asyncStrict.error.kind).toBe("read");
    });

    test("default load options apply to parse as well", async () => {
        const preprocess = (raw: unknown) => ({...(raw as object), name: "preprocessed"});
        const config = createSchemaFile(AppConfig, {load: {preprocess}});

        expect(await config.parse("name: raw\n")).toEqual({name: "preprocessed", port: 3000});
        expect(await config.parse("name: raw\n", {preprocess: undefined})).toEqual({name: "raw", port: 3000});
    });

    test("applies default save options, with per-call options taking precedence", async () => {
        const config = createSchemaFile(AppConfig, {save: {indent: 4, sortKeys: (a, b) => b.localeCompare(a)}});
        const filePath = join(dir, "app.json");

        expect(await config.save(filePath, {name: "api", port: 1})).toBe('{\n    "port": 1,\n    "name": "api"\n}\n');
        expect(config.saveSync(filePath, {name: "api", port: 1}, {indent: 0})).toBe('{"port":1,"name":"api"}\n');
        expect(readFileSync(filePath, "utf8")).toBe('{"port":1,"name":"api"}\n');
        expect(await config.serialize({name: "api", port: 1}, {format: "json", sortKeys: false})).toBe(
            '{\n    "name": "api",\n    "port": 1\n}\n',
        );
    });

    test("merges options shallowly, so a nested option object replaces the default one", async () => {
        const dropPort = (key: string, raw: unknown) => (key === "port" ? undefined : raw);
        const config = createSchemaFile(AppConfig, {save: {indent: 0, json: {replacer: dropPort}}});
        const filePath = join(dir, "app.json");

        expect(await config.save(filePath, {name: "api", port: 1})).toBe('{"name":"api"}\n');
        expect(await config.save(filePath, {name: "api", port: 1}, {json: {}})).toBe('{"name":"api","port":1}\n');
    });
});

describe("interpolateEnv", () => {
    const env = {HOST: "db.internal", PORT: "5432", EMPTY: ""};

    test("replaces ${VAR} references in strings", () => {
        expect(interpolateEnv("postgres://${HOST}:${PORT}/app", env)).toBe("postgres://db.internal:5432/app");
    });

    test("uses ${VAR:-fallback} when the variable is unset or empty", () => {
        expect(interpolateEnv("${MISSING:-localhost}", env)).toBe("localhost");
        expect(interpolateEnv("${EMPTY:-fallback}", env)).toBe("fallback");
        expect(interpolateEnv("${HOST:-localhost}", env)).toBe("db.internal");
        expect(interpolateEnv("[${MISSING:-}]", env)).toBe("[]");
    });

    test("replaces unset variables without a fallback with an empty string", () => {
        expect(interpolateEnv("[${MISSING}]", env)).toBe("[]");
        expect(interpolateEnv("[${EMPTY}]", env)).toBe("[]");
    });

    test("throws for unset variables without a fallback in strict mode", () => {
        expect(() => interpolateEnv("${MISSING}", env, {strict: true})).toThrow(
            'Environment variable "MISSING" is not set',
        );
        expect(() => interpolateEnv("${EMPTY}", env, {strict: true})).toThrow('Environment variable "EMPTY" is not set');
        expect(interpolateEnv("${MISSING:-ok}", env, {strict: true})).toBe("ok");
    });

    test("walks nested objects and arrays, leaving keys and non-string values alone", () => {
        const at = new Date(0);
        const input = {
            "${HOST}": "${HOST}",
            nested: {list: ["${PORT}", 1, true, null, {deep: "${HOST}"}]},
            at,
        };

        const result = interpolateEnv(input, env) as typeof input;

        expect(result).toEqual({
            "${HOST}": "db.internal",
            nested: {list: ["5432", 1, true, null, {deep: "db.internal"}]},
            at,
        });
        expect(result.at).toBe(at);
        expect(input.nested.list[0]).toBe("${PORT}");
    });

    test("leaves text that is not a ${NAME} reference untouched", () => {
        expect(interpolateEnv("$HOST ${1BAD} ${HOST-x} ${}", env)).toBe("$HOST ${1BAD} ${HOST-x} ${}");
    });

    test("reads process.env by default", () => {
        process.env.SCHEMA_FILE_TEST_VAR = "from-process";
        try {
            expect(interpolateEnv("${SCHEMA_FILE_TEST_VAR}")).toBe("from-process");
        } finally {
            delete process.env.SCHEMA_FILE_TEST_VAR;
        }
    });

    test("works as a preprocess step when loading", () => {
        const filePath = join(dir, "db.yaml");
        writeFileSync(filePath, 'host: ${HOST}\nport: ${PORT:-5432}\nurl: "${MISSING}"\n');
        const Db = z.object({host: z.string(), port: z.coerce.number(), url: z.string()});

        const db = loadFileSync(filePath, Db, {preprocess: (raw) => interpolateEnv(raw, {HOST: "db"})});

        expect(db).toEqual({host: "db", port: 5432, url: ""});
    });

    test("strict failures surface as preprocess errors when loading", () => {
        const filePath = join(dir, "db.yaml");
        writeFileSync(filePath, "host: ${HOST}\n");

        expect(() =>
            loadFileSync(filePath, z.object({host: z.string()}), {
                preprocess: (raw) => interpolateEnv(raw, {}, {strict: true}),
            }),
        ).toThrow(`Preprocess failed for ${filePath}: Environment variable "HOST" is not set`);
    });
});

describe("interpolateEnvHook", () => {
    const Db = z.object({host: z.string(), port: z.coerce.number()});

    test("interpolates loaded data from the given env", async () => {
        const filePath = join(dir, "db.yaml");
        writeFileSync(filePath, "host: ${HOST}\nport: ${PORT:-5432}\n");

        const preprocess = interpolateEnvHook({HOST: "db"});

        expect(loadFileSync(filePath, Db, {preprocess})).toEqual({host: "db", port: 5432});
        expect(await loadFile(filePath, Db, {preprocess: interpolateEnvHook({HOST: "db", PORT: "1"})})).toEqual({
            host: "db",
            port: 1,
        });
    });

    test("reads process.env by default and ignores the preprocess context", () => {
        const filePath = join(dir, "db.yaml");
        writeFileSync(filePath, "host: ${SCHEMA_FILE_TEST_HOST}\nport: 1\n");
        process.env.SCHEMA_FILE_TEST_HOST = "from-process";
        try {
            expect(loadFileSync(filePath, Db, {preprocess: interpolateEnvHook()})).toEqual({
                host: "from-process",
                port: 1,
            });
        } finally {
            delete process.env.SCHEMA_FILE_TEST_HOST;
        }
    });

    test("passes strict through", () => {
        const filePath = join(dir, "db.yaml");
        writeFileSync(filePath, "host: ${HOST}\nport: 1\n");

        expect(caught(() => loadFileSync(filePath, Db, {preprocess: interpolateEnvHook({}, {strict: true})}))).toMatchObject({
            kind: "preprocess",
            message: `Preprocess failed for ${filePath}: Environment variable "HOST" is not set`,
        });
    });

    test("works as a createSchemaFile default", async () => {
        const db = createSchemaFile(Db, {load: {preprocess: interpolateEnvHook({HOST: "db"})}});

        expect(await db.parse("host: ${HOST}\nport: 2\n")).toEqual({host: "db", port: 2});
    });
});
