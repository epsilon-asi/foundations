import {createSchemaFile} from "@epsilon-asi/foundation/files";
import {z} from "zod/v4";
import {ContextEntrySchema, KeywordContextSchema} from "./subconfig/context/types.js";


export const GlobalConfigDefaults = {}

export const GlobalConfigSchema = z.object({
    generationsDir: z.string().default('.ai-gen'),
    model: z.string().default('gpt-5.4-codex'),
    maxToolRounds: z.number().int().min(1).max(100).default(60),
    maxContextFileSizeBytes: z.number().int().positive().default(60_000),
    maxOutputFiles: z.number().int().min(1).max(100).default(10),
    ignore: z.array(z.string()).default([]),
    offLimits: z.array(z.string()).default([]),
    defaultContext: z.array(ContextEntrySchema).default([]),
    defaultKeywordContexts: z.array(KeywordContextSchema).default([]),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
export const GlobalConfigUtil = createSchemaFile<typeof GlobalConfigSchema>(
    GlobalConfigSchema,
    GlobalConfigDefaults
)

