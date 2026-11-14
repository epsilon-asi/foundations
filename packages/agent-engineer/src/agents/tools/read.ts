import {z} from 'zod/v4';
import {defineRepoTool, formatSearchResults, type RepoToolkit} from './shared.js';

/** Results a search tool returns when the model does not ask for a number. */
export const DEFAULT_MAX_SEARCH_RESULTS = 12;

/** How listings mark a file that exists but is too large or not text to read. */
export const UNREADABLE = '(too large or not text to read)';

/** Lines `read_file` returns when the model gives no end line. */
export const DEFAULT_READ_LINES = 400;

/** Entries `list_directory` shows before it truncates. */
export const DEFAULT_MAX_LISTED_ENTRIES = 200;

const SEARCH_METHODS = ['hybrid', 'text', 'regex', 'path', 'bm25', 'similarity', 'symbol', 'dependency'] as const;

const SYMBOL_KINDS = [
    'function', 'method', 'class', 'interface', 'type', 'enum', 'variable', 'constant', 'module', 'namespace',
    'struct', 'trait', 'impl', 'property',
] as const;

const maxResults = z.number().int().min(1).max(50).optional().describe(`Default: ${DEFAULT_MAX_SEARCH_RESULTS}.`);
const scope = z.array(z.string()).optional().describe('Only search paths matching these globs, e.g. ["packages/sandbox/**"].');

/**
 * Read-only tools over the sandbox's worktree: listing directories, searching code and symbols, and reading files.
 * Only files the code search indexed as text can be read, so ignored, oversized, binary and off-limits files stay
 * out of reach. Listings still show oversized and binary files, marked as unreadable.
 */
export const createReadTools = (toolkit: RepoToolkit) => [
    defineRepoTool(toolkit, {
        name: 'list_directory',
        description: [
            'List the files and directories directly inside a directory of the repository. Use "" or "." for the root.',
            `Files marked "${UNREADABLE}" exist but are too large or not text for read_file and search.`,
        ].join(' '),
        schema: z.object({path: z.string().describe('Repository-relative directory.')}),
        describe: ({path}) => `listing ${path || '.'}`,
        async run({path}) {
            const directory = path === '' || path === '.' ? '' : `${toolkit.resolvePath(path).path}/`;
            const entries = new Map<string, string>();
            for (const file of await toolkit.files()) {
                if (file.path.startsWith(directory)) {
                    const [first, ...rest] = file.path.slice(directory.length).split('/');
                    const entry = rest.length > 0 ? `${first}/` : first!;
                    entries.set(entry, rest.length > 0 || file.readable ? entry : `${entry} ${UNREADABLE}`);
                }
            }
            if (entries.size === 0) {
                return `No files under ${path || '.'}.`;
            }
            const sorted = [...entries.keys()].sort().map((entry) => entries.get(entry)!);
            const shown = sorted.slice(0, DEFAULT_MAX_LISTED_ENTRIES).join('\n');
            return sorted.length > DEFAULT_MAX_LISTED_ENTRIES ? `${shown}\n... ${sorted.length - DEFAULT_MAX_LISTED_ENTRIES} more` : shown;
        },
    }),
    defineRepoTool(toolkit, {
        name: 'find_files',
        description: 'Find files whose path matches a query (fuzzy, e.g. "router graph" or "sandbox.ts").',
        schema: z.object({query: z.string(), maxResults}),
        describe: ({query}) => `finding files: ${query}`,
        async run({query, maxResults = DEFAULT_MAX_SEARCH_RESULTS}) {
            const ranked = (await toolkit.search()).searchPaths(query, {maxResults}).map((result) => result.path);
            // The search only ranks files it indexed; files too large or not text are matched by their words.
            const words = query.toLowerCase().split(/\s+/).filter(Boolean);
            const unreadable = (await toolkit.files())
                .filter((file) => !file.readable && words.length > 0 && words.every((word) => file.path.toLowerCase().includes(word)))
                .map((file) => `${file.path} ${UNREADABLE}`);
            const found = [...ranked, ...unreadable].slice(0, maxResults);
            return found.length === 0 ? 'No files found.' : found.join('\n');
        },
    }),
    defineRepoTool(toolkit, {
        name: 'search_code',
        description: [
            'Search file contents. "hybrid" (the default) fuses literal, ranked and symbol search and suits natural-language queries;',
            '"text" is an exact literal match and "regex" a regular expression.',
        ].join(' '),
        schema: z.object({
            query: z.string(),
            method: z.enum(SEARCH_METHODS).optional().describe('Default: hybrid.'),
            include: scope,
            maxResults,
        }),
        describe: ({query}) => `searching: ${query}`,
        async run({query, method = 'hybrid', include, maxResults = DEFAULT_MAX_SEARCH_RESULTS}) {
            const results = await (await toolkit.search()).search(method, query, {
                maxResults,
                contextBefore: 1,
                contextAfter: 3,
                ...(include === undefined ? {} : {include}),
            });
            return formatSearchResults(results);
        },
    }),
    defineRepoTool(toolkit, {
        name: 'find_definition',
        description: 'Find where a function, class, interface, type, variable or other symbol is declared.',
        schema: z.object({name: z.string(), kind: z.enum(SYMBOL_KINDS).optional(), maxResults}),
        describe: ({name}) => `finding definition of ${name}`,
        async run({name, kind, maxResults = DEFAULT_MAX_SEARCH_RESULTS}) {
            const results = (await toolkit.search()).findDefinition(name, {maxResults, ...(kind === undefined ? {} : {kind})});
            return formatSearchResults(results);
        },
    }),
    defineRepoTool(toolkit, {
        name: 'find_references',
        description: 'Find where a symbol is used, as whole-word matches across the repository.',
        schema: z.object({name: z.string(), include: scope, maxResults}),
        describe: ({name}) => `finding references to ${name}`,
        async run({name, include, maxResults = DEFAULT_MAX_SEARCH_RESULTS}) {
            const results = await (await toolkit.search()).findReferences(name, {maxResults, ...(include === undefined ? {} : {include})});
            return formatSearchResults(results);
        },
    }),
    defineRepoTool(toolkit, {
        name: 'read_file',
        description: 'Read a file, or a range of its lines, with line numbers. Omit the lines to read it from the top.',
        schema: z.object({
            path: z.string().describe('Repository-relative path.'),
            startLine: z.number().int().min(1).optional(),
            endLine: z.number().int().min(1).optional(),
        }),
        describe: ({path}) => `reading ${path}`,
        async run({path, startLine, endLine}) {
            const resolved = toolkit.resolvePath(path);
            const search = await toolkit.search();
            if (!search.documents.some((document) => document.path === resolved.path)) {
                throw new Error(`${resolved.path} does not exist, or is ignored, too large or not text.`);
            }
            const file = await search.openFile(resolved.path, {
                line: startLine ?? 1,
                ...(endLine === undefined ? {endLine: (startLine ?? 1) + DEFAULT_READ_LINES - 1} : {endLine}),
            });
            const remaining = file.totalLines - file.endLine;
            const more = remaining > 0 ? `\n... ${remaining} more line${remaining === 1 ? '' : 's'}` : '';
            return `${file.path} (lines ${file.line}-${file.endLine} of ${file.totalLines})\n${file.numberedText}${more}`;
        },
    }),
];
