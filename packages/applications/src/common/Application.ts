import {Constructor, loadEnv} from "@epsilon-asi/foundation";

export enum ApplicationType {
    API = "API",
    CONSUMER = "CONSUMER",
    PRODUCER = "PRODUCER",
    DAEMON = "DAEMON",
}
export type EnvRecord = Record<string, string | number | undefined>
type BaseStartOptions = {
    metrics?: boolean;
    dev?: boolean;
    type: ApplicationType
}
export type ApplicationOptions<
    Type extends ApplicationType,
    EnvVars extends EnvRecord,
> = (BaseStartOptions & {
    env: EnvVars & Constructor
}) & ({
    type: ApplicationType.API & Type,

} | {
    type: ApplicationType.CONSUMER & Type,

} | {
    type: ApplicationType.PRODUCER & Type,

} | {
    type: ApplicationType.DAEMON & Type,

})

export abstract class ApplicationBase<
    Type extends string & ApplicationType,
    EnvironmentVars extends EnvRecord, > {
    environment: EnvironmentVars
    type: Type

    abstract SetEnvironment(): void;

    abstract Start(): void

    abstract StartMetrics(): void

    abstract Stop(): void

    constructor(opts: ApplicationOptions<Type, EnvironmentVars>) {
        this.type = opts.type;
        this.environment = loadEnv(opts.env, {}).values as EnvironmentVars;
    }
}