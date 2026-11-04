import * as z from "zod";
import {EXTENSIONS, SchemaFileError} from "../types";
import {formatFromExtension, isPlainObject, label, resolveFormat} from "../util";

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
