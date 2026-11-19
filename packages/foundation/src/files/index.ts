import {createSchemaFile, interpolateEnv, interpolateEnvHook} from "./init.js";
import {loadFile, loadFileSync, safeLoadFile, safeLoadFileSync} from "./load.js";
import { parseStringSync } from "./parse.js";
import { parseString } from "./parse.js";
import {serialize, serializeAsync } from "./serialize.js";
import {saveFile, saveFileSync} from "./save.js";
import {SchemaFileError} from "./types.js";
import {deepMerge} from "./util.js";
import {
    createLayeredFile,
    discoverLayers,
    discoverLayersSync,
    loadLayeredFile,
    loadLayeredFileSync,
    loadMergedFiles,
    loadMergedFilesSync,
    safeLoadLayeredFile,
    safeLoadLayeredFileSync,
} from "./layered.js";

export type {
    DiscoverOptions,
    ErrorFormatter,
    FileLayer,
    LayeredLoadOptions,
    LayeredResult,
    LayerOrigin,
    FileFormat,
    LoadOptions,
    ParseOptions,
    ParseParams,
    PreprocessContext,
    SafeResult,
    SaveOptions,
    SchemaFileErrorKind,
    SerializeOptions,
    SerializeStrategy,
} from "./types.js";

export {
    createSchemaFile,
    interpolateEnv,
    interpolateEnvHook,
    loadFile,
    loadFileSync,
    safeLoadFile,
    safeLoadFileSync,
    serialize,
    serializeAsync,
    parseString,
    parseStringSync,
    saveFileSync,
    saveFile,
    SchemaFileError,
    deepMerge,
    createLayeredFile,
    discoverLayers,
    discoverLayersSync,
    loadLayeredFile,
    loadLayeredFileSync,
    loadMergedFiles,
    loadMergedFilesSync,
    safeLoadLayeredFile,
    safeLoadLayeredFileSync,
}
