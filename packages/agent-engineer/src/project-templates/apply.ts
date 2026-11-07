import {existsSync} from 'node:fs';
import {copyFile, mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {dirname, isAbsolute, join, normalize, relative, sep} from 'node:path';
import type {LoadedTemplate} from './registry.js';
import {renderPath, renderString, TEMPLATE_SUFFIX, type Variables} from './render.js';

export type PlannedFile = {
    /** The file in the template's `files/` folder. */
    readonly source: string;
    /** The source path relative to `files/`, with `/` separators. */
    readonly sourcePath: string;
    /** The rendered path relative to the target folder, with `/` separators. */
    readonly path: string;
    /** The absolute path it is written to. */
    readonly target: string;
    /** True for `.tmpl` files, whose contents were rendered; false for files copied as-is. */
    readonly render: boolean;
    /** The rendered contents, for `.tmpl` files. */
    readonly contents?: string;
};

/** Every file under `dir`, relative to it with `/` separators, sorted. Anything that is not a file or folder throws. */
export async function walkFiles(dir: string, prefix = ''): Promise<string[]> {
    const entries = await readdir(dir, {withFileTypes: true});
    const files: string[] = [];
    for (const entry of entries) {
        const relPath = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
        if (entry.isDirectory()) {
            files.push(...(await walkFiles(join(dir, entry.name), relPath)));
        } else if (entry.isFile()) {
            files.push(relPath);
        } else {
            throw new Error(`${relPath}: only regular files and folders are supported in a template`);
        }
    }
    return files.sort();
}

function checkRenderedPath(sourcePath: string, path: string): void {
    const segments = path.split('/');
    if (path === '' || isAbsolute(path) || segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
        throw new Error(`${sourcePath} renders to '${path}', which is not a valid path inside the project`);
    }
}

/**
 * Works out every file the template writes into `targetDir` and renders the
 * `.tmpl` contents, without writing anything. Every error (an unknown
 * variable, a path that leaves the project, two files rendering to the same
 * path) is raised here, so a failed plan leaves nothing half-written.
 */
export async function planFiles(template: LoadedTemplate, targetDir: string, vars: Variables): Promise<PlannedFile[]> {
    const plan: PlannedFile[] = [];
    const sources = new Map<string, string>();

    for (const sourcePath of await walkFiles(template.filesDir)) {
        const path = renderPath(sourcePath, vars);
        checkRenderedPath(sourcePath, path);

        const clash = sources.get(path);
        if (clash !== undefined) {
            throw new Error(`${clash} and ${sourcePath} both render to '${path}'`);
        }
        sources.set(path, sourcePath);

        const source = join(template.filesDir, ...sourcePath.split('/'));
        const target = join(targetDir, ...path.split('/'));
        if (sourcePath.endsWith(TEMPLATE_SUFFIX)) {
            const text = await readFile(source, 'utf8');
            plan.push({source, sourcePath, path, target, render: true, contents: renderString(text, vars, sourcePath)});
        } else {
            plan.push({source, sourcePath, path, target, render: false});
        }
    }

    return plan;
}

/** Throws unless `targetDir` is missing, an empty folder, or `force` is set and it is a folder. */
export async function assertTargetDir(targetDir: string, force: boolean): Promise<void> {
    if (!existsSync(targetDir)) {
        return;
    }
    if (!(await stat(targetDir)).isDirectory()) {
        throw new Error(`${targetDir} exists and is not a folder`);
    }
    if (!force && (await readdir(targetDir)).length > 0) {
        throw new Error(`${targetDir} is not empty; pass --force to write into it anyway`);
    }
}

/** Writes a plan from `planFiles` into `targetDir`, keeping each source file's permissions. */
export async function writeFiles(plan: readonly PlannedFile[], targetDir: string, options: {force: boolean}): Promise<void> {
    await assertTargetDir(targetDir, options.force);

    for (const file of plan) {
        const fromTarget = relative(targetDir, file.target);
        if (fromTarget === '' || fromTarget.startsWith(`..${sep}`) || fromTarget === '..' || isAbsolute(normalize(fromTarget))) {
            throw new Error(`${file.target} is outside ${targetDir}`);
        }

        await mkdir(dirname(file.target), {recursive: true});
        if (file.contents !== undefined) {
            const {mode} = await stat(file.source);
            await writeFile(file.target, file.contents, {mode});
        } else {
            await copyFile(file.source, file.target);
        }
    }
}
