import type {
    ClassDecoratorDefinition,
    Constructor,
    DecoratorRegistry,
    PropertyDecoratorDefinition,
    RegistryMetadataSnapshot,
} from '../factory';
import type {DotenvSetting} from './dotenv';

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

    /**
     * Dotenv files this class loads. On by default: loadEnv() reads '.env' from the working
     * directory (skipping it when missing) and its values take precedence over process.env.
     *
     * Pass a path, a list of paths (later files win) or DotenvOptions to change that,
     * or `false` to opt this class out. loadEnv({ dotenv }) is merged over this setting.
     */
    dotenv?: DotenvSetting;
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
     * Dotenv files are still layered over it; add `dotenv: false` to isolate fully.
     */
    source?: EnvSource;

    /**
     * Dotenv files layered over `source`. On by default: reads '.env' from the working
     * directory, skips it when missing, and its values take precedence over `source`.
     *
     * Merged over the class-level @Env({ dotenv }) setting. Pass `false` to turn it off
     * for this call, or `{ override: false }` to let `source` win instead.
     */
    dotenv?: DotenvSetting;

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

    /** Absolute paths of the dotenv files that were read, in load order. */
    readonly dotenvFiles: readonly string[];
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
