import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { RepoConfigParseError } from '../../../src/repo-runner/errors/repoRunnerErrors.js';
import {
  findTypescriptConfig,
  readTypescriptConfig,
} from '../../../src/repo-runner/runners/node-typescript/typescriptConfigReader.js';
import { fixturePath, makeTempDir } from '../helpers/testUtils.js';

async function writeTsconfig(content: string): Promise<string> {
  const filePath = path.join(await makeTempDir('tsconfig'), 'tsconfig.json');
  await writeFile(filePath, content, 'utf8');
  return filePath;
}

describe('typescriptConfigReader', () => {
  it('finds tsconfig.json when present', async () => {
    await expect(findTypescriptConfig(fixturePath('node-basic'))).resolves.toBe(
      path.join(fixturePath('node-basic'), 'tsconfig.json'),
    );
  });

  it('returns null when no tsconfig is present', async () => {
    await expect(findTypescriptConfig(fixturePath('node-no-tsconfig'))).resolves.toBeNull();
  });

  it('parses JSONC tsconfig content with comments', async () => {
    const config = await readTypescriptConfig(path.join(fixturePath('node-basic'), 'tsconfig.json'));

    expect(config.compilerOptions).toEqual({ target: 'ES2022', module: 'NodeNext' });
  });

  it('accepts trailing commas', async () => {
    const config = await readTypescriptConfig(await writeTsconfig('{ "compilerOptions": { "strict": true, }, }'));

    expect(config).toEqual({ compilerOptions: { strict: true } });
  });

  it('throws RepoConfigParseError on invalid tsconfig content', async () => {
    await expect(readTypescriptConfig(await writeTsconfig('{ // broken'))).rejects.toBeInstanceOf(RepoConfigParseError);
  });

  it('throws RepoConfigParseError when tsconfig is not an object', async () => {
    await expect(readTypescriptConfig(await writeTsconfig('[1,2,3]'))).rejects.toBeInstanceOf(RepoConfigParseError);
  });
});
