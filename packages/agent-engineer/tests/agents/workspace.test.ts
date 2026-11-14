import type {CommandExecutor} from '@epsilon-asi/sandbox';
import {chmodSync, existsSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {engineerContext, RepoWorkspace, WORKING_CHANGES_COMMIT_MESSAGE} from '../../src/agents/index.js';
import {GlobalConfigSchema} from '../../src/config/global-config.js';
import {useGitRepo} from '../helpers/gitRepo.js';

const repo = useGitRepo({'pkg/a.ts': 'export const a = 1;\n'});
const config = GlobalConfigSchema.parse({});
const workspaces: RepoWorkspace[] = [];

afterEach(async () => {
    await Promise.all(workspaces.splice(0).map((workspace) => workspace.dispose()));
});

const create = (options: { cwd?: string; executor?: CommandExecutor } = {}) => {
    const workspace = new RepoWorkspace({config, cwd: repo.root, ...options});
    workspaces.push(workspace);
    return workspace;
};
const agentBranches = () => repo.git('branch', '--list', 'agent-engineer/*');
const worktreeCount = () => repo.git('worktree', 'list').split('\n').length;

describe('RepoWorkspace', () => {
    it('does nothing until opened, and can be disposed more than once', async () => {
        const workspace = create();

        expect(workspace.opened).toBe(false);
        await expect(workspace.commit('x')).resolves.toBeUndefined();
        await workspace.dispose();
        await workspace.dispose();
    });

    it('opens one sandbox per run, on a detached HEAD unless a branch is asked for', async () => {
        const workspace = create();
        const sandbox = await workspace.open();

        await expect(workspace.open({branch: 'ignored'})).resolves.toBe(sandbox);
        expect(sandbox.worktree.branchName).toBeNull();
        expect(worktreeCount()).toBe(2);
        await workspace.dispose();
        expect(worktreeCount()).toBe(1);
        expect(existsSync(dirname(sandbox.worktreePath))).toBe(false);
    });

    it('keeps a branch it committed to', async () => {
        const workspace = create();
        const sandbox = await workspace.open({branch: 'keep'});
        writeFileSync(join(sandbox.worktreePath, 'pkg/b.ts'), 'export const b = 2;\n');

        const commit = await workspace.commit('add b');
        await workspace.dispose();

        expect(commit?.branchName).toMatch(/^agent-engineer\/keep-[0-9a-f]{8}$/);
        expect(agentBranches()).toContain(commit!.branchName!);
        expect(repo.git('show', `${commit!.branchName}:pkg/b.ts`)).toBe('export const b = 2;');
    });

    it('deletes a branch nothing was committed to, even with a snapshot of working changes on it', async () => {
        repo.write('pkg/a.ts', 'export const a = 2;\n');
        const workspace = create();
        const sandbox = await workspace.open({branch: 'empty'});
        expect(repo.git('log', '-1', '--format=%s', sandbox.worktree.branchName!)).toBe(WORKING_CHANGES_COMMIT_MESSAGE);

        await expect(workspace.commit('nothing to commit')).resolves.toBeUndefined();
        await workspace.dispose();

        expect(agentBranches()).toBe('');
    });

    it('cleans up everything when the snapshot commit fails', async () => {
        const hook = join(repo.root, '.git/hooks/pre-commit');
        writeFileSync(hook, '#!/bin/sh\necho "hook says no" >&2\nexit 1\n');
        chmodSync(hook, 0o755);
        repo.write('pkg/a.ts', 'export const a = 2;\n');
        const workspace = create();

        await expect(workspace.open({branch: 'hooked'})).rejects.toThrow();
        await workspace.dispose();

        expect(worktreeCount()).toBe(1);
        expect(agentBranches()).toBe('');
    });

    it('still disposes when deleting the unused branch fails', async () => {
        const failing: CommandExecutor = {run: () => Promise.reject(new Error('git is gone'))};
        const workspace = create({executor: failing});
        await workspace.open({branch: 'stuck'});

        await expect(workspace.dispose()).resolves.toBeUndefined();
        expect(worktreeCount()).toBe(1);
        // The branch could not be deleted; nothing else was left behind.
        expect(agentBranches()).toMatch(/agent-engineer\/stuck-/);
    });

    it('reports the run directory relative to the repository root', async () => {
        const workspace = create({cwd: join(repo.root, 'pkg')});
        const sandbox = await workspace.open();

        expect(workspace.cwdIn(sandbox)).toBe('pkg');
        expect(create().cwdIn(sandbox)).toBe('');
    });
});

describe('engineerContext', () => {
    it('fails clearly outside a withWorkspace graph', () => {
        expect(() => engineerContext(undefined)).toThrow('This node needs an engineer context.');
        expect(() => engineerContext({context: {config}})).toThrow('Wrap the graph with withWorkspace()');
        expect(() => engineerContext({context: {workspace: {}}})).toThrow('This node needs an engineer context.');
    });
});
