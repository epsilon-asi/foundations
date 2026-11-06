import * as z from "zod";
import os from "node:os";
import {mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {
    createLayeredFile,
    discoverLayers,
    discoverLayersSync,
    interpolateEnvHook,
    loadLayeredFile,
    loadLayeredFileSync,
    loadMergedFiles,
    loadMergedFilesSync,
    safeLoadLayeredFile,
    safeLoadLayeredFileSync,
    SchemaFileError,
} from "../index";

const Config = z.object({
    model: z.string().default("default-model"),
    rounds: z.number().int().min(1).default(10),
    ignore: z.array(z.string()).default([]),
    server: z
        .object({
            host: z.string().default("localhost"),
            port: z.number().default(80),
        })
        .default({host: "localhost", port: 80}),
});

const NAME = "tool.yaml";

let root: string; // <tmp>/root
let home: string; // <tmp>/home
let project: string; // root/project
let cwd: string; // root/project/pkg

beforeEach(() => {
    const tmp = realpathSync(mkdtempSync(join(os.tmpdir(), "schema-file-layered-")));
    root = join(tmp, "root");
    home = join(tmp, "home");
    project = join(root, "project");
    cwd = join(project, "pkg");
    mkdirSync(cwd, {recursive: true});
    mkdirSync(home, {recursive: true});
    jest.spyOn(os, "homedir").mockReturnValue(home);
});

afterEach(() => {
    jest.restoreAllMocks();
    rmSync(dirname(root), {recursive: true, force: true});
});

function file(filePath: string, contents: string): string {
    mkdirSync(dirname(filePath), {recursive: true});
    writeFileSync(filePath, contents);
    return filePath;
}

/** cwd > project > root > ~/.tool/tool.yaml */
function standardLayers() {
    return {
        local: file(join(cwd, NAME), "model: local\n"),
        project: file(join(project, NAME), "rounds: 20\nserver:\n  port: 8080\nignore: [a, b]\n"),
        root: file(join(root, NAME), "model: root\nrounds: 30\nignore: [z]\nserver:\n  host: root-host\n"),
        user: file(join(home, ".tool", NAME), "model: user\nrounds: 40\nserver:\n  host: user-host\n  port: 1\n"),
    };
}

const fallbacks = ["~/.tool/tool.yaml"];

describe("discoverLayers / discoverLayersSync", () => {
    test.each([
        ["async", (name: string, o?: object) => discoverLayers(name, o)],
        ["sync", async (name: string, o?: object) => discoverLayersSync(name, o)],
    ])("%s: returns existing layers highest precedence first", async (_, discover) => {
        const paths = standardLayers();

        expect(await discover(NAME, {startDir: cwd, fallbacks})).toEqual([
            {filePath: paths.local, origin: "local"},
            {filePath: paths.project, origin: "ancestor"},
            {filePath: paths.root, origin: "ancestor"},
            {filePath: paths.user, origin: "fallback"},
        ]);
    });

    test("skips directories without the file and missing fallbacks", async () => {
        const projectFile = file(join(project, NAME), "{}");

        const layers = await discoverLayers(NAME, {startDir: cwd, fallbacks: ["~/missing.yaml"]});

        expect(layers).toEqual([{filePath: projectFile, origin: "ancestor"}]);
    });

    test("returns nothing when no file exists", async () => {
        expect(await discoverLayers("nothing-here.yaml", {startDir: cwd})).toEqual([]);
        expect(discoverLayersSync("nothing-here.yaml", {startDir: cwd})).toEqual([]);
    });

    test("stopDir ends the walk inclusively", async () => {
        const paths = standardLayers();

        const layers = await discoverLayers(NAME, {startDir: cwd, stopDir: project});

        expect(layers.map((layer) => layer.filePath)).toEqual([paths.local, paths.project]);
    });

    test("stopDir equal to startDir only checks the start directory", () => {
        const paths = standardLayers();

        expect(discoverLayersSync(NAME, {startDir: cwd, stopDir: cwd})).toEqual([
            {filePath: paths.local, origin: "local"},
        ]);
    });

    test("defaults startDir to process.cwd()", async () => {
        const paths = standardLayers();
        jest.spyOn(process, "cwd").mockReturnValue(project);

        const layers = await discoverLayers(NAME);

        expect(layers).toEqual([
            {filePath: paths.project, origin: "local"},
            {filePath: paths.root, origin: "ancestor"},
        ]);
    });

    test("expands ~ in startDir, stopDir and fallbacks", async () => {
        const homeFile = file(join(home, NAME), "{}");
        const nested = join(home, "a", "b");
        mkdirSync(nested, {recursive: true});

        expect(await discoverLayers(NAME, {startDir: "~", stopDir: "~"})).toEqual([
            {filePath: homeFile, origin: "local"},
        ]);
        expect(await discoverLayers(NAME, {startDir: "~/a/b", stopDir: "~"})).toEqual([
            {filePath: homeFile, origin: "ancestor"},
        ]);
    });

    test("a fallback that is also an ancestor keeps its ancestor slot", async () => {
        const rootFile = file(join(root, NAME), "{}");

        const layers = await discoverLayers(NAME, {startDir: cwd, fallbacks: [rootFile, rootFile]});

        expect(layers).toEqual([{filePath: rootFile, origin: "ancestor"}]);
    });

    test("accepts a relative path as the file name", async () => {
        const nested = file(join(project, ".tool", "config.yaml"), "{}");

        expect(await discoverLayers(join(".tool", "config.yaml"), {startDir: cwd})).toEqual([
            {filePath: nested, origin: "ancestor"},
        ]);
    });
});

describe("loadLayeredFile / loadLayeredFileSync", () => {
    test.each([
        ["async", (o: object) => loadLayeredFile(NAME, Config, o)],
        ["sync", async (o: object) => loadLayeredFileSync(NAME, Config, o)],
    ])("%s: merges layers by precedence", async (_, load) => {
        const paths = standardLayers();

        const {value, layers} = await load({startDir: cwd, fallbacks});

        expect(value).toEqual({
            model: "local", // local beats everything
            rounds: 20, // project beats root and user
            ignore: ["a", "b"], // arrays are replaced, not concatenated
            server: {host: "root-host", port: 8080}, // nested objects merge key by key
        });
        expect(layers.map((layer) => layer.origin)).toEqual(["local", "ancestor", "ancestor", "fallback"]);
        expect(layers[0].filePath).toBe(paths.local);
    });

    test("schema defaults never mask a lower layer's value", async () => {
        file(join(cwd, NAME), "rounds: 2\n");
        file(join(home, ".tool", NAME), "model: from-user\n");

        const {value} = await loadLayeredFile(NAME, Config, {startDir: cwd, fallbacks});

        expect(value).toEqual({
            model: "from-user",
            rounds: 2,
            ignore: [],
            server: {host: "localhost", port: 80},
        });
    });

    test("with no layers the schema defaults apply", async () => {
        const result = loadLayeredFileSync("absent.yaml", Config, {startDir: cwd});

        expect(result).toEqual({value: Config.parse({}), layers: []});
    });

    test("an empty layer contributes nothing", async () => {
        file(join(cwd, NAME), "\n");
        file(join(project, NAME), "model: project\n");

        const {value, layers} = await loadLayeredFile(NAME, Config, {startDir: cwd, stopDir: project});

        expect(value.model).toBe("project");
        expect(layers).toHaveLength(2);
    });

    test("mixes JSON and YAML layers", async () => {
        file(join(cwd, "tool.json"), '{"model": "json"}');
        file(join(project, "tool.json"), '{"rounds": 7}');

        const {value} = await loadLayeredFile("tool.json", Config, {startDir: cwd, stopDir: project});

        expect(value).toMatchObject({model: "json", rounds: 7});
    });

    test("runs preprocess on every layer", async () => {
        file(join(cwd, NAME), "model: ${MODEL}\n");
        file(join(project, NAME), "server:\n  host: ${HOST:-fallback-host}\n");
        const options = {startDir: cwd, stopDir: project, preprocess: interpolateEnvHook({MODEL: "from-env"})};

        const {value} = await loadLayeredFile(NAME, Config, options);

        expect(value).toMatchObject({model: "from-env", server: {host: "fallback-host"}});
    });

    test("rejects a layer whose top level is not a mapping", async () => {
        const bad = file(join(project, NAME), "- a\n- b\n");
        file(join(cwd, NAME), "model: ok\n");

        await expect(loadLayeredFile(NAME, Config, {startDir: cwd, stopDir: project})).rejects.toMatchObject({
            kind: "validate",
            filePath: bad,
            message: `Cannot merge ${bad}: its top level must be a mapping`,
        });
        expect(() => loadLayeredFileSync(NAME, Config, {startDir: cwd, stopDir: project})).toThrow(SchemaFileError);
    });

    test("validation errors name every merged file", async () => {
        const local = file(join(cwd, NAME), "rounds: 0\n");
        const parent = file(join(project, NAME), "model: x\n");

        const error = await loadLayeredFile(NAME, Config, {startDir: cwd, stopDir: project}).catch((e) => e);

        expect(error).toBeInstanceOf(SchemaFileError);
        expect(error).toMatchObject({kind: "validate", filePath: `merged ${local}, ${parent}`});
        expect(error.message).toContain(`Validation failed for merged ${local}, ${parent}`);
    });

    test("validation errors name a single file directly", () => {
        const local = file(join(cwd, NAME), "rounds: 0\n");

        expect(() => loadLayeredFileSync(NAME, Config, {startDir: cwd, stopDir: cwd})).toThrow(
            `Validation failed for ${local}`,
        );
    });

    test("surfaces parse errors from a layer", async () => {
        const broken = file(join(cwd, NAME), "model: [unterminated\n");

        await expect(loadLayeredFile(NAME, Config, {startDir: cwd, stopDir: cwd})).rejects.toMatchObject({
            kind: "parse",
            filePath: broken,
        });
    });

    test("the sync variant refuses async schemas", () => {
        file(join(cwd, NAME), "model: x\n");
        const Async = z.object({model: z.string().refine(async () => true)});

        expect(() => loadLayeredFileSync(NAME, Async, {startDir: cwd, stopDir: cwd})).toThrow(
            /try the async API/,
        );
    });
});

describe("safeLoadLayeredFile / safeLoadLayeredFileSync", () => {
    test("return success results", async () => {
        file(join(cwd, NAME), "model: ok\n");
        const options = {startDir: cwd, stopDir: cwd};

        const asyncResult = await safeLoadLayeredFile(NAME, Config, options);
        const syncResult = safeLoadLayeredFileSync(NAME, Config, options);

        expect(asyncResult).toEqual(syncResult);
        expect(asyncResult).toMatchObject({success: true, data: {value: {model: "ok"}}});
    });

    test("return failure results instead of throwing", async () => {
        file(join(cwd, NAME), "rounds: -1\n");
        const options = {startDir: cwd, stopDir: cwd};

        const asyncResult = await safeLoadLayeredFile(NAME, Config, options);
        const syncResult = safeLoadLayeredFileSync(NAME, Config, options);

        for (const result of [asyncResult, syncResult]) {
            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.kind).toBe("validate");
        }
    });
});

