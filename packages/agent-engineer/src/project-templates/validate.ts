import {readFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {planFiles, walkFiles} from './apply.js';
import {FILES_DIR, type LoadedTemplate, loadTemplate, TEMPLATES_DIR, templateFolders} from './registry.js';
import {referencedVariables, resolveVariables, TEMPLATE_SUFFIX, type Variables} from './render.js';
import {BUILT_IN_VARIABLES} from './schema.js';

/** The project name a template is trial-rendered with. */
export const SAMPLE_PROJECT_NAME = 'example-project';

export type TemplateValidation = {
    /** The template's folder name. */
    readonly folder: string;
    /** Every problem found; empty when the template is valid. */
    readonly errors: string[];
};

export type ValidationResult = {
    readonly root: string;
    readonly templates: TemplateValidation[];
    /** Problems with `root` itself, such as it holding no templates. */
    readonly errors: string[];
    readonly valid: boolean;
};

function message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Checks one template:
 * - the manifest exists, matches the schema and its id is the folder name;
 * - `files/` exists, is not empty and holds only regular files and folders;
 * - every `{{var}}` in a file path or `.tmpl` file is built in or declared;
 * - defaults use only the built-in variables;
 * - every declared variable is used somewhere;
 * - a trial render (required variables set, optional ones left to their
 *   defaults) gives valid, distinct paths inside the project.
 */
export async function validateTemplate(dir: string): Promise<string[]> {
    let template: LoadedTemplate;
    try {
        template = await loadTemplate(dir);
    } catch (error) {
        return [message(error)];
    }

    let files: string[];
    try {
        files = await walkFiles(template.filesDir);
    } catch (error) {
        return [message(error)];
    }
    if (files.length === 0) {
        return [`${FILES_DIR}/ is empty`];
    }

    const errors: string[] = [];
    const builtIns: readonly string[] = BUILT_IN_VARIABLES;
    const known = new Set([...builtIns, ...Object.keys(template.variables)]);
    const used = new Set<string>();

    const check = (where: string, names: string[]): void => {
        for (const name of names) {
            used.add(name);
            if (!known.has(name)) {
                errors.push(`${where}: unknown variable {{${name}}}`);
            }
        }
    };

    for (const file of files) {
        check(`${FILES_DIR}/${file} (path)`, referencedVariables(file));
        if (file.endsWith(TEMPLATE_SUFFIX)) {
            check(`${FILES_DIR}/${file}`, referencedVariables(await readFile(join(template.filesDir, file), 'utf8')));
        }
    }

    for (const [key, spec] of Object.entries(template.variables)) {
        if (spec.default !== undefined) {
            for (const name of referencedVariables(spec.default)) {
                if (!builtIns.includes(name)) {
                    errors.push(`variable '${key}': its default may only use ${builtIns.join(', ')}, not {{${name}}}`);
                }
            }
        }
        if (!used.has(key)) {
            errors.push(`variable '${key}' is declared but never used`);
        }
    }

    if (errors.length === 0) {
        const given: Variables = {};
        for (const [key, spec] of Object.entries(template.variables)) {
            if (spec.required) {
                given[key] = 'example';
            }
        }
        try {
            const vars = resolveVariables(template, SAMPLE_PROJECT_NAME, given);
            await planFiles(template, resolve(SAMPLE_PROJECT_NAME), vars);
        } catch (error) {
            errors.push(`trial render: ${message(error)}`);
        }
    }

    return errors;
}

/** Validates every template folder under `root`. */
export async function validateTemplates(root = TEMPLATES_DIR): Promise<ValidationResult> {
    let folders: string[];
    try {
        folders = await templateFolders(root);
    } catch (error) {
        return {root, templates: [], errors: [message(error)], valid: false};
    }

    const errors = folders.length === 0 ? [`no templates found in ${root}`] : [];
    const templates = await Promise.all(
        folders.map(async (folder) => ({folder, errors: await validateTemplate(join(root, folder))})),
    );

    return {root, templates, errors, valid: errors.length === 0 && templates.every((t) => t.errors.length === 0)};
}

/** A human-readable report: one line per template, its errors indented below it. */
export function formatValidation(result: ValidationResult): string {
    const lines = [`Validating templates in ${result.root}`];
    for (const error of result.errors) {
        lines.push(`  error: ${error}`);
    }
    for (const template of result.templates) {
        lines.push(`  ${template.errors.length === 0 ? 'ok    ' : 'failed'}  ${template.folder}`);
        for (const error of template.errors) {
            lines.push(`            - ${error}`);
        }
    }
    const failed = result.templates.filter((t) => t.errors.length > 0).length;
    lines.push(
        result.valid
            ? `${result.templates.length} template(s) valid.`
            : `${failed} of ${result.templates.length} template(s) failed.`,
    );
    return `${lines.join('\n')}\n`;
}
