import * as z from "zod";
import {EXTENSIONS, SchemaFileError} from "../types";
import os from "node:os";
import {join} from "node:path";
import {deepMerge, expandHome, formatFromExtension, isPlainObject, label, resolveFormat, safely, safelySync} from "../util";

describe("resolveFormat", () => {
    test("returns an explicit format as-is", () => {
        expect(resolveFormat("json", "app.yaml")).toBe("json");
        expect(resolveFormat("yaml", "app.json")).toBe("yaml");
    });

    test("uses the extension for auto or no format", () => {
        expect(resolveFormat("auto", "app.json")).toBe("json");
        expect(resolveFormat(undefined, "dir/app.yml")).toBe("yaml");
        expect(resolveFormat(undefined, "APP.YAML")).toBe("yaml");
    });

    test("falls back to YAML when there is content to sniff", () => {
        expect(resolveFormat(undefined, "app.conf", "{}")).toBe("yaml");
        expect(resolveFormat("auto", undefined, "")).toBe("yaml");
    });

    test("throws a format error when nothing decides it", () => {
        let caught: unknown;
        try {
            resolveFormat("auto", "app.conf");
        } catch (error) {
            caught = error;
        }

        expect(caught).toBeInstanceOf(SchemaFileError);
        expect(caught).toMatchObject({
            kind: "format",
            filePath: "app.conf",
            message: 'Cannot determine format for app.conf; pass { format: "json" | "yaml" }',
        });
        expect(() => resolveFormat(undefined)).toThrow(
            'Cannot determine format for input; pass { format: "json" | "yaml" }',
        );
    });
});

describe("formatFromExtension", () => {
    test("maps every known extension", () => {
        for (const [extension, format] of Object.entries(EXTENSIONS)) {
            expect(formatFromExtension(`config${extension}`)).toBe(format);
        }
        expect(Object.keys(EXTENSIONS).sort()).toEqual([".json", ".yaml", ".yml"]);
    });

    test("returns undefined for other or missing extensions", () => {
        expect(formatFromExtension("config.toml")).toBeUndefined();
        expect(formatFromExtension("config")).toBeUndefined();
        expect(formatFromExtension(".json")).toBeUndefined();
    });
});

describe("isPlainObject", () => {
    test("accepts object literals and null-prototype objects", () => {
        expect(isPlainObject({})).toBe(true);
        expect(isPlainObject(Object.create(null))).toBe(true);
    });

    test("rejects everything else", () => {
        class Instance {}

        for (const value of [null, undefined, [], new Date(), new Map(), new Instance(), "x", 1, () => {}]) {
            expect(isPlainObject(value)).toBe(false);
        }
    });
});

describe("label", () => {
    test("names the file, or 'input' without one", () => {
        expect(label("app.yaml")).toBe("app.yaml");
        expect(label()).toBe("input");
    });
});

describe("SchemaFileError", () => {
    test("carries the kind, file path, issues and cause", () => {
        const cause = new z.ZodError([]);
        const issues = [{code: "custom", message: "bad", path: ["port"], input: 1}] as z.core.$ZodIssue[];

        const error = new SchemaFileError("validate", "Validation failed", {filePath: "app.yaml", issues, cause});

        expect(error).toBeInstanceOf(Error);
        expect(error).toMatchObject({
            name: "SchemaFileError",
            kind: "validate",
            message: "Validation failed",
            filePath: "app.yaml",
            issues,
        });
        expect(error.cause).toBe(cause);
    });

    test("details are optional", () => {
        const error = new SchemaFileError("format", "no format");

        expect(error.filePath).toBeUndefined();
        expect(error.issues).toBeUndefined();
        expect(error.cause).toBeUndefined();
    });
});

describe("deepMerge", () => {
    test("later sources win and nested objects merge key by key", () => {
        expect(deepMerge({a: 1, n: {x: 1, y: 1}}, {b: 2, n: {y: 2, z: 2}}, {a: 3})).toEqual({
            a: 3,
            b: 2,
            n: {x: 1, y: 2, z: 2},
        });
    });

    test("arrays and scalars replace rather than merge", () => {
        expect(deepMerge({list: [1, 2], n: {x: 1}}, {list: [3], n: "flat"})).toEqual({list: [3], n: "flat"});
        expect(deepMerge({n: "flat"}, {n: {x: 1}})).toEqual({n: {x: 1}});
    });

    test("skips undefined values and non-object sources", () => {
        expect(deepMerge({a: 1}, undefined, null, [1], "s", 4, {a: undefined, b: null})).toEqual({a: 1, b: null});
        expect(deepMerge()).toEqual({});
    });

    test("does not mutate its sources", () => {
        const low = {n: {x: 1}};
        const high = {n: {y: 2}};

        deepMerge(low, high);

        expect(low).toEqual({n: {x: 1}});
        expect(high).toEqual({n: {y: 2}});
    });

    test("keeps a parsed __proto__ key as data", () => {
        const merged = deepMerge<Record<string, unknown>>({}, JSON.parse('{"__proto__": {"polluted": true}}'));

        expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(Object.keys(merged)).toEqual(["__proto__"]);
    });
});

describe("expandHome", () => {
    test("expands a leading ~", () => {
        expect(expandHome("~")).toBe(os.homedir());
        expect(expandHome("~/a/b")).toBe(join(os.homedir(), "a/b"));
        expect(expandHome("~\\a")).toBe(join(os.homedir(), "a"));
    });

    test("leaves other paths alone", () => {
        expect(expandHome("/abs/~/x")).toBe("/abs/~/x");
        expect(expandHome("~user/x")).toBe("~user/x");
        expect(expandHome("rel")).toBe("rel");
    });
});

describe("safely / safelySync", () => {
    const schemaError = new SchemaFileError("read", "nope");

    test("wrap results and SchemaFileErrors", async () => {
        await expect(safely(async () => 1)).resolves.toEqual({success: true, data: 1});
        expect(safelySync(() => 1)).toEqual({success: true, data: 1});
        await expect(safely(() => Promise.reject(schemaError))).resolves.toEqual({success: false, error: schemaError});
        expect(
            safelySync(() => {
                throw schemaError;
            }),
        ).toEqual({success: false, error: schemaError});
    });

    test("rethrow anything else", async () => {
        const other = new TypeError("boom");

        await expect(safely(() => Promise.reject(other))).rejects.toBe(other);
        expect(() =>
            safelySync(() => {
                throw other;
            }),
        ).toThrow(other);
    });
});
