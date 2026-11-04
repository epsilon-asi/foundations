import * as z from "zod";
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {loadFile, loadFileSync, safeLoadFile, safeLoadFileSync, SchemaFileError} from "../index";

const AppConfig = z.object({
    name: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    tags: z.array(z.string()).default([]),
    debug: z.boolean().optional(),
});

let dir: string;

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "schema-file-load-"));
});

afterEach(() => {
    rmSync(dir, {recursive: true, force: true});
});

function file(name: string, contents: string): string {
    const filePath = join(dir, name);
    writeFileSync(filePath, contents);
    return filePath;
}

function caught(run: () => unknown): SchemaFileError {
    try {
        run();
    } catch (error) {
        return error as SchemaFileError;
    }
    throw new Error("Expected the call to throw.");
}

async function rejected(promise: Promise<unknown>): Promise<SchemaFileError> {
    try {
        await promise;
    } catch (error) {
        return error as SchemaFileError;
    }
    throw new Error("Expected the promise to reject.");
}

describe("loadFile / loadFileSync", () => {
    describe("formats", () => {
        test("loads YAML and applies schema defaults", async () => {
            const filePath = file("app.yaml", "name: api\nport: 8080\n");

            expect(await loadFile(filePath, AppConfig)).toEqual({name: "api", port: 8080, tags: []});
            expect(loadFileSync(filePath, AppConfig)).toEqual({name: "api", port: 8080, tags: []});
        });

        test("loads JSON and .yml files by extension", async () => {
            const json = file("app.json", '{ "name": "api", "port": 80, "debug": true }');
            const yml = file("app.yml", "name: api\nport: 81\ntags: [a, b]\n");

            expect(await loadFile(json, AppConfig)).toEqual({name: "api", port: 80, tags: [], debug: true});
            expect(loadFileSync(yml, AppConfig)).toEqual({name: "api", port: 81, tags: ["a", "b"]});
        });

        test("matches extensions case-insensitively", () => {
            const filePath = file("APP.JSON", '{ "name": "api", "port": 1 }');

            // Parsed as JSON, so YAML-only syntax would fail; this proves the extension was honored.
            expect(loadFileSync(filePath, AppConfig)).toEqual({name: "api", port: 1, tags: []});
        });

        test("an explicit format overrides the extension", () => {
            const filePath = file("app.json", "name: api\nport: 1\n");

            expect(caught(() => loadFileSync(filePath, AppConfig))).toMatchObject({kind: "parse"});
            expect(loadFileSync(filePath, AppConfig, {format: "yaml"})).toEqual({name: "api", port: 1, tags: []});
        });

        test("falls back to YAML for unknown extensions, which also reads JSON", () => {
            const yaml = file("app.conf", "name: api\nport: 1\n");
            const json = file("app", '{ "name": "api", "port": 2 }');

            expect(loadFileSync(yaml, AppConfig, {format: "auto"})).toEqual({name: "api", port: 1, tags: []});
            expect(loadFileSync(json, AppConfig)).toEqual({name: "api", port: 2, tags: []});
        });

        test("uses the YAML 1.2 core schema, so yes/no stay strings", () => {
            const filePath = file("flags.yaml", "answer: yes\n");

            expect(loadFileSync(filePath, z.object({answer: z.string()}))).toEqual({answer: "yes"});
        });

        test("forwards yaml options to YAML.parse", () => {
            const filePath = file("flags.yaml", "flag: yes\n");
            const schema = z.object({flag: z.boolean()});

            expect(caught(() => loadFileSync(filePath, schema))).toMatchObject({kind: "validate"});
            expect(loadFileSync(filePath, schema, {yaml: {version: "1.1"}})).toEqual({flag: true});
        });

        test("forwards json.reviver to JSON.parse", () => {
            const filePath = file("app.json", '{ "name": "api", "port": "8080" }');

            const config = loadFileSync(filePath, AppConfig, {
                json: {reviver: (key, value) => (key === "port" ? Number(value) : value)},
            });

            expect(config.port).toBe(8080);
        });

        test("reads files in the given encoding", () => {
            const filePath = join(dir, "app.json");
            writeFileSync(filePath, Buffer.from('{ "name": "ünï", "port": 1 }', "utf16le"));

            expect(loadFileSync(filePath, AppConfig, {encoding: "utf16le"}).name).toBe("ünï");
        });
    });

    describe("content edge cases", () => {
        test("strips a leading byte order mark by default", () => {
            const filePath = file("app.json", '﻿{ "name": "api", "port": 1 }');

            expect(loadFileSync(filePath, AppConfig)).toEqual({name: "api", port: 1, tags: []});
            expect(caught(() => loadFileSync(filePath, AppConfig, {stripBom: false}))).toMatchObject({
                kind: "parse",
            });
        });

        test("hands emptyValue to the schema for empty or whitespace-only files", () => {
            const filePath = file("app.yaml", "  \n\t\n");
            const withDefaults = z.object({port: z.number().default(3000)});

            expect(caught(() => loadFileSync(filePath, withDefaults))).toMatchObject({kind: "validate"});
            expect(loadFileSync(filePath, withDefaults, {emptyValue: {}})).toEqual({port: 3000});
            expect(loadFileSync(file("empty.json", ""), withDefaults, {emptyValue: {}})).toEqual({port: 3000});
        });

        test("rejects YAML with duplicate keys unless uniqueKeys is off", () => {
            const filePath = file("dupes.yaml", "name: a\nname: b\nport: 1\n");

            expect(caught(() => loadFileSync(filePath, AppConfig))).toMatchObject({kind: "parse"});
            expect(loadFileSync(filePath, AppConfig, {yaml: {uniqueKeys: false}}).name).toBe("b");
        });

        test("rejects YAML with more than one document", () => {
            const filePath = file("multi.yaml", "name: a\nport: 1\n---\nname: b\n");

            expect(caught(() => loadFileSync(filePath, AppConfig))).toMatchObject({kind: "parse"});
        });
    });

    describe("errors", () => {
        test("reports schema mismatches as validate errors with the zod issues", async () => {
            const filePath = file("app.yaml", 'name: ""\nport: 70000\n');

            const error = await rejected(loadFile(filePath, AppConfig));

            expect(error).toBeInstanceOf(SchemaFileError);
            expect(error).toMatchObject({name: "SchemaFileError", kind: "validate", filePath});
            expect(error.message).toMatch(new RegExp(`^Validation failed for ${filePath}:\n`));
            expect(error.message).toContain("→ at name");
            expect(error.message).toContain("→ at port");
            expect(error.issues?.map((issue) => issue.path)).toEqual([["name"], ["port"]]);
            expect(error.cause).toBeInstanceOf(z.ZodError);
        });

        test("reports malformed JSON and YAML as parse errors", () => {
            const json = file("app.json", '{ "name": ');
            const yaml = file("app.yaml", "name: [unclosed\n");

            const jsonError = caught(() => loadFileSync(json, AppConfig));
            expect(jsonError).toMatchObject({kind: "parse", filePath: json});
            expect(jsonError.message).toMatch(new RegExp(`^Failed to parse ${json} as JSON: `));
            expect(jsonError.cause).toBeInstanceOf(SyntaxError);

            const yamlError = caught(() => loadFileSync(yaml, AppConfig));
            expect(yamlError).toMatchObject({kind: "parse", filePath: yaml});
            expect(yamlError.message).toMatch(new RegExp(`^Failed to parse ${yaml} as YAML: `));
        });

        test("reports a missing file as a read error carrying the fs error", async () => {
            const filePath = join(dir, "missing.yaml");

            const error = await rejected(loadFile(filePath, AppConfig));
            expect(error).toMatchObject({kind: "read", filePath});
            expect(error.message).toMatch(new RegExp(`^Failed to read ${filePath}: `));
            expect(error.message).toContain("ENOENT");
            expect(error.cause).toMatchObject({code: "ENOENT"});

            expect(caught(() => loadFileSync(filePath, AppConfig))).toMatchObject({kind: "read"});
        });

        test("reports other fs failures as read errors", async () => {
            const filePath = join(dir, "folder.yaml");
            mkdirSync(filePath);

            expect(await rejected(loadFile(filePath, AppConfig))).toMatchObject({kind: "read"});
            expect(caught(() => loadFileSync(filePath, AppConfig))).toMatchObject({kind: "read"});
        });

        test("forwards parseParams to safeParse", () => {
            const filePath = file("app.yaml", "port: 1\n");

            const error = caught(() =>
                loadFileSync(filePath, AppConfig, {parseParams: {error: () => "must be configured"}}),
            );

            expect(error.issues?.[0].message).toBe("must be configured");
            expect(error.message).toContain("✖ must be configured");
        });

        test("uses formatError for the message but keeps the raw issues", () => {
            const filePath = file("app.yaml", "port: 1\n");

            const error = caught(() =>
                loadFileSync(filePath, AppConfig, {formatError: (zodError) => `${zodError.issues.length} problem(s)`}),
            );

            expect(error.message).toBe(`Validation failed for ${filePath}:\n1 problem(s)`);
            expect(error.issues).toHaveLength(1);
        });

        test("async refinements need the async API", async () => {
            const filePath = file("app.yaml", "name: api\n");
            const schema = z.object({name: z.string().refine(async (value) => value === "api")});

            expect(await loadFile(filePath, schema)).toEqual({name: "api"});

            const error = caught(() => loadFileSync(filePath, schema));
            expect(error).toMatchObject({kind: "validate"});
            expect(error.message).toMatch(new RegExp(`^Synchronous validation failed for ${filePath}: `));
            expect(error.message).toMatch(/\(try the async API\)$/);
        });
    });

    describe("allowMissing", () => {
        const WithDefaults = z.object({port: z.number().default(3000), host: z.string().default("localhost")});

        test("validates {} when the file is missing, so schema defaults apply", async () => {
            const filePath = join(dir, "missing.json");

            expect(await loadFile(filePath, WithDefaults, {allowMissing: true})).toEqual({
                port: 3000,
                host: "localhost",
            });
            expect(loadFileSync(filePath, WithDefaults, {allowMissing: true})).toEqual({
                port: 3000,
                host: "localhost",
            });
        });

        test("validates missingValue instead when one is given", () => {
            const filePath = join(dir, "missing.json");

            expect(loadFileSync(filePath, WithDefaults, {allowMissing: true, missingValue: {port: 1}})).toEqual({
                port: 1,
                host: "localhost",
            });
            expect(
                caught(() => loadFileSync(filePath, WithDefaults, {allowMissing: true, missingValue: {port: "x"}})),
            ).toMatchObject({kind: "validate"});
        });

        test("still validates the file when it exists", () => {
            const filePath = file("app.json", '{ "port": 8080 }');

            expect(loadFileSync(filePath, WithDefaults, {allowMissing: true})).toEqual({
                port: 8080,
                host: "localhost",
            });
        });

        test("does not swallow read errors other than ENOENT", async () => {
            const filePath = join(dir, "folder.json");
            mkdirSync(filePath);

            expect(await rejected(loadFile(filePath, WithDefaults, {allowMissing: true}))).toMatchObject({
                kind: "read",
            });
            expect(caught(() => loadFileSync(filePath, WithDefaults, {allowMissing: true}))).toMatchObject({
                kind: "read",
            });
        });

        test("runs preprocess on the missing value with the format from the extension", () => {
            const filePath = join(dir, "missing.json");
            const preprocess = jest.fn((raw: unknown) => ({...(raw as object), port: 9}));

            expect(loadFileSync(filePath, WithDefaults, {allowMissing: true, preprocess})).toEqual({
                port: 9,
                host: "localhost",
            });
            expect(preprocess).toHaveBeenCalledWith({}, {format: "json", filePath});
        });
    });

    describe("preprocess", () => {
        test("receives the parsed data and context, and its result is validated", async () => {
            const filePath = file("app.yaml", "name: api\nport: 1\n");
            const preprocess = jest.fn((raw: unknown) => ({...(raw as object), port: 2}));

            expect(await loadFile(filePath, AppConfig, {preprocess})).toEqual({name: "api", port: 2, tags: []});
            expect(preprocess).toHaveBeenCalledWith({name: "api", port: 1}, {format: "yaml", filePath});
        });

        test("may be async with the async API", async () => {
            const filePath = file("app.yaml", "name: api\nport: 1\n");

            const config = await loadFile(filePath, AppConfig, {
                preprocess: async (raw) => ({...(raw as object), name: "async"}),
            });

            expect(config.name).toBe("async");
        });

        test("rejects an async preprocess with the sync API", () => {
            const filePath = file("app.yaml", "name: api\nport: 1\n");

            const error = caught(() => loadFileSync(filePath, AppConfig, {preprocess: async (raw) => raw}));

            expect(error).toMatchObject({
                kind: "preprocess",
                filePath,
                message: "preprocess returned a Promise; use the async API instead",
            });
        });

        test("handles the rejection of an async preprocess the sync API refuses", () => {
            const filePath = file("app.yaml", "name: api\nport: 1\n");
            const pending = Promise.reject(new Error("boom"));
            // Jest swallows unhandledRejection events, so check that a rejection handler gets attached.
            const then = jest.spyOn(pending, "then");

            const error = caught(() => loadFileSync(filePath, AppConfig, {preprocess: () => pending}));

            expect(error).toMatchObject({kind: "preprocess"});
            expect(then).toHaveBeenCalledWith(undefined, expect.any(Function));
        });

        test("wraps errors thrown by preprocess", async () => {
            const filePath = file("app.yaml", "name: api\nport: 1\n");
            const boom = new Error("boom");
            const preprocess = () => {
                throw boom;
            };

            const asyncError = await rejected(loadFile(filePath, AppConfig, {preprocess}));
            expect(asyncError).toMatchObject({
                kind: "preprocess",
                filePath,
                message: `Preprocess failed for ${filePath}: boom`,
            });
            expect(asyncError.cause).toBe(boom);

            const rejectingAsync = await rejected(
                loadFile(filePath, AppConfig, {preprocess: async () => Promise.reject(boom)}),
            );
            expect(rejectingAsync).toMatchObject({kind: "preprocess", cause: boom});

            expect(caught(() => loadFileSync(filePath, AppConfig, {preprocess}))).toMatchObject({
                kind: "preprocess",
                cause: boom,
            });
        });
    });
});

