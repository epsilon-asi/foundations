import type {
    ClassDecoratorDefinition,
    Constructor,
    DecoratorRegistry,
    PropertyDecoratorDefinition,
    RegistryMetadataSnapshot,
} from '../factory';
import {createDecoratorRegistry} from '../factory';

export type EnvPrimitive = string | number | boolean;
export type EnvPrimitiveOrUndefined = EnvPrimitive | undefined;

export type EnvBooleanTrueValue = 'true' | '1' | 'yes' | 'y' | 'on';
export type EnvBooleanFalseValue = 'false' | '0' | 'no' | 'n' | 'off';
export type EnvValueKind = 'string' | 'number' | 'boolean';

export interface EnvConfigMetadata {
    /**
     * Optional prefix applied to every variable lookup.
     *
     * Example:
     * prefix: 'APP_'
     * @EnvVar.string('PORT')
     * final lookup key: APP_PORT
     */
    prefix?: string;

    /** Optional human-readable description for docs/debug output. */
    description?: string;
}

export type StringEnvVarMetadata = {
    type: 'string';
    name?: string;
    required?: boolean;
    default?: string;
    description?: string;
};

export type NumberEnvVarMetadata = {
    type: 'number';
    name?: string;
    required?: boolean;
    default?: number;
    min?: number;
    max?: number;
    integer?: boolean;
    description?: string;
};

export type BooleanEnvVarMetadata = {
    type: 'boolean';
    name?: string;
    required?: boolean;
    default?: boolean;
    description?: string;
};

export type EnvVarMetadata =
    | StringEnvVarMetadata
    | NumberEnvVarMetadata
    | BooleanEnvVarMetadata;

export type EnvDecoratorSchema = {
    class: {
        envConfig: ClassDecoratorDefinition<EnvConfigMetadata | undefined>;
    };
    property: {
        envVar: PropertyDecoratorDefinition<EnvVarMetadata, EnvPrimitiveOrUndefined>;
    };
    method: {};
    accessor: {};
};

export type EnvSource = Record<string, string | undefined>;

export interface LoadEnvOptions {
    /**
     * Defaults to globalThis.process.env when available.
     * Pass this in tests to avoid mutating or depending on the real process env.
     */
    source?: EnvSource;

    /**
     * Whether @EnvVar fields must be static.
     *
     * Defaults to true because loadEnv mutates the class constructor in place.
     */
    requireStatic?: boolean;

    /**
     * Whether empty strings and whitespace-only strings should be treated as missing.
     *
     * Defaults to true.
     */
    emptyStringAsMissing?: boolean;

    /**
     * Whether inherited metadata should be loaded.
     *
     * Defaults to true.
     */
    includeInherited?: boolean;
}

export interface DescribeEnvOptions {
    /** Defaults to true. */
    includeInherited?: boolean;
}

export interface EnvVariableDefinition {
    readonly propertyName: string;
    readonly envName: string;
    readonly static: boolean;
    readonly private: boolean;
    readonly metadata: EnvVarMetadata;
}

export interface EnvLoadResult<TClass extends Constructor> {
    readonly target: TClass;
    readonly definitions: readonly EnvVariableDefinition[];
    readonly values: Readonly<Record<string, EnvPrimitiveOrUndefined>>;
    readonly snapshot: RegistryMetadataSnapshot;
}

export class EnvParseError extends Error {
    public readonly envName?: string;
    public readonly propertyName?: string;

    public constructor(
        message: string,
        details: { envName?: string; propertyName?: string } = {},
    ) {
        super(message);
        this.name = 'EnvParseError';
        this.envName = details.envName;
        this.propertyName = details.propertyName;
    }
}

export interface EnvConfigDecorator {
    (metadata?: EnvConfigMetadata): <TClass extends Constructor>(
        value: TClass,
        context: ClassDecoratorContext<TClass>,
    ) => void;
}

export interface EnvVarDecoratorApi {
    /**
     * Generic form:
     *
     * @EnvVar({ name: 'PORT', type: 'number' })
     * static port: number;
     */
    (metadata: StringEnvVarMetadata): (
        value: undefined,
        context: ClassFieldDecoratorContext<any, string | undefined>,
    ) => void;

    (metadata: NumberEnvVarMetadata): (
        value: undefined,
        context: ClassFieldDecoratorContext<any, number | undefined>,
    ) => void;

    (metadata: BooleanEnvVarMetadata): (
        value: undefined,
        context: ClassFieldDecoratorContext<any, boolean | undefined>,
    ) => void;

    /**
     * @EnvVar.string('API_KEY')
     * static apiKey: string;
     */
    string(
        name?: string,
        options?: Omit<StringEnvVarMetadata, 'type' | 'name'>,
    ): (
        value: undefined,
        context: ClassFieldDecoratorContext<any, string | undefined>,
    ) => void;

    /**
     * @EnvVar.number('PORT', { default: 3000, integer: true })
     * static port: number;
     */
    number(
        name?: string,
        options?: Omit<NumberEnvVarMetadata, 'type' | 'name'>,
    ): (
        value: undefined,
        context: ClassFieldDecoratorContext<any, number | undefined>,
    ) => void;

