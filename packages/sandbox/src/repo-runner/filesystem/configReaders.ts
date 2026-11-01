import { parse as parseJsoncText, printParseErrorCode, type ParseError } from 'jsonc-parser';
import { parse as parseTomlText } from 'smol-toml';
import type { z } from 'zod';

import { RepoConfigParseError } from '../errors/repoRunnerErrors.js';
import { readTextFile } from './fileReaders.js';

/**
 * Reads `filePath` and parses it with `parse`; any parse failure becomes a `RepoConfigParseError`
 * (with the original error as `cause`). A missing file surfaces as the underlying `ENOENT` error.
 */
export async function readConfigFile<T>(filePath: string, parse: (text: string) => T): Promise<T> {
  const text = await readTextFile(filePath);
  try {
    return parse(text);
  } catch (error) {
    throw new RepoConfigParseError(filePath, error instanceof Error ? error.message : String(error), { cause: error });
  }
}

function parseJson(text: string): unknown {
  return JSON.parse(text);
}

/** Parses JSON with comments and trailing commas (tsconfig-style). */
function parseJsonc(text: string): unknown {
  const errors: ParseError[] = [];
  const value: unknown = parseJsoncText(text, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length > 0) {
    throw new Error(errors.map((error) => `${printParseErrorCode(error.error)} at offset ${error.offset}`).join('; '));
  }
  return value;
}

/** Reads a strict JSON file. */
export function readJsonFile(filePath: string): Promise<unknown> {
  return readConfigFile(filePath, parseJson);
}

/** Reads a JSONC file (comments and trailing commas allowed). */
export function readJsoncFile(filePath: string): Promise<unknown> {
  return readConfigFile(filePath, parseJsonc);
}

/** Reads a TOML file. */
export function readTomlFile(filePath: string): Promise<unknown> {
  return readConfigFile(filePath, parseTomlText);
}

function formatIssuePath(path: readonly PropertyKey[]): string {
  return path.length > 0 ? path.map(String).join('.') : '(root)';
}

/** Validates parsed config content, turning schema issues into a `RepoConfigParseError` that names each issue path. */
export function parseWithSchema<T>(schema: z.ZodType<T>, value: unknown, filePath: string): T {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  const details = result.error.issues.map((issue) => `${formatIssuePath(issue.path)}: ${issue.message}`).join('; ');
  throw new RepoConfigParseError(filePath, details, { cause: result.error });
}
