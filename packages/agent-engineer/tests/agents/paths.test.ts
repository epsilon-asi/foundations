import type {Sandbox} from '@epsilon-asi/sandbox';
import fc from 'fast-check';
import {posix} from 'node:path';
import {describe, expect, it} from 'vitest';
import {globToRegExp, RepoToolkit} from '../../src/agents/index.js';
import {GlobalConfigSchema} from '../../src/config/global-config.js';

const ROOT = '/work/repo';
const OFF_LIMITS = ['secrets', '*.pem'];
const IGNORE = ['dist/'];

const toolkit = new RepoToolkit({
    sandbox: {worktreePath: ROOT} as unknown as Sandbox,
    config: GlobalConfigSchema.parse({offLimits: OFF_LIMITS, ignore: IGNORE}),
});

/** What the guard must refuse, stated independently of its implementation: by path segment. */
const isOffLimits = (repoPath: string) =>
    repoPath.split('/').some((segment) => segment === '.git' || segment === 'secrets' || segment.endsWith('.pem') || segment === 'dist');

describe('resolvePath', () => {
    it.each([
        ['src/a.ts', 'src/a.ts'],
        ['./src/../src/a.ts', 'src/a.ts'],
        ['/src/a.ts', 'src/a.ts'],
        [`${ROOT}/src/a.ts`, 'src/a.ts'],
        // An absolute path outside the worktree is read as repository-relative, so it stays inside.
        ['/etc/passwd', 'etc/passwd'],
        ['/work/repository/x', 'work/repository/x'],
        ['secretsx/a', 'secretsx/a'],
        ['a\\..\\..\\x', 'a\\..\\..\\x'],
    ])('resolves %s to %s', (input, expected) => {
        expect(toolkit.resolvePath(input)).toEqual({path: expected, absolutePath: posix.join(ROOT, expected)});
    });

    it.each(['../x', 'src/../../x', '', '.', ROOT, `${ROOT}/..`])('refuses %j as outside the repository', (input) => {
        expect(() => toolkit.resolvePath(input)).toThrow('is outside the repository.');
    });

    it.each(['.git/config', 'pkg/.git/HEAD', 'secrets', 'secrets/key', 'a/secrets/key', 'certs/server.pem', 'dist/x.js', 'pkg/dist'])(
        'refuses %s as off limits',
        (input) => {
            expect(() => toolkit.resolvePath(input)).toThrow('is off limits.');
        },
    );

    const segment = fc.constantFrom('a', 'b.ts', '..', '.', '', 'secrets', '.git', 'key.pem', 'dist', 'a\\..', '%2e%2e', '..a', 'ü');
    const anyPath = fc.tuple(fc.constantFrom('', '/', `${ROOT}/`), fc.array(segment, {maxLength: 8}))
        .map(([prefix, segments]) => prefix + segments.join('/'));

    it('never returns a path outside the worktree or off limits', () => {
        fc.assert(fc.property(fc.oneof(anyPath, fc.string(), fc.string({unit: 'grapheme'})), (input) => {
            let resolved: { path: string; absolutePath: string };
            try {
                resolved = toolkit.resolvePath(input);
            } catch (error) {
                expect((error as Error).message).toMatch(/is outside the repository\.$|is off limits\.$/);
                return;
            }
            expect(resolved.absolutePath.startsWith(`${ROOT}/`)).toBe(true);
            expect(resolved.absolutePath).toBe(posix.join(ROOT, resolved.path));
            expect(resolved.path.split('/')).not.toContain('..');
            expect(isOffLimits(resolved.path)).toBe(false);
        }), {numRuns: 2000});
    });

    it('resolves every plain path that is inside and allowed', () => {
        const safe = fc.array(fc.stringMatching(/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,8}$/).filter((name) => !isOffLimits(name)), {minLength: 1, maxLength: 6});
        fc.assert(fc.property(safe, (segments) => {
            expect(toolkit.resolvePath(segments.join('/')).path).toBe(segments.join('/'));
        }));
    });
});

describe('globToRegExp', () => {
    it.each([
        ['.dust', '.dust', true],
        ['.dust', 'pkg/.dust/cache.json', true],
        ['.dust', 'pkg/.dusty', false],
        ['/build', 'build/x', true],
        ['/build', 'pkg/build/x', false],
        ['build/', 'pkg/build/x', true],
        ['*.pem', 'a/b/c.pem', true],
        ['*.pem', 'a/b/c.pem.txt', false],
        ['**/*.pem', 'c.pem', true],
        ['a/**/b', 'a/b', true],
        ['a/**/b', 'a/x/y/b/c', true],
        ['a/*/b', 'a/x/y/b', false],
        ['file?.txt', 'file1.txt', true],
        ['file?.txt', 'file12.txt', false],
        // Regular-expression characters are literal.
        ['a+b', 'a+b', true],
        ['a+b', 'aab', false],
        ['[x]', '[x]', true],
        ['[x]', 'x', false],
    ])('%s on %s is %s', (pattern, path, matches) => {
        expect(globToRegExp(pattern).test(path)).toBe(matches);
    });
});
