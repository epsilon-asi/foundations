import { describe, expect, it } from 'vitest';
import {
  buildDockerCopyFromContainerArgs,
  buildDockerCopyToContainerArgs,
  buildDockerCreateArgs,
  buildDockerDiffArgs,
  buildDockerExecArgs,
  buildDockerImageInspectArgs,
  buildDockerInfoArgs,
  buildDockerInspectArgs,
  buildDockerKillArgs,
  buildDockerListArgs,
  buildDockerLogsArgs,
  buildDockerPauseArgs,
  buildDockerPullArgs,
  buildDockerRemoveArgs,
  buildDockerStartArgs,
  buildDockerStopArgs,
  buildDockerUnpauseArgs,
  buildDockerWaitArgs,
  formatDockerBindMount,
  formatDockerTmpfsMount,
} from '../../src/container-runtime/index.js';

describe('dockerCommandBuilder', () => {
  it('formats bind mounts with readonly and propagation', () => {
    expect(
      formatDockerBindMount({
        sourcePath: '/host/repo',
        targetPath: '/workspace',
        readOnly: true,
        bindPropagation: 'rshared',
      }),
    ).toBe('type=bind,src=/host/repo,dst=/workspace,readonly,bind-propagation=rshared');
  });

  it('formats tmpfs mounts with and without options', () => {
    expect(formatDockerTmpfsMount({ targetPath: '/tmp', options: 'rw,size=64m' })).toBe('/tmp:rw,size=64m');
    expect(formatDockerTmpfsMount({ targetPath: '/run' })).toBe('/run');
  });

  it('builds minimal create args without absent optional flags', () => {
    const args = buildDockerCreateArgs({
      image: 'node:24',
      workspacePath: '/host/repo',
      workspaceMountPath: '/workspace',
    });

    expect(args).toEqual([
      'container',
      'create',
      '--workdir',
      '/workspace',
      '--mount',
      'type=bind,src=/host/repo,dst=/workspace',
      'node:24',
      'sleep',
      'infinity',
    ]);
  });

  it('builds create args with security, resources, env, labels, and mounts', () => {
    const args = buildDockerCreateArgs({
      image: 'node:24',
      workspacePath: '/host/repo',
      workspaceMountPath: '/workspace',
      workspaceReadOnly: true,
      workdir: '/workspace/project',
      name: 'container-1',
      platform: 'linux/amd64',
      init: true,
      tty: true,
      entrypoint: '/bin/bash',
      env: { CI: '1', FORCE_COLOR: '0' },
      labels: { 'sandbox.kind': 'coding-agent' },
      security: {
        network: 'none',
        readOnlyRootFilesystem: true,
        user: '1000:1000',
        privileged: true,
        capAdd: ['SYS_PTRACE'],
        capDrop: ['ALL'],
        securityOpt: ['no-new-privileges=true'],
      },
      tmpfsMounts: [{ targetPath: '/tmp', options: 'rw,size=64m' }],
      additionalMounts: [{ sourcePath: '/host/cache', targetPath: '/cache', readOnly: true }],
      resources: { memory: '2g', cpus: 1.5, pidsLimit: 128 },
      extraCreateArgs: ['--health-cmd', 'echo ok'],
      command: ['tail', '-f', '/dev/null'],
    });

    expect(args).toEqual([
      'container',
      'create',
      '--name',
      'container-1',
      '--platform',
      'linux/amd64',
      '--init',
      '--tty',
      '--workdir',
      '/workspace/project',
      '--network',
      'none',
      '--user',
      '1000:1000',
      '--read-only',
      '--privileged',
      '--cap-add',
      'SYS_PTRACE',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges=true',
      '--memory',
      '2g',
      '--cpus',
      '1.5',
      '--pids-limit',
      '128',
      '--env',
      'CI=1',
      '--env',
      'FORCE_COLOR=0',
      '--label',
      'sandbox.kind=coding-agent',
      '--mount',
      'type=bind,src=/host/repo,dst=/workspace,readonly',
      '--mount',
      'type=bind,src=/host/cache,dst=/cache,readonly',
      '--tmpfs',
      '/tmp:rw,size=64m',
      '--entrypoint',
      '/bin/bash',
      '--health-cmd',
      'echo ok',
      'node:24',
      'tail',
      '-f',
      '/dev/null',
    ]);
  });

  it('builds exec args with env, workdir, interactive stdin, tty, user, and extra args', () => {
    const args = buildDockerExecArgs({
      containerId: 'abc123',
      command: ['npm', 'test'],
      cwd: '/workspace',
      env: { CI: '1', FORCE_COLOR: '0' },
      stdin: 'input',
      tty: true,
      user: 'node',
      privileged: true,
      detach: true,
      extraExecArgs: ['--detach-keys', 'ctrl-x'],
    });

    expect(args).toEqual([
      'container',
      'exec',
      '--interactive',
      '--tty',
      '--detach',
      '--privileged',
      '--user',
      'node',
      '--workdir',
      '/workspace',
      '--env',
      'CI=1',
      '--env',
      'FORCE_COLOR=0',
      '--detach-keys',
      'ctrl-x',
      'abc123',
      'npm',
      'test',
    ]);
  });

  it('rejects empty exec commands', () => {
    expect(() => buildDockerExecArgs({ containerId: 'abc123', command: [] })).toThrow(
      /requires at least one command token/i,
    );
  });

  it('builds logs args with every supported flag', () => {
    expect(
      buildDockerLogsArgs('abc123', {
        follow: true,
        tail: 100,
        timestamps: true,
        since: '2026-01-01T00:00:00Z',
        until: '2026-01-01T01:00:00Z',
      }),
    ).toEqual([
      'container',
      'logs',
      '--follow',
      '--tail',
      '100',
      '--timestamps',
      '--since',
      '2026-01-01T00:00:00Z',
      '--until',
      '2026-01-01T01:00:00Z',
      'abc123',
    ]);
  });

  it('builds list args with filters and all=true', () => {
    expect(
      buildDockerListArgs({
        all: true,
        filters: {
          label: ['sandbox.kind=coding-agent', 'sandbox.workspace=/workspace'],
          status: 'running',
        },
      }),
    ).toEqual([
      'container',
      'ls',
      '--format',
      '{{json .}}',
      '--all',
      '--filter',
      'label=sandbox.kind=coding-agent',
      '--filter',
      'label=sandbox.workspace=/workspace',
      '--filter',
      'status=running',
    ]);
  });

  it('builds every other simple docker command', () => {
    expect(buildDockerStartArgs('abc123')).toEqual(['container', 'start', 'abc123']);
    expect(buildDockerStopArgs('abc123', { timeoutSeconds: 5 })).toEqual([
      'container',
      'stop',
      '--time',
      '5',
      'abc123',
    ]);
    expect(buildDockerRemoveArgs('abc123', { force: true, volumes: true })).toEqual([
      'container',
      'rm',
      '--force',
      '--volumes',
      'abc123',
    ]);
    expect(buildDockerInspectArgs('abc123')).toEqual(['container', 'inspect', 'abc123']);
    expect(buildDockerWaitArgs('abc123')).toEqual(['container', 'wait', 'abc123']);
    expect(
      buildDockerCopyToContainerArgs({
        containerId: 'abc123',
        sourcePath: '/host/in.txt',
        targetPath: '/workspace/in.txt',
      }),
    ).toEqual(['container', 'cp', '/host/in.txt', 'abc123:/workspace/in.txt']);
    expect(
      buildDockerCopyFromContainerArgs({
        containerId: 'abc123',
        sourcePath: '/workspace/out.txt',
        targetPath: '/host/out.txt',
      }),
    ).toEqual(['container', 'cp', 'abc123:/workspace/out.txt', '/host/out.txt']);
    expect(buildDockerDiffArgs('abc123')).toEqual(['container', 'diff', 'abc123']);
    expect(buildDockerPauseArgs('abc123')).toEqual(['container', 'pause', 'abc123']);
    expect(buildDockerUnpauseArgs('abc123')).toEqual(['container', 'unpause', 'abc123']);
    expect(buildDockerKillArgs('abc123', 'SIGKILL')).toEqual(['container', 'kill', '--signal', 'SIGKILL', 'abc123']);
    expect(buildDockerPullArgs('node:24')).toEqual(['image', 'pull', 'node:24']);
    expect(buildDockerImageInspectArgs('node:24')).toEqual(['image', 'inspect', 'node:24']);
    expect(buildDockerInfoArgs()).toEqual(['info', '--format', '{{json .}}']);
  });

  it('falls back to the keepalive command and default workspace path', () => {
    expect(buildDockerCreateArgs({ image: 'node:24', workspacePath: '/host/repo', command: [] })).toEqual([
      'container',
      'create',
      '--workdir',
      '/workspace',
      '--mount',
      'type=bind,src=/host/repo,dst=/workspace',
      'node:24',
      'sleep',
      'infinity',
    ]);
  });

  it('formats bind mounts without optional parts', () => {
    expect(formatDockerBindMount({ sourcePath: '/a', targetPath: '/b', readOnly: false })).toBe(
      'type=bind,src=/a,dst=/b',
    );
  });

  it('adds --interactive only when requested or when stdin is supplied', () => {
    expect(buildDockerExecArgs({ containerId: 'abc123', command: ['sh'], interactive: true })).toEqual([
      'container',
      'exec',
      '--interactive',
      'abc123',
      'sh',
    ]);
    expect(buildDockerExecArgs({ containerId: 'abc123', command: ['sh'], interactive: false })).toEqual([
      'container',
      'exec',
      'abc123',
      'sh',
    ]);
  });

  it('omits optional flags for stop, rm, kill, logs and ls', () => {
    expect(buildDockerStopArgs('abc123')).toEqual(['container', 'stop', 'abc123']);
    expect(buildDockerRemoveArgs('abc123')).toEqual(['container', 'rm', 'abc123']);
    expect(buildDockerKillArgs('abc123')).toEqual(['container', 'kill', 'abc123']);
    expect(buildDockerLogsArgs('abc123', { tail: 'all' })).toEqual(['container', 'logs', '--tail', 'all', 'abc123']);
    expect(buildDockerListArgs()).toEqual(['container', 'ls', '--format', '{{json .}}']);
  });
});
