import path from 'node:path';

import { z } from 'zod';

import { fileExists } from '../../../shared/fs.js';
import { parseWithSchema, readJsoncFile } from '../../filesystem/configReaders.js';

const typescriptConfigSchema = z.record(z.string(), z.unknown());

/** Absolute path of `<repoPath>/tsconfig.json`, or `null` when it does not exist. */
export async function findTypescriptConfig(repoPath: string): Promise<string | null> {
  const configPath = path.resolve(repoPath, 'tsconfig.json');
  return (await fileExists(configPath)) ? configPath : null;
}

/** Parses a tsconfig file (JSONC). `extends` is not followed. */
export async function readTypescriptConfig(filePath: string): Promise<Record<string, unknown>> {
  return parseWithSchema(typescriptConfigSchema, await readJsoncFile(filePath), filePath);
}
