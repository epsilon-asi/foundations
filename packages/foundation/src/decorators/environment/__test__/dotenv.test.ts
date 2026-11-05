import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createEnvSystem, EnvParseError, readDotenvFiles} from '../';

let dir: string;
let cwd: jest.SpyInstance<string, []>;

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'env-dotenv-'));
    cwd = jest.spyOn(process, 'cwd').mockReturnValue(dir);
});

afterEach(() => {
    cwd.mockRestore();
    rmSync(dir, {recursive: true, force: true});
});

function file(name: string, contents: string, base = dir): string {
    const filePath = join(base, name);
    writeFileSync(filePath, contents);
    return filePath;
}

function caught(run: () => unknown): EnvParseError {
    try {
        run();
    } catch (error) {
        return error as EnvParseError;
    }
    throw new Error('Expected the call to throw.');
}

describe('dotenv is on by default', () => {
    test('reads .env from the working directory with no configuration', () => {
        const {Env, EnvVar, loadEnv} = createEnvSystem();
        const envFile = file('.env', 'APP_API_KEY=from-dotenv\nAPP_PORT=8080\nAPP_DEBUG=yes\n');

        @Env({prefix: 'APP_'})
        class AppEnv {
            @EnvVar.string('API_KEY')
            static apiKey: string;

            @EnvVar.number('PORT')
            static port: number;

            @EnvVar.boolean('DEBUG')
            static debug: boolean;
        }

        const result = loadEnv(AppEnv, {source: {}});

        expect(AppEnv.apiKey).toBe('from-dotenv');
        expect(AppEnv.port).toBe(8080);
        expect(AppEnv.debug).toBe(true);
        expect(result.dotenvFiles).toEqual([envFile]);
    });

    test('applies to classes without an @Env decorator', () => {
        const {EnvVar, loadEnv} = createEnvSystem();
        file('.env', 'API_KEY=from-dotenv');

        class AppEnv {
            @EnvVar.string('API_KEY')
            static apiKey: string;
        }

        loadEnv(AppEnv, {source: {}});

        expect(AppEnv.apiKey).toBe('from-dotenv');
    });

    test('reads process.env and .env together when no source is passed', () => {
        const {EnvVar, loadEnv} = createEnvSystem();
        file('.env', 'FOUNDATION_DOTENV_TEST_FILE=from-dotenv');
        process.env.FOUNDATION_DOTENV_TEST_PROCESS = 'from-process';

        class AppEnv {
            @EnvVar.string('FOUNDATION_DOTENV_TEST_FILE')
            static fromFile: string;

            @EnvVar.string('FOUNDATION_DOTENV_TEST_PROCESS')
            static fromProcess: string;
        }

        try {
            loadEnv(AppEnv);
        } finally {
            delete process.env.FOUNDATION_DOTENV_TEST_PROCESS;
        }

        expect(AppEnv.fromFile).toBe('from-dotenv');
        expect(AppEnv.fromProcess).toBe('from-process');
        expect(process.env.FOUNDATION_DOTENV_TEST_FILE).toBeUndefined();
    });

    test('dotenv values take precedence over the source', () => {
        const {EnvVar, loadEnv} = createEnvSystem();
        file('.env', 'API_KEY=from-dotenv');

        class AppEnv {
            @EnvVar.string('API_KEY')
            static apiKey: string;

            @EnvVar.string('REGION')
            static region: string;
        }

        loadEnv(AppEnv, {source: {API_KEY: 'from-source', REGION: 'us-east-1'}});

        expect(AppEnv.apiKey).toBe('from-dotenv');
        expect(AppEnv.region).toBe('us-east-1');
    });

    test('a missing .env is skipped', () => {
        const {EnvVar, loadEnv} = createEnvSystem();

        class AppEnv {
            @EnvVar.string('API_KEY')
            static apiKey: string;
        }

        const result = loadEnv(AppEnv, {source: {API_KEY: 'from-source'}});

        expect(AppEnv.apiKey).toBe('from-source');
        expect(result.dotenvFiles).toEqual([]);
    });

    test('an empty dotenv value counts as missing by default', () => {
        const {EnvVar, loadEnv} = createEnvSystem();
        file('.env', 'API_KEY=');

        class AppEnv {
            @EnvVar.string('API_KEY', {default: 'fallback'})
            static apiKey: string;
        }

        loadEnv(AppEnv, {source: {API_KEY: 'from-source'}});

        expect(AppEnv.apiKey).toBe('fallback');
    });

    test('uses dotenv syntax for quotes, comments, export and multiline values', () => {
        file(
            '.env',
            [
                '# comment line',
                'export EXPORTED=yes',
                'SINGLE=\'single # not a comment\'',
                'DOUBLE="line one\\nline two"',
                'UNQUOTED=value # trailing comment',
                'MULTILINE="first',
                'second"',
            ].join('\n'),
        );

        expect(readDotenvFiles().values).toEqual({
            EXPORTED: 'yes',
            SINGLE: 'single # not a comment',
            DOUBLE: 'line one\nline two',
            UNQUOTED: 'value',
            MULTILINE: 'first\nsecond',
        });
    });
});

