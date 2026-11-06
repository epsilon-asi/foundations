import * as z from "zod";
import * as files from "../index";
import * as root from "../../index";

describe("exports", () => {
    test("the files module exports its runtime API", () => {
        expect(Object.keys(files).sort()).toEqual([
            "SchemaFileError",
            "createLayeredFile",
            "createSchemaFile",
            "deepMerge",
            "discoverLayers",
            "discoverLayersSync",
            "interpolateEnv",
            "interpolateEnvHook",
            "loadFile",
            "loadFileSync",
            "loadLayeredFile",
            "loadLayeredFileSync",
            "loadMergedFiles",
            "loadMergedFilesSync",
            "parseString",
            "parseStringSync",
            "safeLoadFile",
            "safeLoadFileSync",
            "safeLoadLayeredFile",
            "safeLoadLayeredFileSync",
            "saveFile",
            "saveFileSync",
            "serialize",
            "serializeAsync",
        ]);
    });

    test("the package root does not re-export the files module, so it stays free of node:fs", () => {
        for (const name of Object.keys(files)) {
            expect(root).not.toHaveProperty(name);
        }
    });

    test("errors thrown by the module are instances of the exported SchemaFileError", () => {
        let caught: unknown;
        try {
            files.parseStringSync(z.object({port: z.number()}), "port: x");
        } catch (error) {
            caught = error;
        }

        expect(caught).toBeInstanceOf(files.SchemaFileError);
        expect(caught).toBeInstanceOf(Error);
    });
});
