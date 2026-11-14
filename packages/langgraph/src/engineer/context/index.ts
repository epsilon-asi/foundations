import {Sandbox} from "@epsilon-asi/sandbox";
import {randomUUID} from "node:crypto";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {EngineerConfig} from "../config/index.js";

export type EngineeringContext = {
    sandbox: Sandbox
};

// Not `await using`: the sandbox has to outlive this function. ContextualGraph disposes it when the run ends.
const createEngineeringContext = async (): Promise<EngineeringContext> => {
    const sandbox = await Sandbox.create({
        repoPath: EngineerConfig.repoPath,
        worktreePath: join(mkdtempSync(join(tmpdir(), "engineer-")), "worktree"),
        // Disposal keeps the branch and its commits, so each run needs a branch of its own.
        branchName: `agent/${randomUUID()}`,
        ...(EngineerConfig.sandboxImage ? {container: {image: EngineerConfig.sandboxImage}} : {}),
    });

    await sandbox.installDependencies();
    // TODO - come back and think about security, for example, here we should figure out how to rip away the network access from the agent.
    //        And that way we can programmatically control whether it can call out from in the container.
    return {
        sandbox
    }
}
export default {
    engineering: createEngineeringContext
}
