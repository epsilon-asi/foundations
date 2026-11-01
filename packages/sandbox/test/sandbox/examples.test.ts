import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { agentWorkflowExample } from '../../examples/sandbox/agentWorkflow.example.js';
import { createTestRepository, type TestRepository } from './helpers.js';

describe('examples/sandbox', () => {
  let repo: TestRepository;

  beforeEach(async () => {
    repo = await createTestRepository();
  });

  afterEach(async () => {
    await repo.cleanup();
  });

  it('agentWorkflowExample commits a verified change and cleans up the sandbox', async () => {
    const worktreePath = path.join(repo.root, 'example');

    const result = await agentWorkflowExample({ repoPath: repo.repoPath, worktreePath }, async (root) => {
      await writeFile(path.join(root, 'src', 'greet.ts'), 'export const greet = (name: string) => `hi ${name}`;\n');
    });

    expect(result.testsPassed).toBe(true);
    expect(result.changedFiles).toEqual([{ status: 'M', path: 'src/greet.ts' }]);
    expect(result.patch).toContain('+export const greet');
    expect(repo.git('rev-parse', 'agent/example').trim()).toBe(result.commit?.headSha);
    expect(existsSync(worktreePath)).toBe(false);
  });
});
