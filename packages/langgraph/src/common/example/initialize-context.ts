import { Annotation, END, START, StateGraph, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { Sandbox } from "@epsilon-asi/sandbox";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { requireContext } from "../nodes/initializeContext.js";
import { ContextualGraph } from "../wrappers/ContextualGraph.js";
import {pathToFileURL} from "node:url";

// The live objects every node can reach through the runtime context. They stay out of the graph state.
type EngineeringContext = { sandbox: Sandbox };
type EngineeringRuntime = LangGraphRunnableConfig<Partial<EngineeringContext>>;

const GraphState = Annotation.Root({
    repoPath: Annotation<string>,
    headCommit: Annotation<string>,
    changedFiles: Annotation<string[]>,
});

const readHead = async (_state: typeof GraphState.State, runtime: EngineeringRuntime) => {
    const sandbox = requireContext(runtime, "sandbox");
    const result = await sandbox.exec(["git", "log", "-1", "--format=%h %s"]);
    return { headCommit: result.stdout.trim() };
};

// A later node gets the same sandbox instance, so it sees the work earlier nodes did in it.
const editAndInspect = async (_state: typeof GraphState.State, runtime: EngineeringRuntime) => {
    const sandbox = requireContext(runtime, "sandbox");
    await sandbox.exec(["sh", "-c", "echo 'written by the example graph' > SANDBOX_EXAMPLE.md"]);
    const status = await sandbox.status();
    return { changedFiles: status.map((entry) => entry.path) };
};

export const buildGraph = () => {
    const graph = new StateGraph(GraphState)
        .addNode("readHead", readHead)
        .addNode("editAndInspect", editAndInspect)
        .addEdge(START, "readHead")
        .addEdge("readHead", "editAndInspect")
        .addEdge("editAndInspect", END)
        .compile();

    // Each invoke gets a fresh sandbox (a throwaway git worktree at HEAD), removed when the run ends, even if a node throws.
    // Pass `container: { image: "..." }` to Sandbox.create to run commands in a container instead of on the host.
    return ContextualGraph(graph, async (input) => ({
        sandbox: await Sandbox.create({
            repoPath: input?.repoPath ?? process.cwd(),
            worktreePath: join(mkdtempSync(join(tmpdir(), "sandbox-")), "worktree"),
        }),
    }));
};

// Run directly: npx tsx src/common/example/initialize-context.ts
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    buildGraph()
        .invoke({ repoPath: process.cwd() })
        .then((result) => console.log(result))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
