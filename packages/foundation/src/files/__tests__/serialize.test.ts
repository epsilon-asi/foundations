import * as z from "zod";
import {parseStringSync, serialize, serializeAsync, SchemaFileError} from "../index";

const AppConfig = z.object({name: z.string(), port: z.number(), tags: z.array(z.string())});
const value = {name: "api", port: 8080, tags: ["a", "b"]};

const isoDate = z.codec(z.iso.datetime(), z.date(), {
    decode: (text) => new Date(text),
    encode: (date) => date.toISOString(),
});

function caught(run: () => unknown): SchemaFileError {
    try {
        run();
    } catch (error) {
        return error as SchemaFileError;
    }
    throw new Error("Expected the call to throw.");
}

describe("serialize / serializeAsync", () => {
    describe("rendering", () => {
        test("render JSON with two-space indentation and a trailing newline", async () => {
            const expected = `${JSON.stringify(value, null, 2)}\n`;

            expect(serialize(AppConfig, value, {format: "json"})).toBe(expected);
            expect(await serializeAsync(AppConfig, value, {format: "json"})).toBe(expected);
        });

        test("render YAML with two-space indentation and a trailing newline", async () => {
            const expected = "name: api\nport: 8080\ntags:\n  - a\n  - b\n";

            expect(serialize(AppConfig, value, {format: "yaml"})).toBe(expected);
            expect(await serializeAsync(AppConfig, value, {format: "yaml"})).toBe(expected);
        });

        test("honor indent", () => {
            const nested = z.object({server: z.object({port: z.number()})});

            expect(serialize(nested, {server: {port: 1}}, {format: "json", indent: 4})).toBe(
                '{\n    "server": {\n        "port": 1\n    }\n}\n',
            );
            expect(serialize(nested, {server: {port: 1}}, {format: "yaml", indent: 4})).toBe(
                "server:\n    port: 1\n",
            );
        });

        test("can omit the trailing newline", () => {
            expect(serialize(AppConfig, value, {format: "json", trailingNewline: false})).toBe(
                JSON.stringify(value, null, 2),
            );
            expect(serialize(AppConfig, value, {format: "yaml", trailingNewline: false})).toBe(
                "name: api\nport: 8080\ntags:\n  - a\n  - b",
            );
        });

        test("sort keys recursively, including inside arrays", () => {
            const data = {b: 1, a: {d: 1, c: 2}, list: [{z: 1, y: 2}]};

            expect(serialize(z.any(), data, {format: "json", strategy: "none", indent: 0, sortKeys: true})).toBe(
                '{"a":{"c":2,"d":1},"b":1,"list":[{"y":2,"z":1}]}\n',
            );
            expect(
                serialize(z.any(), data, {
                    format: "json",
                    strategy: "none",
                    indent: 0,
                    sortKeys: (left, right) => right.localeCompare(left),
                }),
            ).toBe('{"list":[{"z":1,"y":2}],"b":1,"a":{"d":1,"c":2}}\n');
        });

        test("pass json.replacer to JSON.stringify", () => {
            const text = serialize(z.object({user: z.string(), secret: z.string()}), {user: "u", secret: "s"}, {
                format: "json",
                indent: 0,
                json: {replacer: (key, raw) => (key === "secret" ? undefined : raw)},
            });

            expect(text).toBe('{"user":"u"}\n');
        });

        test("pass yaml document and stringify options through", () => {
            const shared = {a: 1};
            const data = {x: shared, y: shared};

            expect(serialize(z.any(), data, {format: "yaml", strategy: "none"})).toBe("x: &a1\n  a: 1\ny: *a1\n");
            expect(
                serialize(z.any(), data, {
                    format: "yaml",
                    strategy: "none",
                    yaml: {document: {aliasDuplicateObjects: false}},
                }),
            ).toBe("x:\n  a: 1\ny:\n  a: 1\n");
            expect(serialize(AppConfig, value, {format: "yaml", yaml: {stringify: {indentSeq: false}}})).toBe(
                "name: api\nport: 8080\ntags:\n- a\n- b\n",
            );
        });

        test("stringify options override indent", () => {
            const nested = z.object({server: z.object({port: z.number()})});

            expect(
                serialize(nested, {server: {port: 1}}, {format: "yaml", indent: 2, yaml: {stringify: {indent: 3}}}),
            ).toBe("server:\n   port: 1\n");
        });

        test("write a YAML header comment, keeping blank lines", () => {
            const text = serialize(z.object({name: z.string()}), {name: "api"}, {
                format: "yaml",
                yaml: {comment: "Generated file.\n\nDo not edit."},
            });

            expect(text).toBe("# Generated file.\n\n# Do not edit.\n\nname: api\n");
            expect(parseStringSync(z.object({name: z.string()}), text)).toEqual({name: "api"});
        });

        test("ignore the YAML comment option for JSON", () => {
            expect(
                serialize(z.object({name: z.string()}), {name: "api"}, {
                    format: "json",
                    indent: 0,
                    yaml: {comment: "ignored"},
                }),
            ).toBe('{"name":"api"}\n');
        });
    });

    describe("strategies", () => {
        test("encode (default) runs codecs in reverse so the output parses back", () => {
            const Schedule = z.object({at: isoDate});
            const at = new Date("2026-01-02T03:04:05.000Z");

            const text = serialize(Schedule, {at}, {format: "json", indent: 0});

            expect(text).toBe('{"at":"2026-01-02T03:04:05.000Z"}\n');
            expect(parseStringSync(Schedule, text, {format: "json"})).toEqual({at});
        });

        test("encode strips keys the schema does not declare", () => {
            const loose = {name: "api", port: 1, tags: [], extra: true} as z.output<typeof AppConfig>;

            expect(JSON.parse(serialize(AppConfig, loose, {format: "json"}))).toEqual({name: "api", port: 1, tags: []});
        });

        test("encode reports invalid values with the zod issues", () => {
            const invalid = {...value, port: "8080"} as unknown as z.output<typeof AppConfig>;

            const error = caught(() => serialize(AppConfig, invalid, {format: "json", filePath: "app.json"}));

            expect(error).toBeInstanceOf(SchemaFileError);
            expect(error).toMatchObject({kind: "encode", filePath: "app.json"});
            expect(error.message).toMatch(/^Encoding failed for app\.json:\n/);
            expect(error.message).toContain("→ at port");
            expect(error.issues?.map((issue) => issue.path)).toEqual([["port"]]);
            expect(error.cause).toBeInstanceOf(z.ZodError);
        });

        test("encode rejects one-way transforms with a hint", () => {
            const schema = z.object({count: z.string().transform(Number)});

            const error = caught(() => serialize(schema, {count: 5}, {format: "json"}));

            expect(error).toMatchObject({kind: "encode", issues: undefined});
            expect(error.message).toMatch(/^Could not encode value for input: /);
            expect(error.message).toContain('(one-way .transform() cannot be encoded; use z.codec() or strategy: "parse")');
        });

        test("parse validates and writes the output shape", () => {
            const schema = z.object({name: z.string().trim()});

            expect(serialize(schema, {name: "  api  "}, {format: "json", strategy: "parse", indent: 0})).toBe(
                '{"name":"api"}\n',
            );
        });

        test("parse reports invalid values as validate errors", async () => {
            const invalid = {...value, tags: "a"} as unknown as z.output<typeof AppConfig>;

            const error = caught(() => serialize(AppConfig, invalid, {format: "yaml", strategy: "parse"}));
            expect(error).toMatchObject({kind: "validate"});
            expect(error.message).toMatch(/^Validation failed for input:\n/);

            await expect(serializeAsync(AppConfig, invalid, {format: "yaml", strategy: "parse"})).rejects.toMatchObject({
                kind: "validate",
            });
        });

        test("none writes the value as-is without validation", () => {
            const invalid = {name: 1, extra: true} as unknown as z.output<typeof AppConfig>;

            expect(serialize(AppConfig, invalid, {format: "json", strategy: "none", indent: 0})).toBe(
                '{"name":1,"extra":true}\n',
            );
        });

        test("only the async variant supports async refinements", async () => {
            const schema = z.object({name: z.string().refine(async (name) => name.length > 0)});

            expect(await serializeAsync(schema, {name: "api"}, {format: "json", indent: 0})).toBe('{"name":"api"}\n');
            expect(
                await serializeAsync(schema, {name: "api"}, {format: "json", indent: 0, strategy: "parse"}),
            ).toBe('{"name":"api"}\n');
            const encodeError = caught(() => serialize(schema, {name: "api"}, {format: "json"}));
            expect(encodeError).toMatchObject({kind: "encode"});
            expect(encodeError.message).toMatch(/\(try the async API\)$/);
            expect(encodeError.message).not.toContain(".transform()");

            const parseError = caught(() => serialize(schema, {name: "api"}, {format: "json", strategy: "parse"}));
            expect(parseError).toMatchObject({kind: "validate"});
            expect(parseError.message).toMatch(/\(try the async API\)$/);
        });

        test("only point at one-way transforms when that is the cause", () => {
            const failing = z.codec(z.string(), z.number(), {
                decode: Number,
                encode: () => {
                    throw new Error("cannot encode");
                },
            });

            const error = caught(() => serialize(z.object({n: failing}), {n: 1}, {format: "json"}));

            expect(error).toMatchObject({kind: "encode", message: "Could not encode value for input: cannot encode"});
        });

        test("serializeAsync reports encode failures too", async () => {
            const invalid = {...value, port: "8080"} as unknown as z.output<typeof AppConfig>;

            await expect(serializeAsync(AppConfig, invalid, {format: "json"})).rejects.toMatchObject({kind: "encode"});
        });
    });

    describe("serialize errors", () => {
        test("report values JSON cannot represent", () => {
            const error = caught(() =>
                serialize(z.object({count: z.bigint()}), {count: BigInt(1)}, {format: "json", filePath: "n.json"}),
            );

            expect(error).toMatchObject({kind: "serialize", filePath: "n.json"});
            expect(error.message).toBe("Failed to serialize n.json as JSON: Do not know how to serialize a BigInt");
            expect(error.cause).toBeInstanceOf(TypeError);
        });

        test("report a top-level value that JSON.stringify drops", () => {
            expect(caught(() => serialize(z.any(), undefined, {format: "json", strategy: "none"}))).toMatchObject({
                kind: "serialize",
                message: "Failed to serialize input as JSON: value is not JSON-serializable",
            });
        });

        test("report YAML stringify failures", () => {
            const error = caught(() =>
                serialize(AppConfig, value, {format: "yaml", yaml: {stringify: {indent: 0}}}),
            );

            expect(error).toMatchObject({kind: "serialize"});
            expect(error.message).toMatch(/^Failed to serialize input as YAML: /);
        });
    });
});
