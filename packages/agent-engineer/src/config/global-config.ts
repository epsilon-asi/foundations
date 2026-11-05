import {createSchemaFile} from "@epsilon-asi/foundation/files";
import {z} from "zod/v4";



export const GlobalConfigDefaults = {}
export const GlobalConfigSchema = z.object({


});
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
export const GlobalConfig = createSchemaFile<typeof GlobalConfigSchema>(
    GlobalConfigSchema,
    GlobalConfigDefaults
)
