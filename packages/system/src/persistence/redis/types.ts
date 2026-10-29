export enum RedisNamespaces {
    LOCKS = "locks",
    DEFAULT = "default",
    CACHE = "cache",
}

export type ValidRedisKey<AppName extends string = "cachestore", Namespace extends RedisNamespaces & string = RedisNamespaces, Group extends string = string, Key extends string = string> =
    `${AppName}.${Namespace}.${Group}.${Key}`
    & string;