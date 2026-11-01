import { SandboxError } from '../shared/index.js';

/** Base class for every error raised by repo search; extends the package-wide `SandboxError`. */
export class RepoSearchError extends SandboxError {}

/**
 * A text or regex search was forced to the ripgrep backend (`backend: 'ripgrep'`) and ripgrep failed. The `cause` is
 * the shared `CommandFailedError` (bad exit code, signal, or timeout) or `CommandExecutionError` (spawn failure or
 * output limit).
 */
export class RipgrepError extends RepoSearchError {}

/** A language-server request failed or timed out, or the language server process could not start or stopped. */
export class LspError extends RepoSearchError {}
