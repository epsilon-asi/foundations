/**
 * Manual smoke check against a real repository: detects its runner, prints the parsed config, install
 * plan and tasks, then optionally installs dependencies and runs tasks for real. Stops at the first failure.
 *
 * Usage (from the project root):
 *   npm run smoke -- <repoPath> [--install] [task ...]
 */
import { parseArgs } from 'node:util';

import {
  CommandExecutionError,
  createDefaultRepoRunnerRegistry,
  isSuccessfulResult,
  type RepoTaskResult,
} from '../src/repo-runner/index.js';
import { describeOutcome, formatCommand } from '../src/shared/index.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { install: { type: 'boolean', default: false } },
});
const [repoPath, ...tasks] = positionals;
if (repoPath === undefined) {
  console.error('Usage: npm run smoke -- <repoPath> [--install] [task ...]');
  process.exit(2);
}

/** Prints the result and returns whether the run may continue. */
function report(label: string, result: RepoTaskResult): boolean {
  const status = result.skipped ? `skipped (${result.skipReason ?? ''})` : describeOutcome(result);
  console.log(`\n$ ${result.skipped ? label : formatCommand(result.command)} -> ${status} in ${result.durationMs} ms`);
  if (result.stdout.trim() !== '') {
    console.log(result.stdout.trimEnd());
  }
  if (result.stderr.trim() !== '') {
    console.error(result.stderr.trimEnd());
  }
  return isSuccessfulResult(result);
}

const runner = await createDefaultRepoRunnerRegistry().detect(repoPath);
console.log(`kind: ${runner.kind}`);
console.log('config:', JSON.stringify(await runner.getRepoConfig(), null, 2));
console.log('install plan:', await runner.getPreferredInstallPlan());
console.log('tasks:', await runner.getTaskDefinitions());

try {
  let ok = !values.install || report('install', await runner.installDependencies({ allowNonZeroExit: true }));
  for (const task of tasks) {
    if (!ok) {
      break;
    }
    ok = report(task, await runner.runNamedTask(task, { missingTaskBehavior: 'skip', allowNonZeroExit: true }));
  }
  if (!ok) {
    process.exitCode = 1;
  }
} catch (error) {
  if (!(error instanceof CommandExecutionError)) {
    throw error;
  }
  console.error(`\n${error.message}`);
  process.exitCode = 1;
}
