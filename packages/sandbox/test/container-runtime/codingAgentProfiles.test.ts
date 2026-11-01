import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildCodingAgentContainerOptions,
  buildNodeTypescriptContainerOptions,
  CODING_AGENT_CONTAINER_KIND,
  DEFAULT_CONTAINER_KEEPALIVE_COMMAND,
  DEFAULT_CONTAINER_TMPFS_MOUNT,
  DEFAULT_CONTAINER_WORKSPACE_PATH,
  CONTAINER_LABELS,
  SECURE_READONLY_SECURITY_OPTIONS,
} from '../../src/container-runtime/index.js';
import type { ContainerSecurityOptions, NodePackageManager } from '../../src/container-runtime/index.js';

describe('codingAgentProfiles', () => {
  it('builds general coding-agent defaults', () => {
    const options = buildCodingAgentContainerOptions({
      image: 'node:24.15.0',
      workspacePath: '/tmp/repo',
    });

    expect(options).toMatchObject({
      image: 'node:24.15.0',
      workspacePath: path.resolve('/tmp/repo'),
      workspaceMountPath: DEFAULT_CONTAINER_WORKSPACE_PATH,
      workdir: DEFAULT_CONTAINER_WORKSPACE_PATH,
      init: true,
      pullPolicy: 'missing',
      env: {
        CI: '1',
      },
      labels: {
        'sandbox.kind': 'coding-agent',
        'sandbox.workspace': DEFAULT_CONTAINER_WORKSPACE_PATH,
        'sandbox.profile': 'general',
      },
      command: [...DEFAULT_CONTAINER_KEEPALIVE_COMMAND],
    });

    expect(options.tmpfsMounts).toEqual([DEFAULT_CONTAINER_TMPFS_MOUNT]);
    expect(options.additionalMounts).toEqual([]);
  });

  it('applies secure defaults and merges custom security options', () => {
    const options = buildCodingAgentContainerOptions({
      image: 'node:24.15.0',
      workspacePath: '/tmp/repo',
      secureDefaults: true,
      security: {
        user: 'node',
        capDrop: ['NET_RAW'],
        securityOpt: ['seccomp=default'],
      },
    });

    expect(options.security).toEqual({
      ...SECURE_READONLY_SECURITY_OPTIONS,
      user: 'node',
      capDrop: ['ALL', 'NET_RAW'],
      securityOpt: ['no-new-privileges=true', 'seccomp=default'],
    });
    expect(options.labels).toMatchObject({
      'sandbox.profile': 'general',
      'sandbox.security-profile': 'secure-readonly',
    });
  });

  it('preserves caller overrides for workdir, mounts, command, labels, and workspaceReadOnly', () => {
    const options = buildCodingAgentContainerOptions({
      image: 'node:24.15.0',
      workspacePath: '/tmp/repo',
      workspaceMountPath: '/repo',
      workdir: '/repo/subdir',
      workspaceReadOnly: true,
      labels: {
        team: 'agents',
      },
      additionalMounts: [
        {
          sourcePath: '/tmp/shared',
          targetPath: '/shared',
          readOnly: true,
        },
      ],
      tmpfsMounts: [
        {
          targetPath: '/var/tmp',
          options: 'rw,size=1024',
        },
      ],
      command: ['tail', '-f', '/dev/null'],
    });

    expect(options.workspaceMountPath).toBe('/repo');
    expect(options.workdir).toBe('/repo/subdir');
    expect(options.workspaceReadOnly).toBe(true);
    expect(options.labels).toMatchObject({
      team: 'agents',
      'sandbox.workspace': '/repo',
    });
    expect(options.additionalMounts).toEqual([
      {
        sourcePath: '/tmp/shared',
        targetPath: '/shared',
        readOnly: true,
      },
    ]);
    expect(options.tmpfsMounts).toEqual([
      DEFAULT_CONTAINER_TMPFS_MOUNT,
      {
        targetPath: '/var/tmp',
        options: 'rw,size=1024',
      },
    ]);
    expect(options.command).toEqual(['tail', '-f', '/dev/null']);
  });

  it('builds a Node/TypeScript profile with npm defaults and optional install cache mount', () => {
    const options = buildNodeTypescriptContainerOptions({
      image: 'node:24.15.0',
      workspacePath: '/tmp/repo',
      installCachePath: '/tmp/npm-cache',
    });

    expect(options.env).toMatchObject({
      CI: '1',
      NODE_ENV: 'development',
      npm_config_update_notifier: 'false',
      NPM_CONFIG_CACHE: '/cache/npm',
    });
    expect(options.labels).toMatchObject({
      'sandbox.profile': 'node-typescript',
      'sandbox.package-manager': 'npm',
    });
    expect(options.additionalMounts).toContainEqual({
      sourcePath: path.resolve('/tmp/npm-cache'),
      targetPath: '/cache/npm',
    });
  });

  it('supports alternate package managers and secure defaults in the Node profile', () => {
    const options = buildNodeTypescriptContainerOptions({
      image: 'node:24.15.0',
      workspacePath: '/tmp/repo',
      packageManager: 'pnpm',
      installCachePath: '/tmp/pnpm-cache',
      secureDefaults: true,
      env: {
        CUSTOM: '1',
      },
    });

    expect(options.env).toMatchObject({
      CI: '1',
      NODE_ENV: 'development',
      PNPM_STORE_DIR: '/cache/pnpm/store',
      CUSTOM: '1',
    });
    expect(options.labels).toMatchObject({
      'sandbox.profile': 'node-typescript',
      'sandbox.package-manager': 'pnpm',
      'sandbox.security-profile': 'secure-readonly',
    });
    expect(options.additionalMounts).toContainEqual({
      sourcePath: path.resolve('/tmp/pnpm-cache'),
      targetPath: '/cache/pnpm',
    });
    expect(options.security).toEqual(SECURE_READONLY_SECURITY_OPTIONS);
  });

  it('produces exactly the documented general profile', () => {
    expect(buildCodingAgentContainerOptions({ image: 'node:24.15.0', workspacePath: '/tmp/repo' })).toEqual({
      image: 'node:24.15.0',
      workspacePath: path.resolve('/tmp/repo'),
      workspaceMountPath: '/workspace',
      workdir: '/workspace',
      env: { CI: '1' },
      labels: {
        [CONTAINER_LABELS.kind]: CODING_AGENT_CONTAINER_KIND,
        [CONTAINER_LABELS.workspace]: '/workspace',
        [CONTAINER_LABELS.profile]: 'general',
      },
      init: true,
      pullPolicy: 'missing',
      tmpfsMounts: [DEFAULT_CONTAINER_TMPFS_MOUNT],
      additionalMounts: [],
      command: ['sleep', 'infinity'],
    });
  });

  it('passes name, resources, pull policy and extra create args through', () => {
    const extraCreateArgs = ['--health-cmd', 'true'];
    const options = buildCodingAgentContainerOptions({
      image: 'node:24.15.0',
      workspacePath: '/tmp/repo',
      name: 'container-1',
      resources: { memory: '1g' },
      pullPolicy: 'never',
      extraCreateArgs,
      security: { user: 'node' },
    });

    expect(options).toMatchObject({
      name: 'container-1',
      resources: { memory: '1g' },
      pullPolicy: 'never',
      extraCreateArgs,
      security: { user: 'node' },
    });
    expect(options.extraCreateArgs).not.toBe(extraCreateArgs);
  });

  it('keeps profile labels authoritative over caller labels', () => {
    const options = buildCodingAgentContainerOptions({
      image: 'node:24.15.0',
      workspacePath: '/tmp/repo',
      labels: { [CONTAINER_LABELS.profile]: 'spoofed', [CONTAINER_LABELS.kind]: 'custom' },
    });

    expect(options.labels).toMatchObject({ [CONTAINER_LABELS.profile]: 'general', [CONTAINER_LABELS.kind]: 'custom' });
  });

  it('dedupes merged security lists and never lets an undefined override clear a secure default', () => {
    const options = buildCodingAgentContainerOptions({
      image: 'node:24.15.0',
      workspacePath: '/tmp/repo',
      secureDefaults: true,
      security: {
        network: undefined,
        capDrop: ['ALL', 'NET_RAW'],
        capAdd: ['CHOWN'],
      } as unknown as ContainerSecurityOptions,
    });

    expect(options.security).toEqual({
      ...SECURE_READONLY_SECURITY_OPTIONS,
      capAdd: ['CHOWN'],
      capDrop: ['ALL', 'NET_RAW'],
    });
  });

  it('replaces the default tmpfs mount when the caller targets the same path', () => {
    const options = buildCodingAgentContainerOptions({
      image: 'node:24.15.0',
      workspacePath: '/tmp/repo',
      tmpfsMounts: [{ targetPath: '/tmp', options: 'rw,size=1m' }],
    });

    expect(options.tmpfsMounts).toEqual([{ targetPath: '/tmp', options: 'rw,size=1m' }]);
  });

  it.each<[NodePackageManager, Record<string, string>, string]>([
    ['npm', { NPM_CONFIG_CACHE: '/cache/npm' }, '/cache/npm'],
    ['pnpm', { PNPM_STORE_DIR: '/cache/pnpm/store' }, '/cache/pnpm'],
    ['yarn', { YARN_CACHE_FOLDER: '/cache/yarn' }, '/cache/yarn'],
    ['bun', { BUN_INSTALL_CACHE_DIR: '/cache/bun' }, '/cache/bun'],
  ])('configures the %s install cache', (packageManager, env, targetPath) => {
    const options = buildNodeTypescriptContainerOptions({
      image: 'node:24.15.0',
      workspacePath: '/tmp/repo',
      packageManager,
      installCachePath: '/tmp/cache',
      additionalMounts: [{ sourcePath: '/tmp/shared', targetPath: '/shared' }],
    });

    expect(options.env).toMatchObject(env);
    expect(options.additionalMounts).toEqual([
      { sourcePath: '/tmp/shared', targetPath: '/shared' },
      { sourcePath: path.resolve('/tmp/cache'), targetPath },
    ]);
  });

  it('adds no cache env or mount without an install cache path', () => {
    const options = buildNodeTypescriptContainerOptions({ image: 'node:24.15.0', workspacePath: '/tmp/repo' });

    expect(options.env).toEqual({ CI: '1', NODE_ENV: 'development', npm_config_update_notifier: 'false' });
    expect(options.additionalMounts).toEqual([]);
    expect(options.labels).toEqual({
      [CONTAINER_LABELS.kind]: CODING_AGENT_CONTAINER_KIND,
      [CONTAINER_LABELS.workspace]: '/workspace',
      [CONTAINER_LABELS.packageManager]: 'npm',
      [CONTAINER_LABELS.profile]: 'node-typescript',
    });
  });
});
