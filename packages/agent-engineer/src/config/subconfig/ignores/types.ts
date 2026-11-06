import {z} from "zod/v4";

export enum IgnoreConfigProfiles {
    NODE = "NODE",
}

export const IgnoreConfigSchema = z.object({
    profiles: z.array(z.enum(IgnoreConfigProfiles)),
    files: z.array(z.string()), // Specific files, warn if doesn't exist, continue gracefully.
    paths: z.array(z.string()), // Path only - support trailing slash
    patterns: z.array(z.string()), // Regex support
})
export type IgnoreConfig = z.infer<typeof IgnoreConfigSchema>;