import type {Constructor, RegistryMetadataSnapshot} from '../factory';
import {createDecoratorRegistry} from '../factory';
import {readDotenvFiles, resolveDotenvOptions} from './dotenv';
import {EnvParseError} from './errors';
import {parseEnvValue, toEnvKey} from './parse';
import type {
    BooleanEnvVarMetadata,
    DescribeEnvOptions,
    EnvConfigDecorator,
    EnvConfigMetadata,
    EnvDecoratorSchema,
    EnvLoadResult,
    EnvPrimitiveOrUndefined,
    EnvSource,
    EnvSystem,
    EnvVarDecoratorApi,
    EnvVariableDefinition,
    EnvVarMetadata,
    LoadEnvOptions,
    NumberEnvVarMetadata,
    StringEnvVarMetadata,
} from './types';

export function createEnvSystem(): EnvSystem {
    const registry = createDecoratorRegistry<EnvDecoratorSchema>({
        namespace: 'env',
    });

    const RawEnvConfig = registry.class('envConfig') as unknown as EnvConfigDecorator;

    const Env = ((metadata?: EnvConfigMetadata) => {
        return metadata === undefined ? RawEnvConfig() : RawEnvConfig(metadata);
    }) as EnvConfigDecorator;

    const EnvConfig = Env;

    /**
     * Broad scoped contract because this system decorates arbitrary env classes.
     * The public EnvVar.string/number/boolean helper return types enforce the actual
     * decorated property type.
     */
    const Scoped = registry.for<Record<string, EnvPrimitiveOrUndefined>>();
    const RawEnvVar = Scoped.property('envVar');

    const EnvVar = ((metadata: EnvVarMetadata) => RawEnvVar(metadata)) as EnvVarDecoratorApi;

    EnvVar.string = (
        name?: string,
        options: Omit<StringEnvVarMetadata, 'type' | 'name'> = {},
    ) => {
        return RawEnvVar({
            ...options,
            name,
            type: 'string',
        }) as (
            value: undefined,
            context: ClassFieldDecoratorContext<any, string | undefined>,
        ) => void;
    };

    EnvVar.number = (
        name?: string,
        options: Omit<NumberEnvVarMetadata, 'type' | 'name'> = {},
    ) => {
        return RawEnvVar({
            ...options,
            name,
            type: 'number',
        }) as (
            value: undefined,
            context: ClassFieldDecoratorContext<any, number | undefined>,
        ) => void;
    };

    EnvVar.boolean = (
        name?: string,
        options: Omit<BooleanEnvVarMetadata, 'type' | 'name'> = {},
    ) => {
        return RawEnvVar({
            ...options,
            name,
            type: 'boolean',
        }) as (
            value: undefined,
            context: ClassFieldDecoratorContext<any, boolean | undefined>,
        ) => void;
    };

    function describeEnv<TClass extends Constructor>(
        target: TClass,
        options: DescribeEnvOptions = {},
    ): readonly EnvVariableDefinition[] {
        const includeInherited = options.includeInherited ?? true;
        const snapshot = registry.read(target, {includeInherited});
        const classMetadata = getEnvConfigMetadata(snapshot);
        const prefix = classMetadata?.prefix ?? '';

        return Object.freeze(
            snapshot.propertyRecords('envVar').map((record) => {
                if (record.memberName === undefined) {
                    throw new EnvParseError('EnvVar metadata record is missing memberName.');
                }

                if (typeof record.memberName === 'symbol') {
                    throw new EnvParseError(
                        `EnvVar does not support symbol member keys: ${String(record.memberName)}.`,
                    );
                }

                const metadata = record.metadata as EnvVarMetadata;
                const propertyName = record.memberName;
                const envName = prefix + (metadata.name ?? toEnvKey(propertyName));

                return Object.freeze({
                    propertyName,
                    envName,
                    static: record.static,
                    private: record.private,
                    metadata,
                });
            }),
        );
    }

    function loadEnv<TClass extends Constructor>(
        target: TClass,
        options: LoadEnvOptions = {},
    ): EnvLoadResult<TClass> {
        const source = options.source ?? getDefaultEnvSource();
        const requireStatic = options.requireStatic ?? true;
        const emptyStringAsMissing = options.emptyStringAsMissing ?? true;
        const includeInherited = options.includeInherited ?? true;

        const snapshot = registry.read(target, {includeInherited});
        const definitions = describeEnv(target, {includeInherited});
        const values: Record<string, EnvPrimitiveOrUndefined> = {};

        const dotenvOptions = resolveDotenvOptions(
            getEnvConfigMetadata(snapshot)?.dotenv,
            options.dotenv,
        );
        const dotenv = dotenvOptions === undefined ? undefined : readDotenvFiles(dotenvOptions);
        const dotenvWins = dotenvOptions?.override ?? true;
        const lookup = (envName: string): string | undefined => {
            const fromDotenv = dotenv?.values[envName];
            return dotenvWins ? fromDotenv ?? source[envName] : source[envName] ?? fromDotenv;
        };

        for (const definition of definitions) {
            if (requireStatic && !definition.static) {
                throw new EnvParseError(
                    `@EnvVar field "${definition.propertyName}" must be static when using loadEnv().`,
                    {
                        envName: definition.envName,
                        propertyName: definition.propertyName,
                    },
                );
            }

            if (definition.private) {
                throw new EnvParseError(
                    `@EnvVar field "${definition.propertyName}" cannot be private.`,
                    {
                        envName: definition.envName,
                        propertyName: definition.propertyName,
                    },
                );
            }

            const rawValue = lookup(definition.envName);
            const parsedValue = parseEnvValue({
                envName: definition.envName,
                propertyName: definition.propertyName,
                rawValue,
                metadata: definition.metadata,
                emptyStringAsMissing,
            });

            Object.defineProperty(target as unknown as Record<string, EnvPrimitiveOrUndefined>, definition.propertyName, {
                configurable: true,
                enumerable: true,
                writable: true,
                value: parsedValue,
            });

            values[definition.propertyName] = parsedValue;
        }

        return Object.freeze({
            target,
            definitions,
            values: Object.freeze({...values}),
            snapshot,
            dotenvFiles: dotenv?.files ?? Object.freeze([]),
        });
    }

    return Object.freeze({
        registry,
        Env,
        EnvConfig,
        EnvVar,
        loadEnv,
        describeEnv,
    });
}

export function getEnvConfigMetadata(
    snapshot: RegistryMetadataSnapshot,
): EnvConfigMetadata | undefined {
    const configRecords = snapshot.classRecords('envConfig');
    const lastRecord = configRecords[configRecords.length - 1];
    return lastRecord?.metadata as EnvConfigMetadata | undefined;
}

function getDefaultEnvSource(): EnvSource {
    const maybeGlobal = globalThis as typeof globalThis & {
        process?: { env?: EnvSource };
    };

    return maybeGlobal.process?.env ?? {};
}
