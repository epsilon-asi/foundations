import {createSchemaFile, interpolateEnv, interpolateEnvHook} from "./init";
import {loadFile, loadFileSync, safeLoadFile, safeLoadFileSync} from "./load";
import { parseStringSync } from "./parse";
import { parseString } from "./parse";
import {serialize, serializeAsync } from "./serialize";
import {saveFile, saveFileSync} from "./save";
import {SchemaFileError} from "./types";
import {deepMerge} from "./util";
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
} from "./layered";

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
} from "./types";

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
