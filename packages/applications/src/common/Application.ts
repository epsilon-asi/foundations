import {Constructor, loadEnv} from "@epsilon-asi/foundation";

export enum ApplicationType {
    API = "API",
    CONSUMER = "CONSUMER",
    PRODUCER = "PRODUCER",
    DAEMON = "DAEMON",
}

export type EnvRecord = Record<string, string | number | undefined>

export type ApplicationOptions<
    Type extends ApplicationType,
    EnvVars extends EnvRecord,
> = {
    metrics?: boolean;
    dev?: boolean;
    type: ApplicationType & Type
    env: EnvVars & Constructor
}

export abstract class ApplicationBase<
    Type extends string & ApplicationType,
    EnvironmentVars extends EnvRecord, > {
    environment: EnvironmentVars
    type: Type

    abstract Start(): void

    abstract Stop(): void

    constructor(opts: ApplicationOptions<Type, EnvironmentVars>) {
        this.type = opts.type;
        this.environment = loadEnv(opts.env, {}).values as EnvironmentVars;
    }
}