describe("safeLoadFile / safeLoadFileSync", () => {
    test("return the data on success", async () => {
        const filePath = file("app.yaml", "name: api\nport: 1\n");

        expect(await safeLoadFile(filePath, AppConfig)).toEqual({
            success: true,
            data: {name: "api", port: 1, tags: []},
        });
        expect(safeLoadFileSync(filePath, AppConfig)).toEqual({
            success: true,
            data: {name: "api", port: 1, tags: []},
        });
    });

    test("return SchemaFileErrors instead of throwing them", async () => {
        const invalid = file("app.yaml", "name: api\n");
        const missing = join(dir, "missing.yaml");

        const asyncResult = await safeLoadFile(invalid, AppConfig);
        expect(asyncResult.success).toBe(false);
        expect(!asyncResult.success && asyncResult.error).toBeInstanceOf(SchemaFileError);
        expect(!asyncResult.success && asyncResult.error.kind).toBe("validate");

        const syncResult = safeLoadFileSync(missing, AppConfig);
        expect(!syncResult.success && syncResult.error.kind).toBe("read");
    });

    test("rethrow errors that are not SchemaFileErrors", async () => {
        const filePath = file("app.yaml", "name: api\n");
        const failure = new Error("formatter broke");
        const formatError = () => {
            throw failure;
        };

        await expect(safeLoadFile(filePath, AppConfig, {formatError})).rejects.toBe(failure);
        expect(() => safeLoadFileSync(filePath, AppConfig, {formatError})).toThrow(failure);
    });
});
