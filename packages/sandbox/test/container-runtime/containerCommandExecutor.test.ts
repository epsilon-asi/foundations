import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ContainerCommandExecutor,
  ContainerNotFoundError,
  DockerContainerRuntime,
  type AbstractContainerRuntime,
  type ContainerExecOptions,
  type ContainerExecResult,
} from '../../src/container-runtime/index.js';
import { RecordingCommandExecutor } from './fixtures/recordingCommandExecutor.js';

const WORKSPACE = path.resolve('/host/repo');
const CONTAINER = { id: 'ctr-1', workspacePath: WORKSPACE, workspaceMountPath: '/workspace' };

/** A runtime whose `exec` records each request and answers with `reply` (or throws it). */
class FakeExecRuntime implements Pick<AbstractContainerRuntime, 'exec'> {
  readonly requests: ContainerExecOptions[] = [];
  private readonly reply: Partial<ContainerExecResult> | Error;

  constructor(reply: Partial<ContainerExecResult> | Error = {}) {
    this.reply = reply;
  }

  async exec(options: ContainerExecOptions): Promise<ContainerExecResult> {
    this.requests.push(options);
    if (this.reply instanceof Error) {
      throw this.reply;
    }
    return {
      binary: 'docker',
      args: ['container', 'exec', options.containerId, ...options.command],
      command: ['docker', 'container', 'exec', options.containerId, ...options.command],
      cwd: '/host/cli-cwd',
      exitCode: 0,
      signal: null,
      stdout: '',
      stderr: '',
      durationMs: 3,
      timedOut: false,
      containerId: options.containerId,
      ...this.reply,
    };
  }
}

