import {z} from "zod/v4";

export const ToolingSchema = z.object({
    allowGetExistingCode: z.boolean().default(true),
    allowFindFiles: z.boolean().default(true),
    allowSearchRepo: z.boolean().default(true),
});
