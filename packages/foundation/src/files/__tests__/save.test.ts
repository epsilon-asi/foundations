import * as z from "zod";
import {
    chmodSync,
    existsSync,
    lstatSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    readlinkSync,
    rmSync,
    statSync,
    symlinkSync,
    writeFileSync
} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {loadFileSync, saveFile, saveFileSync, SaveOptions, SchemaFileError} from "../index";

const AppConfig = z.object({name: z.string(), port: z.number().int()});
const value = {name: "api", port: 8080};

type Save = (filePath: string, options?: SaveOptions) => Promise<string>;

const variants: Array<[string, Save]> = [
    ["saveFile", (filePath, options) => saveFile(filePath, AppConfig, value, options)],
    ["saveFileSync", async (filePath, options) => saveFileSync(filePath, AppConfig, value, options)],
];

const posixTest = process.platform === "win32" ? test.skip : test;

let dir: string;

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "schema-file-save-"));
});

afterEach(() => {
    rmSync(dir, {recursive: true, force: true});
});

async function rejected(promise: Promise<unknown>): Promise<SchemaFileError> {
    try {
        await promise;
    } catch (error) {
        return error as SchemaFileError;
    }
    throw new Error("Expected the promise to reject.");
}

describe.each(variants)("%s", (_name, save) => {
    test("writes YAML or JSON by extension and returns the text written", async () => {
        const yaml = join(dir, "app.yaml");
        const json = join(dir, "app.json");

        expect(await save(yaml)).toBe("name: api\nport: 8080\n");
        expect(await save(json)).toBe(`${JSON.stringify(value, null, 2)}\n`);

        expect(readFileSync(yaml, "utf8")).toBe("name: api\nport: 8080\n");
        expect(readFileSync(json, "utf8")).toBe(`${JSON.stringify(value, null, 2)}\n`);
        expect(loadFileSync(yaml, AppConfig)).toEqual(value);
        expect(loadFileSync(json, AppConfig)).toEqual(value);
    });

    test("honors an explicit format, and requires one for unknown extensions", async () => {
        const filePath = join(dir, "app.conf");

        const error = await rejected(save(filePath));
        expect(error).toMatchObject({
            kind: "format",
            filePath,
            message: `Cannot determine format for ${filePath}; pass { format: "json" | "yaml" }`,
        });
        expect(await rejected(save(filePath, {format: "auto"}))).toMatchObject({kind: "format"});
        expect(existsSync(filePath)).toBe(false);

        expect(await save(filePath, {format: "json"})).toBe(`${JSON.stringify(value, null, 2)}\n`);
        expect(await save(join(dir, "app.json"), {format: "yaml"})).toBe("name: api\nport: 8080\n");
    });

    test("passes serialize options through", async () => {
        const text = await save(join(dir, "app.json"), {indent: 0, sortKeys: (a, b) => b.localeCompare(a)});

        expect(text).toBe('{"port":8080,"name":"api"}\n');
    });

    test("creates missing parent directories by default", async () => {
        const filePath = join(dir, "a", "b", "app.yaml");

        await save(filePath);

        expect(readFileSync(filePath, "utf8")).toBe("name: api\nport: 8080\n");
    });

    test.each([true, false])("fails without createDirs when the parent is missing (atomic: %s)", async (atomic) => {
        const filePath = join(dir, "missing", "app.yaml");

        const error = await rejected(save(filePath, {createDirs: false, atomic}));

        expect(error).toMatchObject({kind: "write", filePath});
        expect(error.message).toMatch(new RegExp(`^Failed to write ${filePath}: `));
        expect(error.message).toContain("ENOENT");
        expect(error.cause).toMatchObject({code: "ENOENT"});
        expect(existsSync(join(dir, "missing"))).toBe(false);
    });

    test("writes atomically by default, leaving no temp files behind", async () => {
        const filePath = join(dir, "app.yaml");
        writeFileSync(filePath, "old: true\n");

        await save(filePath);

        expect(readFileSync(filePath, "utf8")).toBe("name: api\nport: 8080\n");
        expect(readdirSync(dir)).toEqual(["app.yaml"]);
    });

    test("removes the temp file when the atomic rename fails", async () => {
        const filePath = join(dir, "app.yaml");
        mkdirSync(filePath);
        writeFileSync(join(filePath, "child"), "");

        const error = await rejected(save(filePath));

        expect(error).toMatchObject({kind: "write", filePath});
        expect(readdirSync(dir)).toEqual(["app.yaml"]);
    });

    test("can write in place", async () => {
        const filePath = join(dir, "app.yaml");
        writeFileSync(filePath, "old: true\n");

        await save(filePath, {atomic: false});

        expect(readFileSync(filePath, "utf8")).toBe("name: api\nport: 8080\n");
        expect(readdirSync(dir)).toEqual(["app.yaml"]);
    });

    test.each([true, false])("refuses to replace an existing file without overwrite (atomic: %s)", async (atomic) => {
        const existing = join(dir, "existing.yaml");
        const fresh = join(dir, "fresh.yaml");
        writeFileSync(existing, "old: true\n");

        const error = await rejected(save(existing, {overwrite: false, atomic}));

        expect(error).toMatchObject({
            kind: "write",
            filePath: existing,
            message: `Refusing to overwrite existing file ${existing}`,
        });
        expect(readFileSync(existing, "utf8")).toBe("old: true\n");

        await save(fresh, {overwrite: false, atomic});
        expect(readFileSync(fresh, "utf8")).toBe("name: api\nport: 8080\n");
    });

    posixTest.each([true, false])("applies mode to a newly created file (atomic: %s)", async (atomic) => {
        const filePath = join(dir, "secret.yaml");

        await save(filePath, {mode: 0o600, atomic});

        expect(statSync(filePath).mode & 0o777).toBe(0o600);
    });

    posixTest.each([0o600, 0o640, 0o666])("keeps an existing file's permissions (%o)", async (mode) => {
        const filePath = join(dir, "secret.yaml");
        writeFileSync(filePath, "old: true\n");
        chmodSync(filePath, mode);

        await save(filePath);
        expect(statSync(filePath).mode & 0o777).toBe(mode);

        await save(filePath, {atomic: false});
        expect(statSync(filePath).mode & 0o777).toBe(mode);
    });

    posixTest("an explicit mode replaces an existing file's permissions when writing atomically", async () => {
        const filePath = join(dir, "secret.yaml");
        writeFileSync(filePath, "old: true\n");
        chmodSync(filePath, 0o644);

        await save(filePath, {mode: 0o600});

        expect(statSync(filePath).mode & 0o777).toBe(0o600);
    });

    posixTest.each([true, false])("writes through a symlink to its target (atomic: %s)", async (atomic) => {
        const targets = join(dir, "targets");
        mkdirSync(targets);
        const target = join(targets, "real.yaml");
        const link = join(dir, "link.yaml");
        writeFileSync(target, "old: true\n");
        symlinkSync("targets/real.yaml", link);

        await save(link, {atomic});

        expect(lstatSync(link).isSymbolicLink()).toBe(true);
        expect(readlinkSync(link)).toBe("targets/real.yaml");
        expect(readFileSync(target, "utf8")).toBe("name: api\nport: 8080\n");
        expect(readdirSync(targets)).toEqual(["real.yaml"]);
        expect(readdirSync(dir).sort()).toEqual(["link.yaml", "targets"]);
    });

    posixTest("follows a chain of symlinks", async () => {
        const target = join(dir, "real.yaml");
        writeFileSync(target, "old: true\n");
        symlinkSync(target, join(dir, "first.yaml"));
        symlinkSync(join(dir, "first.yaml"), join(dir, "second.yaml"));

        await save(join(dir, "second.yaml"));

        expect(lstatSync(join(dir, "first.yaml")).isSymbolicLink()).toBe(true);
        expect(lstatSync(join(dir, "second.yaml")).isSymbolicLink()).toBe(true);
        expect(readFileSync(target, "utf8")).toBe("name: api\nport: 8080\n");
    });

    posixTest.each([true, false])("creates the target of a dangling symlink (atomic: %s)", async (atomic) => {
        const link = join(dir, "link.yaml");
        symlinkSync("real.yaml", link);

        await save(link, {atomic});

        expect(lstatSync(link).isSymbolicLink()).toBe(true);
        expect(readFileSync(join(dir, "real.yaml"), "utf8")).toBe("name: api\nport: 8080\n");
    });

    posixTest("checks overwrite against the symlink target", async () => {
        const link = join(dir, "link.yaml");
        writeFileSync(join(dir, "real.yaml"), "old: true\n");
        symlinkSync("real.yaml", link);

        expect(await rejected(save(link, {overwrite: false}))).toMatchObject({kind: "write", filePath: link});
        expect(readFileSync(join(dir, "real.yaml"), "utf8")).toBe("old: true\n");
    });

    test("writes in the given encoding", async () => {
        const filePath = join(dir, "app.json");

        await save(filePath, {encoding: "utf16le"});

        expect(readFileSync(filePath, "utf16le")).toBe(`${JSON.stringify(value, null, 2)}\n`);
        expect(loadFileSync(filePath, AppConfig, {encoding: "utf16le"})).toEqual(value);
    });

    test("reports other fs failures as write errors", async () => {
        const blocker = join(dir, "blocker");
        writeFileSync(blocker, "");

        const error = await rejected(save(join(blocker, "app.yaml")));

        expect(error).toMatchObject({kind: "write", filePath: join(blocker, "app.yaml")});
        expect(error.cause).toMatchObject({code: expect.any(String)});
    });
});