describe('opting out', () => {
    test('@Env({ dotenv: false }) opts a class out', () => {
        const {Env, EnvVar, loadEnv} = createEnvSystem();
        file('.env', 'API_KEY=from-dotenv');

        @Env({dotenv: false})
        class AppEnv {
            @EnvVar.string('API_KEY')
            static apiKey: string;
        }

        const result = loadEnv(AppEnv, {source: {API_KEY: 'from-source'}});

        expect(AppEnv.apiKey).toBe('from-source');
        expect(result.dotenvFiles).toEqual([]);
    });

    test('loadEnv({ dotenv: false }) opts a single call out', () => {
        const {Env, EnvVar, loadEnv} = createEnvSystem();
        file('.env', 'API_KEY=from-dotenv');

        @Env({dotenv: '.env'})
        class AppEnv {
            @EnvVar.string('API_KEY')
            static apiKey: string;
        }

        expect(() => loadEnv(AppEnv, {dotenv: false, source: {}})).toThrow('API_KEY');
    });

    test('loadEnv({ dotenv: true }) turns it back on for a class that opted out', () => {
        const {Env, EnvVar, loadEnv} = createEnvSystem();
        file('.env', 'API_KEY=from-dotenv');

        @Env({dotenv: false})
        class AppEnv {
            @EnvVar.string('API_KEY')
            static apiKey: string;
        }

        loadEnv(AppEnv, {dotenv: true, source: {}});

        expect(AppEnv.apiKey).toBe('from-dotenv');
    });

    test('override: false lets the source win over dotenv', () => {
        const {Env, EnvVar, loadEnv} = createEnvSystem();
        file('.env', 'API_KEY=from-dotenv\nREGION=from-dotenv');

        @Env({dotenv: {override: false}})
        class AppEnv {
            @EnvVar.string('API_KEY')
            static apiKey: string;

            @EnvVar.string('REGION')
            static region: string;
        }

        loadEnv(AppEnv, {source: {API_KEY: 'from-source'}});

        expect(AppEnv.apiKey).toBe('from-source');
        expect(AppEnv.region).toBe('from-dotenv');
    });
});

