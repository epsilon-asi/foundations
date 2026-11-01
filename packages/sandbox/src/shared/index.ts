// Public part of the shared layer; re-exported by the package root and by each library entry point.
export { ChildProcessCommandExecutor, KILL_GRACE_PERIOD_MS } from './childProcessExecutor.js';
export { describeOutcome, formatCommand, isSuccessfulResult } from './command.js';
export type {
  CommandExecutionOptions,
  CommandExecutionResult,
  CommandExecutor,
  EnvironmentOverrides,
} from './command.js';
export { commandExists } from './commandLookup.js';
export type { CommandLookupOptions } from './commandLookup.js';
export { CommandExecutionError, CommandFailedError, SandboxError, ensureSuccess } from './errors.js';
export type { CommandErrorContext } from './errors.js';
