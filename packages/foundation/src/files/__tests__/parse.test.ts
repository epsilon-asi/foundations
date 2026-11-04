import * as z from "zod";
import {parseString, parseStringSync, SchemaFileError} from "../index";

const Server = z.object({host: z.string(), port: z.coerce.number()});

function caught(run: () => unknown): SchemaFileError {
    try {
        run();
    } catch (error) {
        return error as SchemaFileError;
    }
    throw new Error("Expected the call to throw.");
}

describe("parseString / parseStringSync", () => {
    test("parse and validate text already in memory", async () => {
        expect(await parseString(Server, "host: db\nport: '5432'\n")).toEqual({host: "db", port: 5432});
        expect(parseStringSync(Server, '{"host": "db", "port": 5432}', {format: "json"})).toEqual({
            host: "db",
            port: 5432,
        });
    });

    test("default to YAML without a format or filePath, which also accepts JSON", () => {
        expect(parseStringSync(Server, '{"host": "db", "port": 1}')).toEqual({host: "db", port: 1});
    });

    test("use filePath to pick the format", () => {
        const yamlText = "host: db\nport: 1\n";

        expect(parseStringSync(Server, yamlText, {filePath: "server.yml"})).toEqual({host: "db", port: 1});
        expect(caught(() => parseStringSync(Server, yamlText, {filePath: "server.json"}))).toMatchObject({
            kind: "parse",
            filePath: "server.json",
        });
    });

    test("label errors with filePath, or 'input' without one", async () => {
        await expect(parseString(Server, "host: db\n")).rejects.toThrow(/^Validation failed for input:\n/);
        expect(() => parseStringSync(Server, "{", {format: "json"})).toThrow(/^Failed to parse input as JSON: /);
        expect(() => parseStringSync(Server, "host: db\n", {filePath: "conf/server.yaml"})).toThrow(
            /^Validation failed for conf\/server\.yaml:\n/,
        );
    });

    test("apply emptyValue, stripBom and preprocess like loading does", async () => {
        const withDefaults = z.object({port: z.number().default(80)});

        expect(parseStringSync(withDefaults, "", {emptyValue: {}})).toEqual({port: 80});
        expect(parseStringSync(withDefaults, "﻿{}", {format: "json"})).toEqual({port: 80});
        expect(caught(() => parseStringSync(withDefaults, "﻿{}", {format: "json", stripBom: false}))).toMatchObject({
            kind: "parse",
        });

        const preprocess = jest.fn(async (raw: unknown) => ({...(raw as object), port: 1}));
        expect(await parseString(withDefaults, "{}", {format: "json", filePath: "x.json", preprocess})).toEqual({
            port: 1,
        });
        expect(preprocess).toHaveBeenCalledWith({}, {format: "json", filePath: "x.json"});
    });

    test("only the async variant supports async refinements", async () => {
        const schema = z.string().refine(async (value) => value.length > 0);

        expect(await parseString(schema, "value")).toBe("value");
        expect(caught(() => parseStringSync(schema, "value"))).toMatchObject({kind: "validate"});
    });
});
