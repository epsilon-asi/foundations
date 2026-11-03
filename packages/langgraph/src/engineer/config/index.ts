import {Env, EnvVar, loadEnv} from "@epsilon-asi/foundation";

@Env({prefix: "ENGINEER_", description: "Engineering agent settings."})
export class EngineerConfig {
    @EnvVar.string("REPO_PATH", {default: process.cwd(), description: "Repository the agent's sandbox is created from."})
    static repoPath: string;

    @EnvVar.string("SANDBOX_IMAGE", {required: false, description: "Container image the sandbox runs commands in. Unset runs them on the host."})
    static sandboxImage: string | undefined;
}

loadEnv(EngineerConfig);
