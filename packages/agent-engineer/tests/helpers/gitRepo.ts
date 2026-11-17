import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {afterEach, beforeEach} from 'vitest';

export interface GitRepoFixture {
    /** Root of the repository. */
    readonly root: string;
    /** Writes `contents` to a repository-relative path. */
    write(path: string, contents: string): void;
    /** Runs git in the repository and returns its trimmed output. */
    git(...args: string[]): string;
}

/** Makes `root` (which must exist) a git repository with `files` committed on `main`. */
export function initGitRepo(root: string, files: Record<string, string>): GitRepoFixture {
    const fixture: GitRepoFixture = {
        root,
        write(path, contents) {
            mkdirSync(dirname(join(root, path)), {recursive: true});
            writeFileSync(join(root, path), contents);
        },
        git: (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim(),
    };
    fixture.git('init', '--quiet', '--initial-branch', 'main');
    fixture.git('config', 'user.email', 'test@example.com');
    fixture.git('config', 'user.name', 'Test');
    fixture.git('config', 'commit.gpgsign', 'false');
    for (const [path, contents] of Object.entries(files)) {
        fixture.write(path, contents);
    }
    fixture.git('add', '-A');
    fixture.git('commit', '--quiet', '-m', 'initial');
    return fixture;
}

/** A fresh git repository for each test, with `files` committed on `main`. */
export function useGitRepo(files: Record<string, string>): GitRepoFixture {
    let current: GitRepoFixture | undefined;
    const get = (): GitRepoFixture => {
        if (current === undefined) throw new Error('The git repository exists only inside a test.');
        return current;
    };

    beforeEach(() => {
        current = initGitRepo(realpathSync(mkdtempSync(join(tmpdir(), 'agent-engineer-repo-'))), files);
    });

    afterEach(() => {
        rmSync(get().root, {recursive: true, force: true});
        current = undefined;
    });

    return {
        get root() {
            return get().root;
        },
        write: (path, contents) => get().write(path, contents),
        git: (...args) => get().git(...args),
    };
}
