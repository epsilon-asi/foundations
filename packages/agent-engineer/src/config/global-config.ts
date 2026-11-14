import {createSchemaFile} from "@epsilon-asi/foundation/files";
import {z} from "zod/v4";
import {ContextEntrySchema, KeywordContextSchema} from "./subconfig/context/types.js";


export const GlobalConfigDefaults = {}

/** The OpenAI model agents run on when the config names none. */
export const DEFAULT_MODEL = 'gpt-5.3-codex';

/** Image `--container` runs the agent's commands in when the config names none. */
export const DEFAULT_CONTAINER_IMAGE = 'node:24.15';

/** Longest a task may run in the container, in seconds, when the config gives no limit. */
export const DEFAULT_TASK_TIMEOUT_SECONDS = 600;

/** How `--container` runs the agent's commands. */
export const ContainerConfigSchema = z.object({
    /** Image the container runs; it needs the repository's toolchain. Default: DEFAULT_CONTAINER_IMAGE. */
    image: z.string().min(1).default(DEFAULT_CONTAINER_IMAGE),
    /** Give the container network access, which installing dependencies needs. Default: true. */
    network: z.boolean().default(true),
    /** Keep the package manager's download cache between runs, in ~/.easi/cache. Default: true. */
    cache: z.boolean().default(true),
    /** Longest one task (an install, a test run) may take before it is stopped. Default: DEFAULT_TASK_TIMEOUT_SECONDS. */
    taskTimeoutSeconds: z.number().int().positive().default(DEFAULT_TASK_TIMEOUT_SECONDS),
});

export const GlobalConfigSchema = z.object({
    generationsDir: z.string().default('.ai-gen'),
    model: z.string().default(DEFAULT_MODEL),
    maxToolRounds: z.number().int().min(1).max(100).default(60),
    maxContextFileSizeBytes: z.number().int().positive().default(60_000),
    maxOutputFiles: z.number().int().min(1).max(100).default(10),
    ignore: z.array(z.string()).default([]),
    offLimits: z.array(z.string()).default([]),
    defaultContext: z.array(ContextEntrySchema).default([]),
    defaultKeywordContexts: z.array(KeywordContextSchema).default([]),
    // prefault, not default: zod 4 returns a default as it is, and only a prefault is parsed to fill in the fields.
    container: ContainerConfigSchema.prefault({}),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
export const GlobalConfigUtil = createSchemaFile<typeof GlobalConfigSchema>(
    GlobalConfigSchema,
    GlobalConfigDefaults
)

