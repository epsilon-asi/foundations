import {type IgnoreConfig, IgnoreConfigProfiles} from "./types.js";


export const IgnoreConfigProfileMap: Record<IgnoreConfigProfiles, Omit<IgnoreConfig, "profiles">> = {
    NODE: {
        files: [],
        patterns: [],
        paths: []
    },
}

