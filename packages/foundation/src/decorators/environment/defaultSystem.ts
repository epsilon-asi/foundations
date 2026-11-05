import {createEnvSystem} from './system';

/** The shared env system behind the top-level Env, EnvVar and loadEnv exports. */
const defaultEnvSystem = createEnvSystem();

export const envRegistry = defaultEnvSystem.registry;
export const Env = defaultEnvSystem.Env;
export const EnvConfig = defaultEnvSystem.EnvConfig;
export const EnvVar = defaultEnvSystem.EnvVar;
export const loadEnv = defaultEnvSystem.loadEnv;
export const describeEnv = defaultEnvSystem.describeEnv;
