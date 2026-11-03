import {describe, expect, it} from "vitest";
import {Annotation, Command, END, MemorySaver, START, StateGraph, interrupt, type LangGraphRunnableConfig} from "@langchain/langgraph";
import {requireContext} from "../src/common/nodes/initializeContext";
import {ContextualGraph} from "../src/common/wrappers/ContextualGraph";

class FakeSandbox implements AsyncDisposable {
    disposed = false;
    constructor(readonly repo: string) {}
    async [Symbol.asyncDispose]() {
        this.disposed = true;
    }
}

const State = Annotation.Root({
    repo: Annotation<string>,
    seen: Annotation<string>,
});

const buildGraph = (options: { fail?: boolean } = {}) => {
    const sandboxes: FakeSandbox[] = [];
    const graph = new StateGraph(State)
        .addNode("work", (_state, runtime: LangGraphRunnableConfig<{ sandbox?: FakeSandbox }>) => {
            if (options.fail) throw new Error("boom");
            return {seen: requireContext(runtime, "sandbox").repo};
        })
        .addEdge(START, "work")
        .addEdge("work", END)
        .compile();
    const wrapped = ContextualGraph(graph, (input) => {
        sandboxes.push(new FakeSandbox(input?.repo ?? ""));
        return {sandbox: sandboxes[sandboxes.length - 1]};
    });
    return {graph: wrapped, sandboxes};
};

describe("ContextualGraph", () => {
    it("creates the context from the input and disposes it after the run", async () => {
        const {graph, sandboxes} = buildGraph();
        const result = await graph.invoke({repo: "foundations"});
        expect(result.seen).toBe("foundations");
        expect(sandboxes).toHaveLength(1);
        expect(sandboxes[0].disposed).toBe(true);
    });

    it("gives every run its own context, even when the caller reuses a context object", async () => {
        const {graph, sandboxes} = buildGraph();
        const context = {requestId: "abc"};
        await graph.invoke({repo: "a"}, {context});
        const result = await graph.invoke({repo: "b"}, {context});
        expect(result.seen).toBe("b");
        expect(sandboxes.map((sandbox) => sandbox.disposed)).toEqual([true, true]);
        expect(context).toEqual({requestId: "abc"});
    });

    it("disposes the context when a node throws", async () => {
        const {graph, sandboxes} = buildGraph({fail: true});
        await expect(graph.invoke({repo: "r"})).rejects.toThrow("boom");
        expect(sandboxes[0].disposed).toBe(true);
    });

    it("leaves the rest of the graph untouched", () => {
        const {graph} = buildGraph();
        expect(Object.keys(graph.getGraph().nodes)).toContain("work");
    });

    it("passes non-method properties through", () => {
        const {graph} = buildGraph();
        expect(graph.nodes).toHaveProperty("work");
    });

    it("creates the context without input when resuming with a Command", async () => {
        const inputs: unknown[] = [];
        const sandboxes: FakeSandbox[] = [];
        const compiled = new StateGraph(State)
            .addNode("approve", (_state, runtime: LangGraphRunnableConfig<{ sandbox?: FakeSandbox }>) => {
                const approved = interrupt("approve?") as string;
                return {seen: `${approved}:${requireContext(runtime, "sandbox").repo}`};
            })
            .addEdge(START, "approve")
            .addEdge("approve", END)
            .compile({checkpointer: new MemorySaver()});
        const graph = ContextualGraph(compiled, (input) => {
            inputs.push(input);
            sandboxes.push(new FakeSandbox(input?.repo ?? "resumed"));
            return {sandbox: sandboxes[sandboxes.length - 1]};
        });
        const config = {configurable: {thread_id: "resume"}};

        await graph.invoke({repo: "first"}, config);
        const result = await graph.invoke(new Command({resume: "yes"}), config);

        expect(inputs).toEqual([{repo: "first"}, undefined]);
        expect(result.seen).toBe("yes:resumed");
        expect(sandboxes.every((sandbox) => sandbox.disposed)).toBe(true);
    });

    it("passes undefined for a null input", async () => {
        const seen: unknown[] = [];
        const compiled = new StateGraph(State)
            .addNode("work", () => ({seen: "ok"}))
            .addEdge(START, "work")
            .addEdge("work", END)
            .compile({checkpointer: new MemorySaver()});
        const graph = ContextualGraph(compiled, (input) => {
            seen.push(input);
            return {};
        });
        const config = {configurable: {thread_id: "null-input"}};
        await graph.invoke({repo: "r"}, config);
        await graph.invoke(null, config);
        expect(seen).toEqual([{repo: "r"}, undefined]);
    });
});
