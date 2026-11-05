import {readFileSync} from 'node:fs';
import path from 'node:path';
import {parse} from 'dotenv';
import {EnvParseError} from './errors';

export const DEFAULT_DOTENV_PATH = '.env';

export interface DotenvOptions {
    /**
     * File or files to read, resolved against `cwd`. When several are listed, later files
     * take precedence over earlier ones, e.g. ['.env', '.env.local'].
     *
     * Defaults to '.env'.
     */
    path?: string | readonly string[];

    /** Directory that relative paths resolve from. Defaults to process.cwd() at load time. */
    cwd?: string;

    /**
     * Whether dotenv values take precedence over the env source (process.env by default).
     *
     * Defaults to true.
     */
    override?: boolean;

    /**
     * Whether a listed file that does not exist is an error.
     *
     * Defaults to false, so a missing file is skipped.
     */
    required?: boolean;

    /** Defaults to 'utf8'. */
    encoding?: BufferEncoding;
}

/**
 * How dotenv files feed loadEnv():
 * - `undefined` or `true`: read the default '.env' file.
 * - `false`: do not read any dotenv file.
 * - a path or list of paths: read those files.
 * - an options object: full control.
 */
export type DotenvSetting = boolean | string | readonly string[] | DotenvOptions;

export interface DotenvReadResult {
    /** Merged values from every file that was read. */
    readonly values: Readonly<Record<string, string>>;

    /** Absolute paths of the files that were read, in load order. */
    readonly files: readonly string[];
}

/**
 * Combines the class-level @Env({ dotenv }) setting with the loadEnv({ dotenv }) option.
 * Dotenv is on unless one of them is `false`; the call's options are merged over the class's.
 * Returns undefined when dotenv is turned off.
 */
export function resolveDotenvOptions(
    classSetting: DotenvSetting | undefined,
    callSetting: DotenvSetting | undefined,
): DotenvOptions | undefined {
    const fromClass = normalizeDotenvSetting(classSetting);
    if (callSetting === undefined) return fromClass;

    const fromCall = normalizeDotenvSetting(callSetting);
    if (fromCall === undefined) return undefined;

    return {...fromClass, ...definedOnly(fromCall)};
}

/** Reads and merges dotenv files without touching process.env. */
export function readDotenvFiles(options: DotenvOptions = {}): DotenvReadResult {
    const cwd = options.cwd ?? process.cwd();
    const paths = isPathList(options.path) ? options.path : [options.path ?? DEFAULT_DOTENV_PATH];
    const values: Record<string, string> = Object.create(null);
    const files: string[] = [];

    for (const entry of paths) {
        const filePath = path.resolve(cwd, entry);
        const text = readDotenvFile(filePath, options);
        if (text === undefined) continue;

        Object.assign(values, parse(text));
        files.push(filePath);
    }

    return Object.freeze({
        values: Object.freeze(values),
        files: Object.freeze(files),
    });
}

function readDotenvFile(filePath: string, options: DotenvOptions): string | undefined {
    try {
        return readFileSync(filePath, {encoding: options.encoding ?? 'utf8'});
    } catch (cause) {
        if ((cause as NodeJS.ErrnoException)?.code === 'ENOENT') {
            if (options.required !== true) return undefined;
            throw new EnvParseError(`Required dotenv file "${filePath}" does not exist.`, {filePath, cause});
        }

        const reason = cause instanceof Error ? cause.message : String(cause);
        throw new EnvParseError(`Failed to read dotenv file "${filePath}": ${reason}`, {filePath, cause});
    }
}

function normalizeDotenvSetting(setting: DotenvSetting | undefined): DotenvOptions | undefined {
    if (setting === false) return undefined;
    if (setting === undefined || setting === true) return {};
    if (typeof setting === 'string' || isPathList(setting)) return {path: setting};
    return setting;
}

function isPathList(value: unknown): value is readonly string[] {
    return Array.isArray(value);
}

function definedOnly(options: DotenvOptions): DotenvOptions {
    return Object.fromEntries(
        Object.entries(options).filter(([, value]) => value !== undefined),
    ) as DotenvOptions;
}
