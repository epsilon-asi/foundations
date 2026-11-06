import {z} from "zod/v4";

export const ParameterSchema = z.object({
    description: z.string().min(1),
    required: z.boolean().default(true),
    default: z.string().optional(),
});

export const PathContextEntrySchema = z.object({
    kind: z.literal('path'),
    path: z.string().min(1),
    description: z.string().optional(),
    required: z.boolean().default(false),
});

export const PatternContextEntrySchema = z.object({
    kind: z.literal('pattern'),
    pattern: z.string().min(1),
    description: z.string().optional(),
    limit: z.number().int().min(1).max(20).default(5),
});

export const ContextEntrySchema = z.union([
    PathContextEntrySchema,
    PatternContextEntrySchema,
]);

export const KeywordContextSchema = z.object({
    keywords: z.array(z.string().min(1)).min(1),
    description: z.string().optional(),
    context: z.array(ContextEntrySchema).min(1)
});

export type KeywordContext = z.infer<typeof KeywordContextSchema>;

export type Parameter = z.infer<typeof ParameterSchema>;

export type ContextEntry = z.infer<typeof ContextEntrySchema>;

export type PathContextEntry = z.infer<typeof PathContextEntrySchema>;

export type PatternContextEntry = z.infer<typeof PatternContextEntrySchema>;