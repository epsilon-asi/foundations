import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface TestRepo {
  /** Real path of the temporary directory holding the repository (worktrees can be created beside it). */
  readonly rootDir: string;
  /** Real path of a `main`-branch repository with one commit containing `tracked.txt`, `delete-me.txt`, `rename-me.txt`. */
  readonly repoPath: string;
  cleanup(): Promise<void>;
  /** Runs git independently of the library under test (defaults to `repoPath`) and returns stdout. */
  runGit(args: readonly string[], cwd?: string): Promise<string>;
  writeRepoFile(relativePath: string, contents: string): Promise<void>;
  readRepoFile(relativePath: string): Promise<string>;
}

async function git(args: readonly string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', [...args], { cwd, encoding: 'utf8' });
  return stdout;
}

export async function createTestRepo(): Promise<TestRepo> {
  const rootDir = await realpath(await mkdtemp(join(tmpdir(), 'git-worktree-manager-')));
  const repoPath = join(rootDir, 'repo');
  await mkdir(repoPath, { recursive: true });

  await git(['init', '-q', '-b', 'main'], repoPath);
  await git(['config', 'user.name', 'Test User'], repoPath);
  await git(['config', 'user.email', 'test@example.com'], repoPath);
  await git(['config', 'gc.worktreePruneExpire', 'now'], repoPath);

  await writeFile(join(repoPath, 'tracked.txt'), 'baseline tracked\n', 'utf8');
  await writeFile(join(repoPath, 'delete-me.txt'), 'delete me\n', 'utf8');
  await writeFile(join(repoPath, 'rename-me.txt'), 'rename me\n', 'utf8');
  await git(['add', '-A', '--', '.'], repoPath);
  await git(['commit', '-q', '--no-gpg-sign', '-m', 'initial'], repoPath);

  return {
    rootDir,
    repoPath,
    cleanup: async () => {
      await rm(rootDir, { recursive: true, force: true });
    },
    runGit: async (args, cwd = repoPath) => await git(args, cwd),
    writeRepoFile: async (relativePath, contents) => {
      const destinationPath = join(repoPath, relativePath);
      await mkdir(dirname(destinationPath), { recursive: true });
      await writeFile(destinationPath, contents, 'utf8');
    },
    readRepoFile: async (relativePath) => await readFile(join(repoPath, relativePath), 'utf8'),
  };
}
