import type {SearchResult} from '@epsilon-asi/sandbox';
import type {Sandbox} from '@epsilon-asi/sandbox';
import {describe, expect, it} from 'vitest';
import {buildRepoAgentPrompt, DEFAULT_PREVIEW_LINES, formatSearchResults, recursionLimitFor, RepoToolkit} from '../../src/agents/index.js';
import {GlobalConfigSchema} from '../../src/config/global-config.js';

const config = GlobalConfigSchema.parse({});

describe('buildRepoAgentPrompt', () => {
    it('includes the instructions and the rules for read access', () => {
        const prompt = buildRepoAgentPrompt({instructions: 'Answer it.', access: 'read', config, cwd: 'packages/x'});

        expect(prompt).toContain('Answer it.');
        expect(prompt).toContain('You can read the repository but not change it.');
        expect(prompt).not.toContain('write_file');
        expect(prompt).toContain('The user ran you from packages/x/;');
    });

    it('describes the write tools and the branch for write access', () => {
        const prompt = buildRepoAgentPrompt({instructions: 'Fix it.', access: 'write', config, cwd: ''});

        expect(prompt).toContain('write_file, edit_file and delete_file');
        expect(prompt).toContain('committed when you finish');
        expect(prompt).toContain('The user ran you from the repository root;');
    });

    it('lists the default context, marking required paths, with paths as the tools take them', () => {
        const prompt = buildRepoAgentPrompt({
            instructions: 'x',
            access: 'read',
            cwd: 'packages/app',
            config: GlobalConfigSchema.parse({
                defaultContext: [
                    {kind: 'path', path: '../../docs/RULES.md', required: true, description: 'House rules'},
                    {kind: 'path', path: 'notes.md'},
                    {kind: 'path', path: '../../../outside.md'},
                    {kind: 'pattern', pattern: 'src/**/*.ts', description: 'The source'},
                ],
            }),
        });

        expect(prompt).toContain([
            'The project points every agent at this context:',
            '- path docs/RULES.md (required: read it before you answer): House rules',
            '- path packages/app/notes.md',
            // Outside the repository: left as written, and read_file will refuse it.
            '- path ../../../outside.md',
            '- files matching src/**/*.ts: The source',
        ].join('\n'));
    });

    it('leaves the default context out when there is none', () => {
        expect(buildRepoAgentPrompt({instructions: 'x', access: 'read', config, cwd: ''})).not.toContain('points every agent');
    });
});

describe('formatSearchResults', () => {
    const result = (overrides: Partial<SearchResult>): SearchResult => ({
        method: 'text', path: 'src/a.ts', absolutePath: '/r/src/a.ts', score: 1, line: 3, endLine: 3, language: 'typescript',
        preview: 'const a = 1;', contextBefore: [], contextAfter: [], matches: [], ...overrides,
    });

    it('says when there are no results', () => {
        expect(formatSearchResults([])).toBe('No results.');
    });

    it('heads each result with path:line, or a line range, and indents its preview', () => {
        expect(formatSearchResults([result({}), result({path: 'src/b.ts', line: 1, endLine: 4, preview: 'a\nb'})])).toBe(
            'src/a.ts:3\n    const a = 1;\n\nsrc/b.ts:1-4\n    a\n    b',
        );
    });

    it(`shows at most ${DEFAULT_PREVIEW_LINES} preview lines by default`, () => {
        const preview = Array.from({length: 10}, (_, index) => `line ${index}`).join('\n');
        expect(formatSearchResults([result({preview})]).split('\n')).toHaveLength(1 + DEFAULT_PREVIEW_LINES);
        expect(formatSearchResults([result({preview})], 2).split('\n')).toHaveLength(3);
    });
});

describe('recursionLimitFor', () => {
    it('allows a model step and a tool step per round, and two for the answer', () => {
        expect(recursionLimitFor(0)).toBe(2);
        expect(recursionLimitFor(60)).toBe(122);
    });
});

describe('RepoToolkit.serial', () => {
    const toolkit = new RepoToolkit({sandbox: {worktreePath: '/r'} as unknown as Sandbox, config});

    it('runs tasks one at a time in the order they were queued', async () => {
        const events: string[] = [];
        const task = (name: string, ms: number) => async () => {
            events.push(`start ${name}`);
            await new Promise((resolve) => setTimeout(resolve, ms));
            events.push(`end ${name}`);
            return name;
        };

        await expect(Promise.all([toolkit.serial(task('a', 20)), toolkit.serial(task('b', 1)), toolkit.serial(task('c', 5))]))
            .resolves.toEqual(['a', 'b', 'c']);
        expect(events).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
    });

    it('keeps going after a task fails', async () => {
        const failed = toolkit.serial(async () => {
            throw new Error('first');
        });
        const next = toolkit.serial(async () => 'second');

        await expect(failed).rejects.toThrow('first');
        await expect(next).resolves.toBe('second');
    });
});