    /**
     * @EnvVar.boolean('DEBUG', { default: false })
     * static debug: boolean;
     */
    boolean(
        name?: string,
        options?: Omit<BooleanEnvVarMetadata, 'type' | 'name'>,
    ): (
        value: undefined,
        context: ClassFieldDecoratorContext<any, boolean | undefined>,
    ) => void;
}

export interface EnvSystem {
    readonly registry: DecoratorRegistry<EnvDecoratorSchema>;

    /** Preferred class decorator name. */
    readonly Env: EnvConfigDecorator;

    /** Alias for Env, for users who prefer a more explicit name. */
    readonly EnvConfig: EnvConfigDecorator;

    readonly EnvVar: EnvVarDecoratorApi;

    /**
     * Mutates the provided class in place by assigning parsed values to static fields.
     */
    loadEnv<TClass extends Constructor>(
        target: TClass,
        options?: LoadEnvOptions,
    ): EnvLoadResult<TClass>;

    /** Reads env metadata without mutating the class. */
    describeEnv<TClass extends Constructor>(
        target: TClass,
        options?: DescribeEnvOptions,
    ): readonly EnvVariableDefinition[];
}

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

            const rawValue = source[definition.envName];
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

export function toEnvKey(propertyName: string): string {
    return propertyName
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[-\s]+/g, '_')
        .toUpperCase();
}

export function parseEnvValue(args: {
    envName: string;
    propertyName: string;
    rawValue: string | undefined;
    metadata: EnvVarMetadata;
    emptyStringAsMissing: boolean;
}): EnvPrimitiveOrUndefined {
    const {envName, propertyName, rawValue, metadata, emptyStringAsMissing} = args;

    const missing =
        rawValue === undefined || (emptyStringAsMissing && rawValue.trim() === '');

    if (missing) {
        if ('default' in metadata) return metadata.default;
        if (metadata.required === false) return undefined;

        throw new EnvParseError(`Missing required environment variable "${envName}".`, {
            envName,
            propertyName,
        });
    }

    switch (metadata.type) {
        case 'string':
            return rawValue;

        case 'number':
            return parseNumberValue({
                envName,
                propertyName,
                rawValue,
                metadata,
            });

        case 'boolean':
            return parseBooleanValue({
                envName,
                propertyName,
                rawValue,
            });

        default:
            return assertNever(metadata);
    }
}

function parseNumberValue(args: {
    envName: string;
    propertyName: string;
    rawValue: string;
    metadata: NumberEnvVarMetadata;
}): number {
    const {envName, propertyName, rawValue, metadata} = args;
    const value = Number(rawValue);

    if (!Number.isFinite(value)) {
        throw new EnvParseError(
            `Environment variable "${envName}" must be a finite number. Received "${rawValue}".`,
            {envName, propertyName},
        );
    }

    if (metadata.integer === true && !Number.isInteger(value)) {
        throw new EnvParseError(
            `Environment variable "${envName}" must be an integer. Received "${rawValue}".`,
            {envName, propertyName},
        );
    }

    if (metadata.min !== undefined && value < metadata.min) {
        throw new EnvParseError(
            `Environment variable "${envName}" must be >= ${metadata.min}. Received "${rawValue}".`,
            {envName, propertyName},
        );
    }

    if (metadata.max !== undefined && value > metadata.max) {
        throw new EnvParseError(
            `Environment variable "${envName}" must be <= ${metadata.max}. Received "${rawValue}".`,
            {envName, propertyName},
        );
    }

    return value;
}

function parseBooleanValue(args: {
    envName: string;
    propertyName: string;
    rawValue: string;
}): boolean {
    const {envName, propertyName, rawValue} = args;
    const normalized = rawValue.trim().toLowerCase();

    if (isTruthyEnvValue(normalized)) return true;
    if (isFalsyEnvValue(normalized)) return false;

    throw new EnvParseError(
        `Environment variable "${envName}" must be a boolean. Received "${rawValue}".`,
        {envName, propertyName},
    );
}

function isTruthyEnvValue(value: string): value is EnvBooleanTrueValue {
    return value === 'true'
        || value === '1'
        || value === 'yes'
        || value === 'y'
        || value === 'on';
}

function isFalsyEnvValue(value: string): value is EnvBooleanFalseValue {
    return value === 'false'
        || value === '0'
        || value === 'no'
        || value === 'n'
        || value === 'off';
}

function getDefaultEnvSource(): EnvSource {
    const maybeGlobal = globalThis as typeof globalThis & {
        process?: { env?: EnvSource };
    };

    return maybeGlobal.process?.env ?? {};
}

function assertNever(value: never): never {
    throw new EnvParseError(`Unsupported env metadata: ${JSON.stringify(value)}`);
}

const defaultEnvSystem = createEnvSystem();

export const envRegistry = defaultEnvSystem.registry;
export const Env = defaultEnvSystem.Env;
export const EnvConfig = defaultEnvSystem.EnvConfig;
export const EnvVar = defaultEnvSystem.EnvVar;
export const loadEnv = defaultEnvSystem.loadEnv;
export const describeEnv = defaultEnvSystem.describeEnv;
