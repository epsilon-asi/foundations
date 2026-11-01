import { describe, expect, it } from 'vitest';

import type { RepoRunner } from '../../../src/repo-runner/contracts/runner.js';
import { MissingTaskError } from '../../../src/repo-runner/errors/repoRunnerErrors.js';
import { createDefaultRepoRunnerRegistry } from '../../../src/repo-runner/registry/createDefaultRegistry.js';
import { fixturePath, RecordingCommandExecutor } from '../helpers/testUtils.js';

const FIXTURES = [
  'node-basic',
  'node-no-build-script',
  'python-uv-basic',
  'python-uv-no-build',
  'python-uv-scripted',
  'go-basic',
  'terraform-basic',
];

/** Task names any built-in runner might plausibly accept, plus names none of them define. */
const CANDIDATE_TASKS = [
  'test',
  'build',
  'lint',
  'typecheck',
  'hello',
  'pytest',
  'ruff',
  'mypy',
  'pyright',
  'vet',
  'tidy',
  'generate',
  'validate',
  'fmt',
  'plan',
  'apply',
  'missing',
];

async function isRunnable(runner: RepoRunner, task: string): Promise<boolean> {
  try {
    await runner.runNamedTask(task);
    return true;
  } catch (error) {
    if (error instanceof MissingTaskError) {
      return false;
    }
    throw error;
  }
}

describe('task contract (getTaskDefinitions ⇔ runNamedTask)', () => {
  it.each(FIXTURES)('%s: every advertised task is runnable and every runnable task is advertised', async (fixture) => {
    const executor = new RecordingCommandExecutor();
    const runner = await createDefaultRepoRunnerRegistry({ executor }).detect(fixturePath(fixture));
    const advertised = await runner.getTaskDefinitions();

    for (const task of new Set([...CANDIDATE_TASKS, ...Object.keys(advertised)])) {
      expect(await isRunnable(runner, task), `${fixture}: ${task}`).toBe(Object.hasOwn(advertised, task));
    }
  });

  it.each(FIXTURES)('%s: the description of non-npm tasks is the command that runs', async (fixture) => {
    const executor = new RecordingCommandExecutor();
    const runner = await createDefaultRepoRunnerRegistry({ executor }).detect(fixturePath(fixture));
    if (runner.kind === 'node-typescript') {
      return;
    }

    for (const [task, description] of Object.entries(await runner.getTaskDefinitions())) {
      await runner.runNamedTask(task);
      const call = executor.calls.at(-1);
      expect([call?.binary, ...(call?.args ?? [])].join(' '), task).toBe(description);
    }
  });
});
