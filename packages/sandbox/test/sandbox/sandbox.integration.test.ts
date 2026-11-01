import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DockerContainerRuntime, Sandbox } from '../../src/index.js';
import { createTestRepository, type TestRepository } from './helpers.js';

const describeIntegration = process.env.SANDBOX_CONTAINER_RUNTIME_INTEGRATION === '1' ? describe : describe.skip;

describeIntegration('Sandbox in a real Docker container', () => {
  let repo: TestRepository;

  beforeEach(async () => {
    repo = await createTestRepository();
  });

  afterEach(async () => {
    await repo.cleanup();
  });

  it('runs tasks inside the container against the mounted worktree and cleans everything up', async () => {
    const runtime = new DockerContainerRuntime();
    const sandbox = await Sandbox.create({
      repoPath: repo.repoPath,
      worktreePath: path.join(repo.root, 'docker-sandbox'),
      branchName: 'agent/docker',
      container: { image: 'node:24.15.0-bookworm-slim', preset: 'node-typescript' },
    });
    const containerId = sandbox.container?.id ?? '';

    try {
      expect(await runtime.isContainerRunning(containerId)).toBe(true);

      const version = await sandbox.exec(['node', '--version']);
      expect(version.stdout).toMatch(/^v24\./);
      expect(version.cwd).toBe('/workspace');

      const test = await sandbox.runTask('test');
      expect(test.exitCode).toBe(0);
      expect(test.stdout).toContain('tests ok');

      await sandbox.exec(['node', '-e', 'require("fs").writeFileSync("src/made-in-container.ts", "export {};\\n")']);
      expect(await readFile(path.join(sandbox.worktreePath, 'src', 'made-in-container.ts'), 'utf8')).toBe(
        'export {};\n',
      );
      expect((await sandbox.status()).map((entry) => entry.path)).toEqual(['src/made-in-container.ts']);
      expect((await sandbox.commit({ message: 'agent: add file' })).branchName).toBe('agent/docker');
    } finally {
      await sandbox.dispose();
    }

    expect(await runtime.containerExists(containerId)).toBe(false);
    expect(existsSync(sandbox.worktreePath)).toBe(false);
  }, 120_000);
});