describe("loadMergedFiles / loadMergedFilesSync", () => {
    test("merges an explicit list, first entry winning", async () => {
        const high = file(join(cwd, "high.yaml"), "model: high\n");
        const low = file(join(cwd, "low.json"), '{"model": "low", "rounds": 3}');

        expect(await loadMergedFiles([high, low], Config)).toMatchObject({model: "high", rounds: 3});
        expect(loadMergedFilesSync([low, high], Config)).toMatchObject({model: "low", rounds: 3});
    });

    test("an empty list validates {}", async () => {
        expect(await loadMergedFiles([], Config)).toEqual(Config.parse({}));
        expect(loadMergedFilesSync([], Config)).toEqual(Config.parse({}));
    });

    test("honors allowMissing for paths that do not exist", async () => {
        const present = file(join(cwd, "present.yaml"), "rounds: 5\n");
        const missing = join(cwd, "missing.yaml");

        expect(await loadMergedFiles([missing, present], Config, {allowMissing: true})).toMatchObject({rounds: 5});
        await expect(loadMergedFiles([missing], Config)).rejects.toMatchObject({kind: "read", filePath: missing});
    });
});

describe("createLayeredFile", () => {
    test("binds the schema, file name and defaults", async () => {
        const paths = standardLayers();
        const Tool = createLayeredFile(Config, NAME, {startDir: cwd, fallbacks});

        expect(Tool.schema).toBe(Config);
        expect(Tool.fileName).toBe(NAME);
        expect((await Tool.discover()).map((layer) => layer.filePath)).toEqual([
            paths.local,
            paths.project,
            paths.root,
            paths.user,
        ]);
        expect(Tool.discoverSync({stopDir: project}).map((layer) => layer.origin)).toEqual([
            "local",
            "ancestor",
            "fallback",
        ]);
        expect((await Tool.load()).value.model).toBe("local");
        expect(Tool.loadSync({startDir: root}).value.model).toBe("root");
        expect((await Tool.safeLoad({startDir: home})).success).toBe(true);
        expect(Tool.safeLoadSync({startDir: home, fallbacks: []})).toEqual({
            success: true,
            data: {value: Config.parse({}), layers: []},
        });
    });

    test("works without defaults", async () => {
        file(join(cwd, NAME), "model: bare\n");
        jest.spyOn(process, "cwd").mockReturnValue(cwd);

        const Tool = createLayeredFile(Config, NAME);

        expect((await Tool.load({stopDir: cwd})).value.model).toBe("bare");
    });
});

describe("default options", () => {
    test("every entry point works with only a file name and schema", async () => {
        const local = file(join(cwd, NAME), "model: bare\n");
        jest.spyOn(process, "cwd").mockReturnValue(cwd);
        const expected = {value: Config.parse({model: "bare"}), layers: [{filePath: local, origin: "local"}]};

        expect(discoverLayersSync(NAME)).toEqual(expected.layers);
        expect(await loadLayeredFile(NAME, Config)).toEqual(expected);
        expect(loadLayeredFileSync(NAME, Config)).toEqual(expected);
        expect(await safeLoadLayeredFile(NAME, Config)).toEqual({success: true, data: expected});
        expect(safeLoadLayeredFileSync(NAME, Config)).toEqual({success: true, data: expected});
        expect(await loadMergedFiles([local], Config)).toEqual(expected.value);
        expect(loadMergedFilesSync([local], Config)).toEqual(expected.value);
    });
});
