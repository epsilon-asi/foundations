import type { TaskCommand } from '../contracts/runner.js';

/** Argument vector for `task` with `forwardedArgs` placed as described on {@link TaskCommand}. */
export function buildTaskArgs(task: TaskCommand, forwardedArgs: readonly string[] = []): string[] {
  const separator = forwardedArgs.length > 0 && task.argsSeparator !== undefined ? [task.argsSeparator] : [];
  return [...task.args, ...separator, ...forwardedArgs, ...(task.trailingArgs ?? [])];
}

/** Default task description: the full command line without forwarded args. */
export function formatTaskCommand(task: TaskCommand): string {
  return [task.binary, ...buildTaskArgs(task)].join(' ');
}
