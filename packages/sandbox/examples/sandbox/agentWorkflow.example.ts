import {
  Sandbox,
  type CreateSandboxOptions,
  type GitCommitInfo,
  type GitDiffNameStatusEntry,
} from '../../src/index.js';

export interface AgentWorkflowResult {
  readonly testsPassed: boolean;
  readonly changedFiles: readonly GitDiffNameStatusEntry[];
  readonly patch: string;
  /** Present when the tests passed and the change was committed to the sandbox branch. */
  readonly commit: GitCommitInfo | undefined;
}

/**
 * A typical coding-agent loop: isolate the repository in a sandbox (optionally inside a container), install,
 * let the agent edit, verify with the project's own tests, inspect the change, and commit it on a branch.
 * `await using` removes the container and the worktree afterwards; the branch and its commit remain.
 */
export async function agentWorkflowExample(
  options: Pick<CreateSandboxOptions, 'repoPath' | 'worktreePath' | 'container'>,
  edit: (worktreePath: string) => Promise<void>,
): Promise<AgentWorkflowResult> {
  await using sandbox = await Sandbox.create({ ...options, branchName: 'agent/example' });

  await sandbox.installDependencies();
  await edit(sandbox.worktreePath);

  const tests = await sandbox.runTask('test', { allowNonZeroExit: true });
  const testsPassed = tests.exitCode === 0;
  const changedFiles = await sandbox.changedFiles();
  const patch = await sandbox.diff();
  const commit = testsPassed ? await sandbox.commit({ message: 'agent: apply change' }) : undefined;

  return { testsPassed, changedFiles, patch, commit };
}
