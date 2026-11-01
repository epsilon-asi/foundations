import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatResults, runCli, type CliIo } from '../../src/repo-search/cli/runCli.js';
import type { SearchResult } from '../../src/repo-search/types.js';
import { makeFixtureRepo, makeTempRoot } from './helpers.js';

function captureIo(): CliIo & { out: () => string; err: () => string } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    out: () => stdout.join(''),
    err: () => stderr.join(''),
  };
}

async function run(argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const io = captureIo();
  const code = await runCli(argv, io);
  return { code, out: io.out(), err: io.err() };
}

describe('runCli', () => {
  it('prints help for no arguments, "help", and --help', async () => {
    for (const argv of [[], ['help'], ['text', '--help'], ['-h']]) {
      const { code, out, err } = await run(argv);
      expect(code).toBe(0);
      expect(err).toBe('');
      expect(out).toMatch(/^repo-search <command> <query> \[options\]/);
      expect(out).toContain('similar|similarity');
      expect(out).toContain('--max, -n <count>   Maximum results (default: 20)');
    }
  });

  it('rejects unknown commands, unknown options, bad counts, and missing queries with exit code 2', async () => {
    const cases: [string[], RegExp][] = [
      [['frobnicate', 'x'], /Unknown command: frobnicate/],
      [['text', 'x', '--bogus'], /Unknown option '--bogus'/],
      [['text', 'x', '--max', '0'], /--max must be an integer of at least 1, got "0"/],
      [['text', 'x', '-C', 'two'], /--context must be an integer of at least 0, got "two"/],
      [['text'], /Missing query for "text"/],
    ];
    for (const [argv, message] of cases) {
      const { code, out, err } = await run(argv);
      expect(code, argv.join(' ')).toBe(2);
      expect(out).toBe('');
      expect(err).toMatch(message);
      expect(err).toContain('Commands:');
    }
  });

  it('searches a repository with every command alias', async () => {
    const root = await makeFixtureRepo();
    const aliases: [string, string, string][] = [
      ['search', 'registerRoutes', 'hybrid'],
      ['hybrid', 'registerRoutes', 'hybrid'],
      ['text', 'permission-check', 'text'],
      ['grep', 'permission-check', 'text'],
      ['regex', 'permission-\\w+', 'regex'],
      ['path', 'routes.ts', 'path'],
      ['files', 'routes.ts', 'path'],
      ['bm25', 'admin permission', 'bm25'],
      ['similar', 'admin action', 'similarity'],
      ['similarity', 'admin action', 'similarity'],
      ['symbol', 'registerRoutes', 'symbol'],
      ['symbols', 'registerRoutes', 'symbol'],
      ['deps', './logger', 'dependency'],
      ['dependency', './logger', 'dependency'],
    ];
    for (const [command, query, method] of aliases) {
      const { code, out, err } = await run([command, query, '--root', root, '--json', '-n', '2']);
      expect(code, command).toBe(0);
      expect(err).toBe('');
      const results = JSON.parse(out) as SearchResult[];
      expect(results.length, command).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(2);
      expect(results[0]?.method, command).toBe(method);
    }
  });

  it('prints human-readable results with context and joins multi-word queries', async () => {
    const root = await makeFixtureRepo();
    const { code, out } = await run(['text', "roles.includes('admin')", '-r', root, '-C', '1']);
    expect(code).toBe(0);
    expect(out).toContain('src/auth.ts:7:17  text  score=1.0000');
    expect(out).toContain(">     return user.roles.includes('admin') || action === 'read';");
    expect(out).toContain("  auditLog('permission-check', user.id);");

    const multiWord = await run(['bm25', 'admin', 'permission', '--root', root]);
    expect(multiWord.out).toContain('src/auth.ts:');

    const none = await run(['text', 'definitely-not-present', '--root', root]);
    expect(none).toEqual({ code: 0, out: 'No results.\n', err: '' });

    const dashed = await run(['text', '--root', root, '--', '-not-a-flag']);
    expect(dashed.code).toBe(0);
  });

  it('prints index stats as JSON', async () => {
    const root = await makeFixtureRepo();
    const { code, out } = await run(['stats', '--root', root]);
    expect(code).toBe(0);
    expect(JSON.parse(out)).toMatchObject({ root, filesIndexed: expect.any(Number) as number });
  });

  it('reports search failures with exit code 1', async () => {
    const root = await makeTempRoot();
    const { code, out, err } = await run(['text', 'x', '--root', path.join(root, 'missing')]);
    expect(code).toBe(1);
    expect(out).toBe('');
    expect(err).toMatch(/ENOENT/);
  });

  it('writes to the process streams by default', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      expect(await runCli(['help'])).toBe(0);
      expect(await runCli(['nope'])).toBe(2);
      expect(stdout).toHaveBeenCalledWith(expect.stringContaining('Commands:'));
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Unknown command: nope'));
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  });
});

describe('formatResults', () => {
  it('renders location, channels, context, and multi-line previews', () => {
    const result: SearchResult = {
      method: 'hybrid',
      path: 'a.ts',
      absolutePath: '/repo/a.ts',
      score: 0.5,
      line: 3,
      endLine: 4,
      language: 'typescript',
      preview: 'one\ntwo',
      contextBefore: ['zero'],
      contextAfter: ['three'],
      matches: [],
      channels: ['text', 'bm25'],
    };
    expect(formatResults([result, { ...result, column: 2, channels: [], contextBefore: [], contextAfter: [] }])).toBe(
      '\na.ts:3  hybrid  score=0.5000 [text,bm25]\n  zero\n> one\n> two\n  three\n' +
        '\na.ts:3:2  hybrid  score=0.5000\n> one\n> two\n',
    );
  });
});

describe('bin entry', () => {
  afterEach(() => {
    process.exitCode = undefined;
    vi.doUnmock('../../src/repo-search/cli/runCli.js');
  });

  it('runs the CLI with process.argv and sets the exit code', async () => {
    const runCliMock = vi.fn(() => Promise.resolve(0));
    vi.doMock('../../src/repo-search/cli/runCli.js', () => ({ runCli: runCliMock }));
    await import('../../src/repo-search/cli.js');
    expect(runCliMock).toHaveBeenCalledWith(process.argv.slice(2));
    expect(process.exitCode).toBe(0);
  });
});
