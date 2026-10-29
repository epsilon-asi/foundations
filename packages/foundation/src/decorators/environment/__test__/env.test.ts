import {
    createEnvSystem,
    Env,
    EnvVar,
    describeEnv,
    loadEnv,
    parseEnvValue,
    toEnvKey,
} from '../';

describe('env static decorator system', () => {
    test('loads string, number, and boolean values into static class fields', () => {
        const { Env, EnvVar, loadEnv } = createEnvSystem();

        @Env({ prefix: 'APP_' })
        class AppEnv {
            @EnvVar.string('ORGANIZATION_ID')
            static organizationId: string;

            @EnvVar.string('CAMPAIGN_ID')
            static campaignId: string;

            @EnvVar.number('PORT')
            static port: number;

            @EnvVar.boolean('DEBUG')
            static debug: boolean;
        }

        const result = loadEnv(AppEnv, {
            source: {
                APP_ORGANIZATION_ID: 'org_123',
                APP_CAMPAIGN_ID: 'cmp_456',
                APP_PORT: '8080',
                APP_DEBUG: 'true',
            },
        });

        expect(AppEnv.organizationId).toBe('org_123');
        expect(AppEnv.campaignId).toBe('cmp_456');
        expect(AppEnv.port).toBe(8080);
        expect(AppEnv.debug).toBe(true);
        expect(result.values).toEqual({
            organizationId: 'org_123',
            campaignId: 'cmp_456',
            port: 8080,
            debug: true,
        });
    });

    test('supports the exported singleton decorators', () => {
        @Env({ prefix: 'APP_' })
        class SingletonEnv {
            @EnvVar.string('API_KEY')
            static apiKey: string;
        }

        loadEnv(SingletonEnv, {
            source: {
                APP_API_KEY: 'secret',
            },
        });

        expect(SingletonEnv.apiKey).toBe('secret');
        expect(describeEnv(SingletonEnv)[0]).toMatchObject({
            propertyName: 'apiKey',
            envName: 'APP_API_KEY',
            static: true,
        });
    });

    test('uses defaults for missing values', () => {
        const { Env, EnvVar, loadEnv } = createEnvSystem();

        @Env()
        class AppEnv {
            @EnvVar.number('PORT', { default: 3000 })
            static port: number;

            @EnvVar.boolean('DEBUG', { default: false })
            static debug: boolean;

            @EnvVar.string('NODE_ENV', { default: 'test' })
            static nodeEnv: string;
        }

        loadEnv(AppEnv, { source: {} });

        expect(AppEnv.port).toBe(3000);
        expect(AppEnv.debug).toBe(false);
        expect(AppEnv.nodeEnv).toBe('test');
    });

    test('allows optional missing values', () => {
        const { Env, EnvVar, loadEnv } = createEnvSystem();

        @Env()
        class AppEnv {
            @EnvVar.string('OPTIONAL_API_KEY', { required: false })
            static optionalApiKey: string | undefined;
        }

        loadEnv(AppEnv, { source: {} });

        expect(AppEnv.optionalApiKey).toBeUndefined();
    });

    test('throws on missing required value', () => {
        const { Env, EnvVar, loadEnv } = createEnvSystem();

        @Env()
        class AppEnv {
            @EnvVar.string('API_KEY')
            static apiKey: string;
        }

        expect(() => loadEnv(AppEnv, { source: {} })).toThrow('API_KEY');
    });

    test('throws on invalid number', () => {
        const { Env, EnvVar, loadEnv } = createEnvSystem();

        @Env()
        class AppEnv {
            @EnvVar.number('PORT')
            static port: number;
        }

        expect(() =>
            loadEnv(AppEnv, {
                source: {
                    PORT: 'abc',
                },
            }),
        ).toThrow('PORT');
    });

    test('supports integer validation', () => {
        const { Env, EnvVar, loadEnv } = createEnvSystem();

        @Env()
        class AppEnv {
            @EnvVar.number('WORKERS', { integer: true })
            static workers: number;
        }

        expect(() =>
            loadEnv(AppEnv, {
                source: {
                    WORKERS: '1.5',
                },
            }),
        ).toThrow('integer');

        loadEnv(AppEnv, {
            source: {
                WORKERS: '2',
            },
        });

        expect(AppEnv.workers).toBe(2);
    });

    test('supports min and max validation', () => {
        const { Env, EnvVar, loadEnv } = createEnvSystem();

        @Env()
        class AppEnv {
            @EnvVar.number('PORT', {
                min: 1,
                max: 65535,
            })
            static port: number;
        }

        expect(() =>
            loadEnv(AppEnv, {
                source: {
                    PORT: '0',
                },
            }),
        ).toThrow('>= 1');

        expect(() =>
            loadEnv(AppEnv, {
                source: {
                    PORT: '70000',
                },
            }),
        ).toThrow('<= 65535');

        loadEnv(AppEnv, {
            source: {
                PORT: '5432',
            },
        });

        expect(AppEnv.port).toBe(5432);
    });

    const booleanCases: Array<[string, boolean]> = [
        ['true', true],
        ['1', true],
        ['yes', true],
        ['y', true],
        ['on', true],
        ['false', false],
        ['0', false],
        ['no', false],
        ['n', false],
        ['off', false],
    ];

    for (const [raw, expected] of booleanCases) {
        test(`parses boolean value ${raw}`, () => {
            const { Env, EnvVar, loadEnv } = createEnvSystem();

            @Env()
            class AppEnv {
                @EnvVar.boolean('DEBUG')
                static debug: boolean;
            }

            loadEnv(AppEnv, {
                source: {
                    DEBUG: raw,
                },
            });

            expect(AppEnv.debug).toBe(expected);
        });
    }

    test('throws on invalid boolean', () => {
        const { Env, EnvVar, loadEnv } = createEnvSystem();

        @Env()
        class AppEnv {
            @EnvVar.boolean('DEBUG')
            static debug: boolean;
        }

        expect(() =>
            loadEnv(AppEnv, {
                source: {
                    DEBUG: 'maybe',
                },
            }),
        ).toThrow('DEBUG');
    });

    test('infers env name from property name', () => {
        const { Env, EnvVar, loadEnv } = createEnvSystem();

        @Env({ prefix: 'APP_' })
        class AppEnv {
            @EnvVar.string()
            static organizationId: string;

            @EnvVar.number()
            static retryCount: number;
        }

        loadEnv(AppEnv, {
            source: {
                APP_ORGANIZATION_ID: 'org_123',
                APP_RETRY_COUNT: '7',
            },
        });

        expect(AppEnv.organizationId).toBe('org_123');
        expect(AppEnv.retryCount).toBe(7);
    });

    test('describeEnv returns definitions without mutating the class', () => {
        const { Env, EnvVar, describeEnv } = createEnvSystem();

        @Env({ prefix: 'APP_' })
        class AppEnv {
            @EnvVar.string('API_KEY')
            static apiKey: string;
        }

        const definitions = describeEnv(AppEnv);

        expect(definitions).toEqual([
            {
                propertyName: 'apiKey',
                envName: 'APP_API_KEY',
                static: true,
                private: false,
                metadata: {
                    type: 'string',
                    name: 'API_KEY',
                },
            },
        ]);
        expect(AppEnv.apiKey).toBeUndefined();
    });

    test('throws if decorated env var is not static by default', () => {
        const { Env, EnvVar, loadEnv } = createEnvSystem();

        @Env()
        class AppEnv {
            @EnvVar.string('API_KEY')
            apiKey!: string;
        }

        expect(() =>
            loadEnv(AppEnv, {
                source: {
                    API_KEY: 'secret',
                },
            }),
        ).toThrow('must be static');
    });

    test('can opt out of static requirement but still mutates the class object', () => {
        const { Env, EnvVar, loadEnv } = createEnvSystem();

        @Env()
        class AppEnv {
            @EnvVar.string('API_KEY')
            apiKey!: string;
        }

        loadEnv(AppEnv, {
            requireStatic: false,
            source: {
                API_KEY: 'secret',
            },
        });

        expect((AppEnv as unknown as { apiKey: string }).apiKey).toBe('secret');
    });

    test('empty string is treated as missing by default', () => {
        const { Env, EnvVar, loadEnv } = createEnvSystem();

        @Env()
        class AppEnv {
            @EnvVar.string('API_KEY', { default: 'default-key' })
            static apiKey: string;
        }

        loadEnv(AppEnv, {
            source: {
                API_KEY: '',
            },
        });

        expect(AppEnv.apiKey).toBe('default-key');
    });

    test('empty string can be preserved for strings', () => {
        const { Env, EnvVar, loadEnv } = createEnvSystem();

        @Env()
        class AppEnv {
            @EnvVar.string('API_KEY')
            static apiKey: string;
        }

        loadEnv(AppEnv, {
            emptyStringAsMissing: false,
            source: {
                API_KEY: '',
            },
        });

        expect(AppEnv.apiKey).toBe('');
    });

    test('loads inherited env vars by default', () => {
        const { Env, EnvVar, loadEnv } = createEnvSystem();

        @Env({ prefix: 'APP_' })
        class BaseEnv {
            @EnvVar.string('BASE_URL')
            static baseUrl: string;
        }

        @Env({ prefix: 'APP_' })
        class ChildEnv extends BaseEnv {
            @EnvVar.number('PORT')
            static port: number;
        }

        loadEnv(ChildEnv, {
            source: {
                APP_BASE_URL: 'https://example.com',
                APP_PORT: '3000',
            },
        });

        expect(ChildEnv.baseUrl).toBe('https://example.com');
        expect(ChildEnv.port).toBe(3000);
    });

    test('can load only own env vars', () => {
        const { Env, EnvVar, loadEnv } = createEnvSystem();

        @Env({ prefix: 'APP_' })
        class BaseEnv {
            @EnvVar.string('BASE_URL')
            static baseUrl: string;
        }

        @Env({ prefix: 'APP_' })
        class ChildEnv extends BaseEnv {
            @EnvVar.number('PORT')
            static port: number;
        }

        loadEnv(ChildEnv, {
            includeInherited: false,
            source: {
                APP_PORT: '3000',
            },
        });

        expect(ChildEnv.port).toBe(3000);
        expect(Object.prototype.hasOwnProperty.call(ChildEnv, 'baseUrl')).toBe(false);
    });

    test('subclass env config overrides inherited env config', () => {
        const { Env, EnvVar, loadEnv } = createEnvSystem();

        @Env({ prefix: 'BASE_' })
        class BaseEnv {
            @EnvVar.string('TOKEN')
            static token: string;
        }

        @Env({ prefix: 'CHILD_' })
        class ChildEnv extends BaseEnv {}

        loadEnv(ChildEnv, {
            source: {
                CHILD_TOKEN: 'child-token',
            },
        });

        expect(ChildEnv.token).toBe('child-token');
    });

    test('throws for symbol member keys', () => {
        const { Env, EnvVar, loadEnv } = createEnvSystem();
        const secret = Symbol('secret');

        @Env()
        class AppEnv {
            @EnvVar.string('SECRET')
            static [secret]: string;
        }

        expect(() =>
            loadEnv(AppEnv, {
                source: {
                    SECRET: 'secret',
                },
            }),
        ).toThrow('symbol');
    });

    test('toEnvKey converts common property names to screaming snake case', () => {
        expect(toEnvKey('organizationId')).toBe('ORGANIZATION_ID');
        expect(toEnvKey('campaignId')).toBe('CAMPAIGN_ID');
        expect(toEnvKey('apiURL')).toBe('API_URL');
        expect(toEnvKey('URLValue')).toBe('URL_VALUE');
        expect(toEnvKey('worker-count')).toBe('WORKER_COUNT');
    });

    test('parseEnvValue can be unit-tested directly', () => {
        expect(
            parseEnvValue({
                envName: 'PORT',
                propertyName: 'port',
                rawValue: '3000',
                metadata: {
                    type: 'number',
                },
                emptyStringAsMissing: true,
            }),
        ).toBe(3000);

        expect(
            parseEnvValue({
                envName: 'DEBUG',
                propertyName: 'debug',
                rawValue: 'yes',
                metadata: {
                    type: 'boolean',
                },
                emptyStringAsMissing: true,
            }),
        ).toBe(true);
    });
});
