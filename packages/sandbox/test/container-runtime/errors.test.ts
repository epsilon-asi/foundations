import { describe, expect, it } from 'vitest';

import {
  ContainerCleanupError,
  ContainerHealthError,
  ContainerHealthTimeoutError,
  ContainerNotFoundError,
  ContainerParseError,
  ContainerRuntimeError,
  ContainerUnhealthyError,
  ImageUnavailableError,
  SandboxError,
} from '../../src/container-runtime/index.js';
import type { CommandExecutionResult } from '../../src/container-runtime/index.js';

const result: CommandExecutionResult = {
  binary: 'docker',
  args: ['container', 'inspect', 'abc'],
  command: ['docker', 'container', 'inspect', 'abc'],
  cwd: '/host',
  exitCode: 1,
  signal: null,
  stdout: '',
  stderr: 'No such container',
  durationMs: 1,
  timedOut: false,
};

describe('errors', () => {
  it.each([
    [new ContainerParseError('parser', 'm', 'payload'), 'ContainerParseError'],
    [new ImageUnavailableError('node:24'), 'ImageUnavailableError'],
    [new ContainerHealthError('abc', 'm'), 'ContainerHealthError'],
    [new ContainerUnhealthyError('abc'), 'ContainerUnhealthyError'],
    [new ContainerHealthTimeoutError('abc', 10), 'ContainerHealthTimeoutError'],
    [new ContainerNotFoundError('abc'), 'ContainerNotFoundError'],
    [new ContainerCleanupError('abc', []), 'ContainerCleanupError'],
    [new ContainerRuntimeError('m'), 'ContainerRuntimeError'],
  ])('%s extends ContainerRuntimeError and SandboxError and is named %s', (error, name) => {
    expect(error).toBeInstanceOf(ContainerRuntimeError);
    expect(error).toBeInstanceOf(SandboxError);
    expect(error.name).toBe(name);
  });

  it('keeps the standard cause', () => {
    const cause = new Error('root cause');

    expect(new ContainerRuntimeError('failed', { cause })).toMatchObject({ message: 'failed', cause });
    expect(new ContainerRuntimeError('no context')).not.toHaveProperty('cause');
  });

  it('formats specialised messages and carries their identifiers', () => {
    const parseCause = new SyntaxError('bad');
    expect(new ContainerParseError('parseX', 'broken', 'raw', { cause: parseCause })).toMatchObject({
      message: 'parseX: broken',
      parser: 'parseX',
      payload: 'raw',
      cause: parseCause,
    });
    expect(new ImageUnavailableError('node:24')).toMatchObject({
      image: 'node:24',
      message: 'Image not present locally and pull policy forbids pulling: node:24',
    });
    expect(new ContainerUnhealthyError('abc')).toMatchObject({
      containerId: 'abc',
      message: 'Container became unhealthy: abc',
    });
    expect(new ContainerHealthTimeoutError('abc', 10)).toMatchObject({
      containerId: 'abc',
      message: 'Timed out waiting for container health: abc after 10ms',
    });
  });

  it('attaches the reporting command result to ContainerNotFoundError when known', () => {
    const cause = new Error('gone');

    expect(new ContainerNotFoundError('abc', result, { cause })).toMatchObject({
      containerId: 'abc',
      message: 'Container not found: abc',
      result,
      cause,
    });
    expect(new ContainerNotFoundError('abc').result).toBeUndefined();
  });

  it('snapshots the cleanup error list', () => {
    const failures = [new Error('stop failed')];
    const error = new ContainerCleanupError('abc', failures);
    failures.push(new Error('later'));

    expect(error.cleanupErrors).toHaveLength(1);
    expect(error.message).toBe('Cleanup failed for container: abc');
  });
});
