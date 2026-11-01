import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  AbstractContainerRuntime,
  type ContainerCreateOptions,
  type ContainerExecOptions,
  type ContainerExecResult,
  type ContainerFilesystemChange,
  type ContainerHandle,
  type ContainerInspection,
  type ContainerRemoveOptions,
  type ContainerWaitResult,
} from '../../src/index.js';

export interface TestRepository {
  readonly root: string;
  readonly repoPath: string;
  git(...args: string[]): string;
  cleanup(): Promise<void>;
}

/** A committed Node project with a passing `npm test` script and one TypeScript source file. */
export async function createTestRepository(): Promise<TestRepository> {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'sandbox-facade-')));
  const repoPath = path.join(root, 'repo');
  await mkdir(path.join(repoPath, 'src'), { recursive: true });
  const git = (...args: string[]): string =>
    execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], {
      cwd: repoPath,
      encoding: 'utf8',
    });

  git('init', '-q', '-b', 'main');
  await writeFile(
    path.join(repoPath, 'package.json'),
    `${JSON.stringify({ name: 'fixture', private: true, scripts: { test: 'node -e "console.log(\'tests ok\')"' } }, null, 2)}\n`,
  );
  await writeFile(path.join(repoPath, 'src', 'greet.ts'), 'export function greet(name: string) {\n  return name;\n}\n');
  git('add', '-A');
  git('commit', '-q', '--no-gpg-sign', '-m', 'initial');

  return { root, repoPath, git, cleanup: () => rm(root, { recursive: true, force: true }) };
}

/** Container runtime double: records lifecycle calls and answers `exec` with a canned success. */
export class RecordingContainerRuntime extends AbstractContainerRuntime {
  override readonly kind = 'recording';
  readonly created: ContainerCreateOptions[] = [];
  readonly execs: ContainerExecOptions[] = [];
  readonly removed: { containerId: string; options: ContainerRemoveOptions | undefined }[] = [];
  startError: Error | undefined;
  removeError: Error | undefined;

  override async isAvailable(): Promise<boolean> {
    return true;
  }
  override async imageExists(): Promise<boolean> {
    return true;
  }
  override pullImage(): Promise<void> {
    return Promise.resolve();
  }
  override async createContainer(options: ContainerCreateOptions): Promise<ContainerHandle> {
    this.created.push(options);
    return {
      id: `container-${this.created.length}`,
      image: options.image,
      workspacePath: options.workspacePath,
      workspaceMountPath: options.workspaceMountPath ?? '/workspace',
      state: 'created',
    };
  }
  override async startContainer(): Promise<void> {
    if (this.startError !== undefined) {
      throw this.startError;
    }
  }
  override stopContainer(): Promise<void> {
    return Promise.resolve();
  }
  override async removeContainer(containerId: string, options?: ContainerRemoveOptions): Promise<void> {
    this.removed.push({ containerId, options });
    if (this.removeError !== undefined) {
      throw this.removeError;
    }
  }
  override async inspectContainer(containerId: string): Promise<ContainerInspection> {
    return { id: containerId, mounts: [], labels: {}, raw: {} };
  }
  override async listContainers(): Promise<ContainerInspection[]> {
    return [];
  }
  override async exec(options: ContainerExecOptions): Promise<ContainerExecResult> {
    this.execs.push(options);
    return {
      binary: 'recording',
      args: [...options.command],
      command: ['recording', ...options.command],
      cwd: '/host',
      exitCode: 0,
      signal: null,
      stdout: `ran ${options.command.join(' ')}`,
      stderr: '',
      durationMs: 1,
      timedOut: false,
      containerId: options.containerId,
    };
  }
  override async getLogs(): Promise<string> {
    return '';
  }
  override async waitForExit(containerId: string): Promise<ContainerWaitResult> {
    return { containerId, exitCode: 0 };
  }
  override copyToContainer(): Promise<void> {
    return Promise.resolve();
  }
  override copyFromContainer(): Promise<void> {
    return Promise.resolve();
  }
  override async diffContainer(): Promise<ContainerFilesystemChange[]> {
    return [];
  }
  override pauseContainer(): Promise<void> {
    return Promise.resolve();
  }
  override unpauseContainer(): Promise<void> {
    return Promise.resolve();
  }
  override killContainer(): Promise<void> {
    return Promise.resolve();
  }
}
