import type { TaskCommand, TaskTable } from '../../contracts/runner.js';
import type { PythonProjectManifest, UvInstallPlan } from './python.contracts.js';
import { getPythonScriptDefinitions, hasDeclaredDependency, isBuildableProject } from './pyprojectTomlReader.js';

const UV_BINARY = 'uv';

/** `uv sync`. */
export const UV_SYNC_PLAN: UvInstallPlan = { binary: UV_BINARY, args: ['sync'], mode: 'sync' };

const DEV_TOOLS = ['pytest', 'ruff', 'mypy', 'pyright'] as const;

/** Tasks inferred from declared dev tools, in precedence order (the first entry for a task name wins). */
const CONVENTIONAL_TOOL_TASKS: readonly { task: string; tool: string; argv: readonly string[] }[] = [
  { task: 'test', tool: 'pytest', argv: ['pytest'] },
  { task: 'lint', tool: 'ruff', argv: ['ruff', 'check'] },
  { task: 'typecheck', tool: 'mypy', argv: ['mypy'] },
  { task: 'typecheck', tool: 'pyright', argv: ['pyright'] },
  ...DEV_TOOLS.map((tool) => ({ task: tool, tool, argv: [tool] })),
];

function uvRun(argv: readonly string[]): TaskCommand {
  return { binary: UV_BINARY, args: ['run', ...argv] };
}

/**
 * The uv task table, in precedence order:
 * 1. buildable projects: `build` → `uv build`, then each `[project.scripts]` entry point → `uv run <name>`
 *    (entry points are only installed when uv builds the project);
 * 2. conventional tasks for declared dev tools (`test` → `uv run pytest`, `lint` → `uv run ruff check`,
 *    `typecheck` → `uv run mypy`/`pyright`, and each tool under its own name).
 *
 * Earlier entries win, so explicit scripts override conventions. Forwarded args are appended.
 */
export function buildUvTaskTable(manifest: PythonProjectManifest): TaskTable {
  const tasks = new Map<string, TaskCommand>();
  const add = (name: string, task: TaskCommand): void => {
    if (!tasks.has(name)) {
      tasks.set(name, task);
    }
  };

  if (isBuildableProject(manifest)) {
    add('build', { binary: UV_BINARY, args: ['build'] });
    for (const name of Object.keys(getPythonScriptDefinitions(manifest))) {
      add(name, uvRun([name]));
    }
  }

  for (const { task, tool, argv } of CONVENTIONAL_TOOL_TASKS) {
    if (hasDeclaredDependency(manifest, tool)) {
      add(task, uvRun(argv));
    }
  }

  return tasks;
}
