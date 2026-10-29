import {createClient, RedisClientType,} from "redis";
import {ValidRedisKey} from "./types";
import {loadEnvVars, NumberEnvVar, StringEnvVar} from "../../environment/types";

export class RedisServiceEnvironment {
    @StringEnvVar()
    REDIS_HOST!: string

    @NumberEnvVar()
    REDIS_PORT!: number
}

export class RedisService {
    private client: RedisClientType;
    private readonly config: RedisServiceEnvironment;
    private connected: boolean = false;

    constructor() {
        this.config = new RedisServiceEnvironment();
        loadEnvVars(this.config)
        this.client = createClient({
            url: `redis://${this.config.REDIS_HOST}:${this.config.REDIS_PORT}`,
        });
        this.client = this.client.on('error', this.HandleError);

    }


    async connect() {
        if (!this.client.isReady) this.client = await this.client.connect();
    }

    async getVal<Key extends ValidRedisKey, Type>(key: Key): Promise<Type | null> {
        try {
            await this.connect();
            const val = await this.client.get(key);
            if (val === null) return null;
            return JSON.parse(val) as Type;
        } catch (err) {
            console.error(`Failed to get or parse Redis value for key "${key}":`, err);
            return null;
        }
    }

    async setVal<Key extends ValidRedisKey, Type>(key: Key, value: Type): Promise<boolean> {
        try {
            await this.connect();
            const json = JSON.stringify(value);
            await this.client.set(key, json);
            return true;
        } catch (err) {
            console.error(`Failed to set Redis value for key "${key}":`, err);
            return false;
        }
    }

    HandleError(error: Error) {
        console.error("Encountered error with redis client", error)
    }
}


