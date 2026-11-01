import { SandboxError } from '../../shared/index.js';

/** Base class of every error specific to the repo runners. Command failures use the shared `CommandFailedError`. */
export class RepoRunnerError extends SandboxError {}

/** A runner was used on a repository its `detect()` does not recognise. */
export class UnsupportedRepositoryError extends RepoRunnerError {
  public readonly kind: string;
  public readonly repoPath: string;

  public constructor(kind: string, repoPath: string, options?: ErrorOptions) {
    super(`Repository at ${repoPath} is not compatible with runner kind "${kind}".`, options);
    this.kind = kind;
    this.repoPath = repoPath;
  }
}

/** The requested task is not defined for the repository. */
export class MissingTaskError extends RepoRunnerError {
  public readonly taskName: string;
  public readonly repoPath: string;
  public readonly availableTasks: readonly string[];

  public constructor(
    taskName: string,
    repoPath: string,
    availableTasks: readonly string[] = [],
    options?: ErrorOptions,
  ) {
    const available = availableTasks.length > 0 ? ` Available tasks: ${availableTasks.join(', ')}.` : '';
    super(`Task "${taskName}" was not found in repository ${repoPath}.${available}`, options);
    this.taskName = taskName;
    this.repoPath = repoPath;
    this.availableTasks = availableTasks;
  }
}

/** A repository config file could not be parsed or failed validation. */
export class RepoConfigParseError extends RepoRunnerError {
  public readonly filePath: string;

  public constructor(filePath: string, message: string, options?: ErrorOptions) {
    super(`Failed to parse ${filePath}: ${message}`, options);
    this.filePath = filePath;
  }
}
