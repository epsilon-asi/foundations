import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { RepoConfigParseError } from '../../../src/repo-runner/errors/repoRunnerErrors.js';
import {
  parseWithSchema,
  readConfigFile,
  readJsoncFile,
  readJsonFile,
  readTomlFile,
} from '../../../src/repo-runner/filesystem/configReaders.js';
import { listFiles } from '../../../src/repo-runner/filesystem/fileReaders.js';
import { makeTempDir } from '../helpers/testUtils.js';

async function writeTemp(name: string, content: string): Promise<string> {
  const filePath = path.join(await makeTempDir('config'), name);
  await writeFile(filePath, content, 'utf8');
  return filePath;
}

describe('config readers', () => {
  it('reads strict JSON and rejects comments', async () => {
    await expect(readJsonFile(await writeTemp('a.json', '{"a": [1, 2]}'))).resolves.toEqual({ a: [1, 2] });

    const invalid = await writeTemp('b.json', '{ // comment\n "a": 1 }');
    await expect(readJsonFile(invalid)).rejects.toBeInstanceOf(RepoConfigParseError);
    await expect(readJsonFile(invalid)).rejects.toMatchObject({
      filePath: invalid,
      cause: expect.any(SyntaxError) as unknown,
    });
  });

  it('reads JSONC with comments and trailing commas', async () => {
    const filePath = await writeTemp('tsconfig.json', '{\n  // comment\n  "a": { "b": [1, 2,], },\n  /* block */\n}');

    await expect(readJsoncFile(filePath)).resolves.toEqual({ a: { b: [1, 2] } });
  });

  it('reports JSONC syntax errors with the error code and offset', async () => {
    const filePath = await writeTemp('broken.json', '{ "a": 1');

    await expect(readJsoncFile(filePath)).rejects.toThrow(
      new RepoConfigParseError(filePath, 'CloseBraceExpected at offset 8'),
    );
  });

  it('reads TOML and wraps TOML syntax errors', async () => {
    await expect(readTomlFile(await writeTemp('a.toml', '[tool]\nname = "x"\n'))).resolves.toEqual({
      tool: { name: 'x' },
    });
    await expect(readTomlFile(await writeTemp('b.toml', 'not = [valid'))).rejects.toBeInstanceOf(RepoConfigParseError);
  });

  it('wraps non-Error parse failures too', async () => {
    const filePath = await writeTemp('x.txt', 'x');
    const parse = (): never => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- exercising the non-Error branch
      throw 'boom';
    };

    await expect(readConfigFile(filePath, parse)).rejects.toThrow(new RepoConfigParseError(filePath, 'boom'));
  });

  it('surfaces a missing file as the underlying ENOENT error, not a parse error', async () => {
    const missing = path.join(await makeTempDir('missing'), 'nope.json');

    await expect(readJsonFile(missing)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readJsonFile(missing)).rejects.not.toBeInstanceOf(RepoConfigParseError);
  });

  it('parseWithSchema returns validated data or names every failing issue path', () => {
    const schema = z.object({ scripts: z.record(z.string(), z.string()), name: z.string() });

    expect(parseWithSchema(schema, { scripts: { a: 'b' }, name: 'x' }, '/repo/package.json')).toEqual({
      scripts: { a: 'b' },
      name: 'x',
    });

    expect(() => parseWithSchema(schema, { scripts: { test: 1 }, name: 2 }, '/repo/package.json')).toThrow(
      /^Failed to parse \/repo\/package\.json: scripts\.test: .+; name: .+$/,
    );
    expect(() => parseWithSchema(schema, [], '/repo/package.json')).toThrow(/\(root\): /);
  });
});

describe('file readers', () => {
  it('listFiles returns sorted regular files, [] for a missing path or a file, and rethrows other errors', async () => {
    const dir = path.dirname(await writeTemp('b.tf', ''));
    await writeFile(path.join(dir, 'a.tf'), '', 'utf8');

    await expect(listFiles(dir)).resolves.toEqual(['a.tf', 'b.tf']);
    await expect(listFiles(path.join(dir, 'missing'))).resolves.toEqual([]);
    await expect(listFiles(path.join(dir, 'a.tf'))).resolves.toEqual([]);
    await expect(listFiles('bad\u0000path')).rejects.toThrow();
  });
});