describe('ContainerCommandExecutor', () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it('runs in the workspace mount by default and describes the command run inside the container', async () => {
    const runtime = new FakeExecRuntime({ exitCode: 2, stdout: 'out', stderr: 'err', durationMs: 9 });
    const executor = new ContainerCommandExecutor({ runtime, container: CONTAINER, user: 'node' });

    const result = await executor.run('npm', ['test', '--', 'a b']);

    expect(runtime.requests).toEqual([
      { containerId: 'ctr-1', command: ['npm', 'test', '--', 'a b'], cwd: '/workspace', user: 'node' },
    ]);
    expect(result).toEqual({
      binary: 'npm',
      args: ['test', '--', 'a b'],
      command: ['npm', 'test', '--', 'a b'],
      cwd: '/workspace',
      exitCode: 2,
      signal: null,
      stdout: 'out',
      stderr: 'err',
      durationMs: 9,
      timedOut: false,
    });
    expect(result).not.toHaveProperty('containerId');
  });

  it.each([
    ['the workspace root', WORKSPACE, '/workspace'],
    ['a directory inside the workspace', path.join(WORKSPACE, 'packages', 'app'), '/workspace/packages/app'],
    ['a relative path', path.join('packages', 'app'), '/workspace/packages/app'],
    ['a container path', '/usr/src/app', '/usr/src/app'],
    ['a sibling sharing the workspace prefix', `${WORKSPACE}-other`, `${WORKSPACE}-other`],
    ['a directory named like a parent reference', path.join(WORKSPACE, '..cache'), '/workspace/..cache'],
  ])('maps a cwd that is %s', async (_case, cwd, expected) => {
    const runtime = new FakeExecRuntime();
    const executor = new ContainerCommandExecutor({ runtime, container: CONTAINER });

    const result = await executor.run('pwd', [], { cwd });

    expect(runtime.requests[0]?.cwd).toBe(expected);
    expect(result.cwd).toBe(expected);
  });

  it('maps host paths that reach the workspace through a symlink', async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'container-executor-')));
    temporaryDirectories.push(root);
    const realWorkspace = path.join(root, 'real');
    await mkdir(path.join(realWorkspace, 'src'), { recursive: true });
    await symlink(realWorkspace, path.join(root, 'link'));
    const runtime = new FakeExecRuntime();

    const viaLink = new ContainerCommandExecutor({
      runtime,
      container: { ...CONTAINER, workspacePath: path.join(root, 'link') },
    });
    await viaLink.run('ls', [], { cwd: path.join(realWorkspace, 'src') });

    const viaRealPath = new ContainerCommandExecutor({
      runtime,
      container: { ...CONTAINER, workspacePath: realWorkspace },
    });
    await viaRealPath.run('ls', [], { cwd: path.join(root, 'link', 'src') });
    await viaRealPath.run('ls', [], { cwd: root });

    expect(runtime.requests.map((request) => request.cwd)).toEqual(['/workspace/src', '/workspace/src', root]);
  });

  it('layers per-run env over the constructor env and drops undefined values', async () => {
    const runtime = new FakeExecRuntime();
    const executor = new ContainerCommandExecutor({ runtime, container: CONTAINER, env: { A: '1', B: '2' } });

    await executor.run('env', [], { env: { B: '3', A: undefined, C: '4', D: undefined } });
    await executor.run('env', []);
    await new ContainerCommandExecutor({ runtime, container: CONTAINER }).run('env', [], { env: { X: undefined } });

    expect(runtime.requests.map((request) => request.env)).toEqual([{ B: '3', C: '4' }, { A: '1', B: '2' }, undefined]);
    expect(runtime.requests[2]).not.toHaveProperty('env');
  });

  it('passes stdin, timeout, abort signal and output limit to the runtime exec', async () => {
    const runtime = new FakeExecRuntime({ exitCode: null, timedOut: true, signal: 'SIGTERM' });
    const executor = new ContainerCommandExecutor({ runtime, container: CONTAINER });
    const controller = new AbortController();

    const result = await executor.run('cat', [], {
      stdin: 'input',
      timeoutMs: 50,
      signal: controller.signal,
      maxOutputBytes: 1024,
    });

    expect(runtime.requests[0]).toEqual({
      containerId: 'ctr-1',
      command: ['cat'],
      cwd: '/workspace',
      stdin: 'input',
      timeoutMs: 50,
      signal: controller.signal,
      maxOutputBytes: 1024,
    });
    expect(result).toMatchObject({ exitCode: null, signal: 'SIGTERM', timedOut: true });
  });

  it('propagates ContainerNotFoundError from the runtime', async () => {
    const missing = new ContainerNotFoundError('ctr-1');
    const executor = new ContainerCommandExecutor({ runtime: new FakeExecRuntime(missing), container: CONTAINER });

    await expect(executor.run('pwd', [])).rejects.toBe(missing);
  });

  it('drives docker exec through DockerContainerRuntime', async () => {
    const cli = new RecordingCommandExecutor();
    cli.enqueue({ exitCode: 1, stdout: 'failing test', cwd: '/host/cli' });
    cli.enqueue({ exitCode: 1, stderr: 'Error response from daemon: No such container: ctr-1' });
    const runtime = new DockerContainerRuntime({ executor: cli });
    const executor = new ContainerCommandExecutor({ runtime, container: CONTAINER, user: 'node', env: { CI: '1' } });

    const result = await executor.run('npm', ['test'], { cwd: path.join(WORKSPACE, 'pkg'), timeoutMs: 1000 });

    expect(cli.calls[0]).toEqual({
      binary: 'docker',
      args: [
        'container',
        'exec',
        '--user',
        'node',
        '--workdir',
        '/workspace/pkg',
        '--env',
        'CI=1',
        'ctr-1',
        'npm',
        'test',
      ],
      options: { timeoutMs: 1000 },
    });
    expect(result).toMatchObject({
      binary: 'npm',
      command: ['npm', 'test'],
      cwd: '/workspace/pkg',
      exitCode: 1,
      stdout: 'failing test',
    });
    await expect(executor.run('pwd', [])).rejects.toBeInstanceOf(ContainerNotFoundError);
  });
});
