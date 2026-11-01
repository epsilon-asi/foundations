import path from 'node:path';

import { mergeEnvironment } from '../shared/command.js';
import { canonicalPath } from '../shared/fs.js';
import type { CommandExecutionOptions, CommandExecutionResult, CommandExecutor } from '../shared/index.js';
import { omitUndefined } from '../shared/objects.js';
import type { AbstractContainerRuntime } from './abstractContainerRuntime.js';
import type { ContainerHandle } from './types.js';

/** Constructor options for {@link ContainerCommandExecutor}. */
export interface ContainerCommandExecutorOptions {
  /** Runtime whose `exec` runs the commands (any `AbstractContainerRuntime`). */
  readonly runtime: Pick<AbstractContainerRuntime, 'exec'>;
  /** Running container; host paths under `workspacePath` map to the same paths under `workspaceMountPath`. */
  readonly container: Pick<ContainerHandle, 'id' | 'workspacePath' | 'workspaceMountPath'>;
  /** User that commands run as inside the container. Default: the image's user. */
  readonly user?: string;
  /** Environment for every command; each run's `env` is layered on top. */
  readonly env?: Readonly<Record<string, string>>;
}

/**
 * A `CommandExecutor` that runs every command inside an existing container through `runtime.exec`, so anything
 * that accepts an executor (repository runners, code search, git) runs in the container instead of on the host.
 *
 * - `cwd`: omitted → the workspace mount; a host path equal to or inside `workspacePath` → the same relative path
 *   under `workspaceMountPath`; a relative path → resolved against `workspaceMountPath`; any other absolute path is
 *   used unchanged as a container path.
 * - `env`: layered over the constructor `env`. An `undefined` value removes a constructor-level variable, but it
 *   cannot unset a variable the container itself defines (image or create-time environment).
 * - `stdin`, `timeoutMs`, `signal` and `maxOutputBytes` apply to the backend client process (e.g. `docker exec`);
 *   a timeout or abort ends that client and may leave the process inside the container running.
 * - The result's `binary`, `args`, `command` and `cwd` describe the command as run inside the container. A missing
 *   container rejects with `ContainerNotFoundError`.
 */
export class ContainerCommandExecutor implements CommandExecutor {
  private readonly runtime: Pick<AbstractContainerRuntime, 'exec'>;
  private readonly container: Pick<ContainerHandle, 'id' | 'workspacePath' | 'workspaceMountPath'>;
  private readonly user: string | undefined;
  private readonly env: Readonly<Record<string, string>>;

  constructor(options: ContainerCommandExecutorOptions) {
    this.runtime = options.runtime;
    this.container = options.container;
    this.user = options.user;
    this.env = options.env ?? {};
  }

  async run(
    binary: string,
    args: readonly string[],
    options: CommandExecutionOptions = {},
  ): Promise<CommandExecutionResult> {
    const { stdin, timeoutMs, signal, maxOutputBytes } = options;
    const command = [binary, ...args];
    const cwd = await this.toContainerPath(options.cwd);
    const env = mergeEnvironment(this.env, options.env);

    const result = await this.runtime.exec({
      containerId: this.container.id,
      command,
      cwd,
      ...omitUndefined({ user: this.user, stdin, timeoutMs, signal, maxOutputBytes }),
      ...(Object.keys(env).length > 0 ? { env } : {}),
    });

    return {
      binary,
      args: [...args],
      command,
      cwd,
      exitCode: result.exitCode,
      signal: result.signal,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
      timedOut: result.timedOut,
    };
  }

  /** Container working directory for a host (or container) `cwd`; see the class documentation. */
  private async toContainerPath(cwd: string | undefined): Promise<string> {
    const { workspacePath, workspaceMountPath } = this.container;
    if (cwd === undefined) {
      return workspaceMountPath;
    }
    if (!path.isAbsolute(cwd)) {
      return underMount(workspaceMountPath, cwd);
    }
    // Compare lexically first; fall back to symlink-resolved paths (e.g. macOS `/tmp` → `/private/tmp`).
    const relative =
      relativeInside(workspacePath, cwd) ??
      relativeInside(await canonicalPath(workspacePath), await canonicalPath(cwd));
    return relative === undefined ? cwd : underMount(workspaceMountPath, relative);
  }
}

/** `target` relative to `root` when it is `root` itself or inside it; otherwise `undefined`. */
function relativeInside(root: string, target: string): string | undefined {
  const relative = path.relative(root, target);
  const outside = relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
  return outside ? undefined : relative;
}

/** Joins a host-relative path onto the container mount path with POSIX separators. */
function underMount(workspaceMountPath: string, relative: string): string {
  return path.posix.join(workspaceMountPath, ...relative.split(path.sep));
}
