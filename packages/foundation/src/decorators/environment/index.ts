export type {
    BooleanEnvVarMetadata,
    DescribeEnvOptions,
    EnvBooleanFalseValue,
    EnvBooleanTrueValue,
    EnvConfigDecorator,
    EnvConfigMetadata,
    EnvDecoratorSchema,
    EnvLoadResult,
    EnvPrimitive,
    EnvPrimitiveOrUndefined,
    EnvSource,
    EnvSystem,
    EnvValueKind,
    EnvVarDecoratorApi,
    EnvVariableDefinition,
    EnvVarMetadata,
    LoadEnvOptions,
    NumberEnvVarMetadata,
    StringEnvVarMetadata,
} from './types.js';
export type {DotenvOptions, DotenvReadResult, DotenvSetting} from './dotenv.js';

export {createEnvSystem, getEnvConfigMetadata} from './system.js';
export {describeEnv, Env, EnvConfig, envRegistry, EnvVar, loadEnv} from './defaultSystem.js';
export {parseEnvValue, toEnvKey} from './parse.js';
export {DEFAULT_DOTENV_PATH, readDotenvFiles} from './dotenv.js';
export {EnvParseError} from './errors.js';
