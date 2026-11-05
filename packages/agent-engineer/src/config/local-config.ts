import {createSchemaFile} from "@epsilon-asi/foundation/files";
import {z} from "zod/v4";

export const LocalConfigDefaults = {}
export const LocalConfigSchema = z.object({});
export type LocalConfig = z.infer<typeof LocalConfigSchema>;
export const LocalConfig = createSchemaFile<typeof LocalConfigSchema>(
    LocalConfigSchema,
    LocalConfigDefaults
)


