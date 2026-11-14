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

/** A fresh git repository for each test, with `files` committed on `main`. */
export function useGitRepo(files: Record<string, string>): GitRepoFixture {
    let root = '';
    const fixture: GitRepoFixture = {
        get root() {
            return root;
        },
        write(path, contents) {
            mkdirSync(dirname(join(root, path)), {recursive: true});
            writeFileSync(join(root, path), contents);
        },
        git: (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim(),
    };

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), 'agent-engineer-repo-')));
        fixture.git('init', '--quiet', '--initial-branch', 'main');
        fixture.git('config', 'user.email', 'test@example.com');
        fixture.git('config', 'user.name', 'Test');
        fixture.git('config', 'commit.gpgsign', 'false');
        for (const [path, contents] of Object.entries(files)) {
            fixture.write(path, contents);
        }
        fixture.git('add', '-A');
        fixture.git('commit', '--quiet', '-m', 'initial');
    });

    afterEach(() => {
        rmSync(root, {recursive: true, force: true});
    });

    return fixture;
}
