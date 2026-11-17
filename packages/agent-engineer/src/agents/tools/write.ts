import {existsSync} from 'node:fs';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {z} from 'zod/v4';
import {defineRepoTool, type RepoToolkit} from './shared.js';

/**
 * Tools that change files in the sandbox's worktree. The checkout the CLI ran in is never touched, and no more than
 * the config's `maxOutputFiles` distinct files can be changed in one run.
 */
export const createWriteTools = (toolkit: RepoToolkit) => {
    /** Resolves a path to change, refusing once the run has changed `maxOutputFiles` other files. */
    const writable = (path: string) => {
        const resolved = toolkit.resolvePath(path);
        const limit = toolkit.config.maxOutputFiles;
        if (!toolkit.changedFiles.has(resolved.path) && toolkit.changedFiles.size >= limit) {
            throw new Error(`This run may change at most ${limit} files; it has changed ${[...toolkit.changedFiles].join(', ')}.`);
        }
        return resolved;
    };

    /** Resolves a path to change that must already exist. */
    const existing = (path: string) => {
        const resolved = writable(path);
        if (!existsSync(resolved.absolutePath)) {
            throw new Error(`${resolved.path} does not exist.`);
        }
        return resolved;
    };

    return [
        defineRepoTool(toolkit, {
            name: 'write_file',
            serial: true,
            description: 'Create a file, or replace all of its contents; it is ended with a newline. Prefer edit_file for changes to part of an existing file.',
            schema: z.object({path: z.string().describe('Repository-relative path.'), content: z.string()}),
            describe: ({path}) => `writing ${path}`,
            async run({path, content}) {
                const resolved = writable(path);
                await mkdir(dirname(resolved.absolutePath), {recursive: true});
                // Files end with a newline, as linters expect; models often leave it off.
                await writeFile(resolved.absolutePath, content === '' || content.endsWith('\n') ? content : `${content}\n`);
                toolkit.touched(resolved.path);
                return `Wrote ${resolved.path}.`;
            },
        }),
        defineRepoTool(toolkit, {
            name: 'edit_file',
            serial: true,
            description: [
                'Replace exact text in a file. oldText must match the file exactly, whitespace included, and occur once',
                'unless replaceAll is true. Read the file first.',
            ].join(' '),
            schema: z.object({
                path: z.string().describe('Repository-relative path.'),
                oldText: z.string().min(1),
                newText: z.string(),
                replaceAll: z.boolean().optional().describe('Default: false.'),
            }),
            describe: ({path}) => `editing ${path}`,
            async run({path, oldText, newText, replaceAll = false}) {
                const resolved = existing(path);
                const content = await readFile(resolved.absolutePath, 'utf8');
                const count = content.split(oldText).length - 1;
                if (count === 0) {
                    throw new Error(`oldText was not found in ${resolved.path}. Read the file again and copy the text exactly.`);
                }
                if (count > 1 && !replaceAll) {
                    throw new Error(`oldText occurs ${count} times in ${resolved.path}. Include more context, or set replaceAll.`);
                }
                await writeFile(resolved.absolutePath, replaceAll ? content.split(oldText).join(newText) : content.replace(oldText, () => newText));
                toolkit.touched(resolved.path);
                return `Replaced ${replaceAll ? count : 1} occurrence${count > 1 && replaceAll ? 's' : ''} in ${resolved.path}.`;
            },
        }),
        defineRepoTool(toolkit, {
            name: 'delete_file',
            serial: true,
            description: 'Delete a file.',
            schema: z.object({path: z.string().describe('Repository-relative path.')}),
            describe: ({path}) => `deleting ${path}`,
            async run({path}) {
                const resolved = existing(path);
                await rm(resolved.absolutePath);
                toolkit.touched(resolved.path);
                return `Deleted ${resolved.path}.`;
            },
        }),
    ];
};
