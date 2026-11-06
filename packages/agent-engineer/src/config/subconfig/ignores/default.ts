import {type IgnoreConfig, IgnoreConfigProfiles} from "./types.js";

export const DefaultIgnoreConfig: IgnoreConfig = {
    profiles: [
        IgnoreConfigProfiles.NODE,
    ],
    files: [
        ".git",
        "node_modules",
        "dist",
        "build",
    ],
    paths: [],
    patterns: []
}