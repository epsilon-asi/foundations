import {loadFile} from '@epsilon-asi/foundation/files';
import {existsSync} from 'node:fs';
import {readdir, stat} from 'node:fs/promises';
import {basename, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {type ProjectTemplate, ProjectTemplateSchema, TEMPLATE_ID} from './schema.js';

/** The built-in templates. Resolves to `<package>/templates` from both `src/` (tsx) and `dist/`. */
export const TEMPLATES_DIR = fileURLToPath(new URL('../../templates', import.meta.url));

/** Each template folder holds this manifest... */
export const MANIFEST_FILE = 'template.yaml';

/** ...and this folder, which is the project exactly as it is generated. */
export const FILES_DIR = 'files';

export type LoadedTemplate = ProjectTemplate & {
    /** The template's folder. */
    readonly dir: string;
    /** Its `files/` folder. */
    readonly filesDir: string;
};

/**
 * Loads the template in `dir`. Throws when the manifest is missing or invalid,
 * when its `id` is not the folder name, or when there is no `files/` folder.
 */
export async function loadTemplate(dir: string): Promise<LoadedTemplate> {
    const manifestPath = join(dir, MANIFEST_FILE);
    if (!existsSync(manifestPath)) {
        throw new Error(`${dir} has no ${MANIFEST_FILE}`);
    }

    const manifest = await loadFile(manifestPath, ProjectTemplateSchema);

    const folder = basename(dir);
    if (manifest.id !== folder) {
        throw new Error(`${manifestPath}: id '${manifest.id}' must match its folder name '${folder}'`);
    }

    const filesDir = join(dir, FILES_DIR);
    if (!existsSync(filesDir) || !(await stat(filesDir)).isDirectory()) {
        throw new Error(`${dir} has no ${FILES_DIR}/ folder`);
    }

    return {...manifest, dir, filesDir};
}

/** The folder names under `root` that could be templates, sorted. Hidden folders are skipped. */
export async function templateFolders(root = TEMPLATES_DIR): Promise<string[]> {
    const entries = await readdir(root, {withFileTypes: true});
    return entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => entry.name)
        .sort();
}

/** Every template under `root`, sorted by id. Throws on the first invalid one. */
export async function listTemplates(root = TEMPLATES_DIR): Promise<LoadedTemplate[]> {
    const folders = await templateFolders(root);
    return Promise.all(folders.map((folder) => loadTemplate(join(root, folder))));
}

/** The template with this id. Throws, listing the available ids, when there is none. */
export async function getTemplate(id: string, root = TEMPLATES_DIR): Promise<LoadedTemplate> {
    const folders = await templateFolders(root);
    if (!TEMPLATE_ID.test(id) || !folders.includes(id)) {
        throw new Error(
            `Unknown template '${id}'. Available: ${folders.length > 0 ? folders.join(', ') : '(none)'}`,
        );
    }
    return loadTemplate(join(root, id));
}