describe('configuring files', () => {
    test('reads several files, later files winning', () => {
        const {Env, EnvVar, loadEnv} = createEnvSystem();
        const base = file('.env', 'API_KEY=base\nREGION=base-region');
        const local = file('.env.local', 'API_KEY=local');

        @Env({dotenv: ['.env', '.env.local', '.env.missing']})
        class AppEnv {
            @EnvVar.string('API_KEY')
            static apiKey: string;

            @EnvVar.string('REGION')
            static region: string;
        }

        const result = loadEnv(AppEnv, {source: {}});

        expect(AppEnv.apiKey).toBe('local');
        expect(AppEnv.region).toBe('base-region');
        expect(result.dotenvFiles).toEqual([base, local]);
    });

    test('loadEnv options are merged over the class setting', () => {
        const {Env, EnvVar, loadEnv} = createEnvSystem();
        file('.env.test', 'API_KEY=from-dotenv\nREGION=from-dotenv');

        @Env({dotenv: '.env.test'})
        class AppEnv {
            @EnvVar.string('API_KEY')
            static apiKey: string;

            @EnvVar.string('REGION')
            static region: string;
        }

        loadEnv(AppEnv, {dotenv: {override: false, path: undefined}, source: {API_KEY: 'from-source'}});

        expect(AppEnv.apiKey).toBe('from-source');
        expect(AppEnv.region).toBe('from-dotenv');
    });

    test('a loadEnv path replaces the class path', () => {
        const {Env, EnvVar, loadEnv} = createEnvSystem();
        file('.env', 'API_KEY=default-file');
        file('.env.ci', 'API_KEY=ci-file');

        @Env({dotenv: '.env'})
        class AppEnv {
            @EnvVar.string('API_KEY')
            static apiKey: string;
        }

        loadEnv(AppEnv, {dotenv: '.env.ci', source: {}});

        expect(AppEnv.apiKey).toBe('ci-file');
    });

    test('resolves relative paths against cwd and accepts absolute paths', () => {
        const {EnvVar, loadEnv} = createEnvSystem();
        const config = join(dir, 'config');
        mkdirSync(config);
        const relative = file('.env', 'API_KEY=from-config-dir', config);
        const absolute = file('absolute.env', 'REGION=from-absolute');

        class AppEnv {
            @EnvVar.string('API_KEY')
            static apiKey: string;

            @EnvVar.string('REGION')
            static region: string;
        }

        const result = loadEnv(AppEnv, {dotenv: {cwd: config, path: ['.env', absolute]}, source: {}});

        expect(AppEnv.apiKey).toBe('from-config-dir');
        expect(AppEnv.region).toBe('from-absolute');
        expect(result.dotenvFiles).toEqual([relative, absolute]);
    });

    test('subclass @Env settings replace inherited dotenv settings', () => {
        const {Env, EnvVar, loadEnv} = createEnvSystem();
        file('.env', 'API_KEY=from-dotenv');

        @Env({dotenv: false})
        class BaseEnv {
            @EnvVar.string('API_KEY')
            static apiKey: string;
        }

        @Env()
        class ChildEnv extends BaseEnv {}

        loadEnv(ChildEnv, {source: {}});

        expect(ChildEnv.apiKey).toBe('from-dotenv');
    });
});

describe('dotenv errors', () => {
    test('required: true throws when a file is missing', () => {
        const {Env, EnvVar, loadEnv} = createEnvSystem();

        @Env({dotenv: {path: '.env.production', required: true}})
        class AppEnv {
            @EnvVar.string('API_KEY', {required: false})
            static apiKey: string | undefined;
        }

        const error = caught(() => loadEnv(AppEnv, {source: {}}));

        expect(error).toBeInstanceOf(EnvParseError);
        expect(error.message).toContain('does not exist');
        expect(error.filePath).toBe(join(dir, '.env.production'));
    });

    test('a file that cannot be read throws even when not required', () => {
        const {EnvVar, loadEnv} = createEnvSystem();
        mkdirSync(join(dir, '.env'));

        class AppEnv {
            @EnvVar.string('API_KEY', {required: false})
            static apiKey: string | undefined;
        }

        const error = caught(() => loadEnv(AppEnv, {source: {}}));

        expect(error).toBeInstanceOf(EnvParseError);
        expect(error.message).toContain('Failed to read dotenv file');
        expect(error.filePath).toBe(join(dir, '.env'));
        expect(error.cause).toBeDefined();
    });
});

describe('readDotenvFiles', () => {
    test('returns merged values and the files read, without touching process.env', () => {
        const envFile = file('.env', 'FOUNDATION_DOTENV_READ_TEST=value');

        const result = readDotenvFiles();

        expect(result.values.FOUNDATION_DOTENV_READ_TEST).toBe('value');
        expect(result.files).toEqual([envFile]);
        expect(process.env.FOUNDATION_DOTENV_READ_TEST).toBeUndefined();
    });

    test('values do not inherit Object.prototype keys', () => {
        file('.env', 'API_KEY=value');

        expect(readDotenvFiles().values.constructor).toBeUndefined();
    });
});
