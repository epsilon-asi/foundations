import { describe, expect, it } from 'vitest';

import type { PythonProjectManifest } from '../../../src/repo-runner/runners/python/python.contracts.js';
import { buildUvTaskTable, UV_SYNC_PLAN } from '../../../src/repo-runner/runners/python/uvCommands.js';

function taskArgs(manifest: PythonProjectManifest): Record<string, readonly string[]> {
  return Object.fromEntries([...buildUvTaskTable(manifest)].map(([name, task]) => [name, task.args]));
}

const devTools = (...tools: string[]): PythonProjectManifest => ({ dependencyGroups: { dev: tools } });

describe('uvCommands', () => {
  it('installs with uv sync', () => {
    expect(UV_SYNC_PLAN).toEqual({ binary: 'uv', args: ['sync'], mode: 'sync' });
  });

  it('every task runs through the uv binary', () => {
    const tasks = buildUvTaskTable({ ...devTools('pytest', 'ruff'), buildSystem: {} });

    expect(new Set([...tasks.values()].map((task) => task.binary))).toEqual(new Set(['uv']));
  });

  it('has no tasks for a bare manifest', () => {
    expect(buildUvTaskTable({}).size).toBe(0);
  });

  it('derives conventional tasks from declared dev tools', () => {
    expect(taskArgs(devTools('pytest', 'ruff', 'mypy', 'pyright'))).toEqual({
      test: ['run', 'pytest'],
      lint: ['run', 'ruff', 'check'],
      typecheck: ['run', 'mypy'],
      pytest: ['run', 'pytest'],
      ruff: ['run', 'ruff'],
      mypy: ['run', 'mypy'],
      pyright: ['run', 'pyright'],
    });
  });

  it('falls back to pyright for typecheck when mypy is absent', () => {
    expect(taskArgs(devTools('pyright'))).toEqual({ typecheck: ['run', 'pyright'], pyright: ['run', 'pyright'] });
  });

  it('exposes build and entry points only for buildable projects', () => {
    const scripts = { project: { scripts: { hello: 'pkg:main' } } };

    expect(taskArgs({ ...scripts, tool: { uv: { package: false } } })).toEqual({});
    expect(taskArgs({ ...scripts, tool: { uv: { package: true } } })).toEqual({
      build: ['build'],
      hello: ['run', 'hello'],
    });
  });

  it('lets explicit entry points override conventions, but never `build`', () => {
    const manifest: PythonProjectManifest = {
      project: { scripts: { test: 'pkg:test', lint: 'pkg:lint', ruff: 'pkg:ruff', build: 'pkg:build' } },
      buildSystem: { buildBackend: 'uv_build' },
      ...devTools('pytest', 'ruff'),
    };

    expect(taskArgs(manifest)).toEqual({
      build: ['build'],
      test: ['run', 'test'],
      lint: ['run', 'lint'],
      ruff: ['run', 'ruff'],
      pytest: ['run', 'pytest'],
    });
  });
});
