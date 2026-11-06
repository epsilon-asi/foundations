import {type GlobalConfig, GlobalConfigDefaults, GlobalConfigSchema} from "./global-config.js";
import {type TemplateConfig, TemplateConfigSchema} from "./subconfig/template/types.js";
import {
    type GeneratedUpdate,
    GeneratedUpdateSchema,
    type Output,
    OutputSchema,
    type OutputTarget,
    OutputTargetSchema
} from "./subconfig/output/types.js";
import type {
    ContextEntry,
    KeywordContext,
    Parameter,
    PathContextEntry,
    PatternContextEntry
} from "./subconfig/context/types.js";
import {
    PathContextEntrySchema,
    ContextEntrySchema,
    KeywordContextSchema,
    ParameterSchema,
    PatternContextEntrySchema
} from "./subconfig/context/types.js";


export {
    type KeywordContext,
    type Parameter,
    type ContextEntry,
    type PathContextEntry,
    type PatternContextEntry,
    type GeneratedUpdate,
    type GlobalConfig,
    type OutputTarget,
    type Output,
    type TemplateConfig,

    ParameterSchema,
    PathContextEntrySchema,
    PatternContextEntrySchema,
    ContextEntrySchema,
    KeywordContextSchema,
    GeneratedUpdateSchema,
    OutputTargetSchema,
    OutputSchema,
    TemplateConfigSchema,
    GlobalConfigDefaults,
    GlobalConfigSchema,

}