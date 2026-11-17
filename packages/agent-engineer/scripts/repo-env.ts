import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

/** The repository's `.env`, which git ignores: where OPENAI_API_KEY can live for runs that call real models. */
export const REPO_ENV_FILE = fileURLToPath(new URL('../../../.env', import.meta.url));

/** Loads the repository's `.env` into `process.env`, when there is one. Variables already set in the shell win. */
export function loadRepoEnv(file: string = REPO_ENV_FILE): void {
    if (existsSync(file)) {
        process.loadEnvFile(file);
    }
}