describe("validation before writing", () => {
    const invalid = {name: "api", port: 1.5};

    test("nothing is written when the value is invalid", async () => {
        const asyncPath = join(dir, "async.yaml");
        const syncPath = join(dir, "sync.yaml");

        expect(await rejected(saveFile(asyncPath, AppConfig, invalid))).toMatchObject({
            kind: "encode",
            filePath: asyncPath,
        });

        let syncError: unknown;
        try {
            saveFileSync(syncPath, AppConfig, invalid);
        } catch (error) {
            syncError = error;
        }
        expect(syncError).toMatchObject({kind: "encode", filePath: syncPath});

        expect(readdirSync(dir)).toEqual([]);
    });

    test("an existing file is left untouched when the value is invalid", async () => {
        const filePath = join(dir, "app.yaml");
        writeFileSync(filePath, "name: api\nport: 1\n");

        await expect(saveFile(filePath, AppConfig, invalid, {strategy: "parse"})).rejects.toMatchObject({
            kind: "validate",
        });

        expect(readFileSync(filePath, "utf8")).toBe("name: api\nport: 1\n");
    });

    test("codecs round-trip through the file", async () => {
        const isoDate = z.codec(z.iso.datetime(), z.date(), {
            decode: (text) => new Date(text),
            encode: (date) => date.toISOString(),
        });
        const Schedule = z.object({at: isoDate});
        const filePath = join(dir, "schedule.json");
        const at = new Date("2026-01-02T03:04:05.000Z");

        await saveFile(filePath, Schedule, {at});

        expect(JSON.parse(readFileSync(filePath, "utf8"))).toEqual({at: "2026-01-02T03:04:05.000Z"});
        expect(loadFileSync(filePath, Schedule)).toEqual({at});
    });
});
