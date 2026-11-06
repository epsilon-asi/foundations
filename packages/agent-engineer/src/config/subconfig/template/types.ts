import {z} from "zod/v4";
import {OutputSchema} from "../output/types.js";
import {ContextEntrySchema, KeywordContextSchema, ParameterSchema} from "../context/types.js";
import {ToolingSchema} from "../tooling/types.js";


export const TemplateConfigSchema = z.object({
    id: z.string().optional(),
    description: z.string(),
    instructions: z.string(),
    output: OutputSchema,
    parameters: z.record(z.string(), ParameterSchema).default({}),
    examples: z.array(z.string()),
    context: z.array(ContextEntrySchema).default([]),
    keywordContexts: z.array(KeywordContextSchema).default([]),
    tooling: ToolingSchema.default({
        allowGetExistingCode: true,
        allowFindFiles: true,
        allowSearchRepo: true,
    }),
});

export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;