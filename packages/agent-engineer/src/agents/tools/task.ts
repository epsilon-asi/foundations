import {createDefaultRepoRunnerRegistry, type RepoRunner, type RepoTaskResult} from '@epsilon-asi/sandbox';
import {join} from 'node:path';
import {z} from 'zod/v4';
import {defineRepoTool, type RepoToolkit} from './shared.js';

/** Characters of a task's output the model sees; the end is kept, since that is where failures are summarized. */
export const DEFAULT_TASK_OUTPUT_CHARS = 12_000;

/** Formats a finished task for the model: the command, how it ended, and the end of its output. */
export const formatTaskResult = (result: RepoTaskResult, limit = DEFAULT_TASK_OUTPUT_CHARS): string => {
    const outcome = result.timedOut ? 'timed out' : result.exitCode === null ? `killed by ${result.signal ?? 'a signal'}` : `exit code ${result.exitCode}`;
    const output = [result.stdout.trimEnd(), result.stderr.trimEnd()].filter(Boolean).join('\n');
    const shown = output.length > limit ? `... ${output.length - limit} earlier characters cut\n${output.slice(-limit)}` : output;
    return `$ ${result.command.join(' ')} (${outcome})${shown === '' ? '' : `\n${shown}`}`;
};

/**
 * `run_task`: runs a repository task (test, build, lint, a package script, ...) where the sandbox runs commands.
 * Agents only get it when that is a container, so code an agent wrote never runs on the host. Dependencies are
 * installed in a directory the first time a task runs there.
 */
export const createTaskTools = (toolkit: RepoToolkit) => {
    const runners = new Map<string, Promise<{ runner: RepoRunner; install: RepoTaskResult }>>();

    /** The runner for a directory, with its dependencies installed. */
    const prepare = (directory: string) => {
        let prepared = runners.get(directory);
        if (prepared === undefined) {
            prepared = (async () => {
                const runner = await createDefaultRepoRunnerRegistry({
                    executor: toolkit.sandbox.executor,
                    defaultTimeoutMs: toolkit.config.container.taskTimeoutSeconds * 1000,
                }).detect(join(toolkit.sandbox.worktreePath, directory));
                toolkit.progress(`installing dependencies in ${directory || '.'}`);
                const install = await runner.installDependencies({allowNonZeroExit: true});
                return {runner, install};
            })();
            // A failed detection or install is tried again on the next call rather than remembered.
            prepared.catch(() => runners.delete(directory));
            runners.set(directory, prepared);
        }
        return prepared;
    };

    return [
        defineRepoTool(toolkit, {
            name: 'run_task',
            serial: true,
            description: [
                'Run a repository task, such as test, build, lint, typecheck or any package script, in the sandbox\'s',
                'container, and see its output. Dependencies are installed the first time a task runs in a directory.',
            ].join(' '),
            schema: z.object({
                task: z.string().min(1).describe('The task or script name, e.g. "test".'),
                directory: z.string().optional().describe('Repository-relative directory to run it in. Default: the directory the user ran you from.'),
                args: z.array(z.string()).optional().describe('Extra arguments for the task, e.g. a test file.'),
            }),
            describe: ({task, directory}) => `running ${task} in ${directory ?? (toolkit.runDirectory || '.')}`,
            async run({task, directory, args}) {
                const dir = directory === undefined ? toolkit.runDirectory : directory === '' || directory === '.' ? '' : toolkit.resolvePath(directory).path;
                const {runner, install} = await prepare(dir);
                if (install.exitCode !== 0 || install.timedOut) {
                    runners.delete(dir);
                    return `Installing dependencies failed, so ${task} did not run.\n${formatTaskResult(install)}`;
                }
                const result = await runner.runNamedTask(task, {allowNonZeroExit: true, missingTaskBehavior: 'skip', ...(args === undefined ? {} : {args})});
                if (result.skipped) {
                    const tasks = Object.keys(await runner.getTaskDefinitions());
                    return `There is no task named ${task} in ${dir || '.'}. Its tasks: ${tasks.length === 0 ? 'none' : tasks.join(', ')}.`;
                }
                return formatTaskResult(result);
            },
        }),
    ];
};
