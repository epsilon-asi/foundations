import type {RepoTaskResult} from '@epsilon-asi/sandbox';
import {describe, expect, it} from 'vitest';
import {buildRepoAgentPrompt, CONTAINER_LABEL, containerOptionsFor, formatTaskResult, withWorkspace} from '../../src/agents/index.js';
import {DEFAULT_CONTAINER_IMAGE, GlobalConfigSchema} from '../../src/config/global-config.js';
import {buildMiniChangeGraph} from '../../src/graphs/mini-change/index.js';
import {useGitRepo} from '../helpers/gitRepo.js';
import {ScriptedChatModel} from '../helpers/scriptedModel.js';

describe('containerOptionsFor', () => {
    it('runs the default image with the npm cache mounted, as the given user', () => {
        expect(containerOptionsFor(GlobalConfigSchema.parse({}), {cacheDir: '/cache', user: '501:20'})).toEqual({
            image: DEFAULT_CONTAINER_IMAGE,
            preset: 'node-typescript',
            installCachePath: '/cache',
            env: {HOME: '/tmp'},
            labels: {[CONTAINER_LABEL]: 'true'},
            user: '501:20',
        });
    });

    it('takes the image from the config, and cuts the network when it is off', () => {
        const options = containerOptionsFor(GlobalConfigSchema.parse({container: {image: 'python:3.13', network: false}}), {cacheDir: '/c', user: '1:1'});

        expect(options).toMatchObject({image: 'python:3.13', security: {network: 'none'}});
    });

    it('runs commands as the current user by default', () => {
        const options = containerOptionsFor(GlobalConfigSchema.parse({}), {cacheDir: '/c'});

        expect(options.user).toBe(`${process.getuid!()}:${process.getgid!()}`);
    });
});

describe('formatTaskResult', () => {
    const result = (overrides: Partial<RepoTaskResult>): RepoTaskResult => ({
        binary: 'npm', args: ['run', 'test'], command: ['npm', 'run', 'test'], cwd: '/workspace', exitCode: 0, signal: null,
        stdout: '', stderr: '', timedOut: false, durationMs: 5, skipped: false, ...overrides,
    } as RepoTaskResult);

    it('shows the command, how it ended and its output', () => {
        expect(formatTaskResult(result({stdout: 'ok\n', stderr: 'warn\n'}))).toBe('$ npm run test (exit code 0)\nok\nwarn');
        expect(formatTaskResult(result({exitCode: 1}))).toBe('$ npm run test (exit code 1)');
        expect(formatTaskResult(result({exitCode: null, signal: 'SIGKILL'}))).toBe('$ npm run test (killed by SIGKILL)');
        expect(formatTaskResult(result({exitCode: null, timedOut: true}))).toBe('$ npm run test (timed out)');
    });

    it('keeps the end of long output', () => {
        expect(formatTaskResult(result({stdout: 'a'.repeat(10) + 'END'}), 5)).toBe('$ npm run test (exit code 0)\n... 8 earlier characters cut\naaEND');
    });
});

describe('run_task', () => {
    const repo = useGitRepo({'src/a.ts': 'export const a = 1;\n'});

    it('is offered only when the run has a container', async () => {
        const agent = new ScriptedChatModel(['done']);
        await withWorkspace(buildMiniChangeGraph()).invoke(
            {messages: [{role: 'user', content: 'x'}]},
            {context: {config: GlobalConfigSchema.parse({}), cwd: repo.root, models: {agent}}},
        );

        expect(agent.boundTools).not.toContain('run_task');
        expect(agent.boundTools).toEqual(expect.arrayContaining(['read_file', 'edit_file']));
        expect(agent.calls[0]?.[0]?.text).not.toContain('run_task');
    });

    it('is described in the prompt when the agent has it', () => {
        const config = GlobalConfigSchema.parse({});
        expect(buildRepoAgentPrompt({instructions: 'x', access: 'write', config, cwd: '', canRunTasks: true}))
            .toContain('Run the tests your change affects before you finish');
        expect(buildRepoAgentPrompt({instructions: 'x', access: 'read', config, cwd: '', canRunTasks: true}))
            .toContain('use it when running something settles the question');
    });
});
