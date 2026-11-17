import {describe, expect, it} from "vitest";
import {Annotation, END, MemorySaver, START, StateGraph, type LangGraphRunnableConfig} from "@langchain/langgraph";
import {
    addToContext,
    createDisposeContextNode,
    createInitializeContextNode,
    disposeContext,
    requireContext,
} from "../src/common/nodes/initializeContext.js";

class FakeSandbox implements AsyncDisposable {
    disposed = false;
    constructor(readonly repo: string) {}
    async [Symbol.asyncDispose]() {
        this.disposed = true;
    }
}

type EngineeringContext = { sandbox: FakeSandbox };

const State = Annotation.Root({
    repo: Annotation<string>,
    seen: Annotation<string>,
});

const buildGraph = (options: { disposeNode?: boolean; fail?: boolean } = {}) => {
    const sandboxes: FakeSandbox[] = [];
    const initialize = createInitializeContextNode(async (state: typeof State.State) => {
        sandboxes.push(new FakeSandbox(state.repo));
        return {sandbox: sandboxes[sandboxes.length - 1]};
    });
    const work = (_state: typeof State.State, runtime: LangGraphRunnableConfig<Partial<EngineeringContext>>) => {
        if (options.fail) throw new Error("boom");
        return {seen: requireContext(runtime, "sandbox").repo};
    };
    const builder = new StateGraph(State)
        .addNode("initializeContext", initialize)
        .addNode("work", work)
        .addEdge(START, "initializeContext")
        .addEdge("initializeContext", "work");
    const graph = options.disposeNode
        ? builder
            .addNode("disposeContext", createDisposeContextNode())
            .addEdge("work", "disposeContext")
            .addEdge("disposeContext", END)
            .compile({checkpointer: new MemorySaver()})
        : builder.addEdge("work", END).compile({checkpointer: new MemorySaver()});
    return {graph, sandboxes};
};

describe("initializeContext", () => {
    it("passes live objects created by the node to later nodes and the caller", async () => {
        const {graph} = buildGraph();
        const context: Partial<EngineeringContext> = {};
        const result = await graph.invoke({repo: "foundations"}, {context, configurable: {thread_id: "1"}});

        expect(result.seen).toBe("foundations");
        expect(context.sandbox).toBeInstanceOf(FakeSandbox);
        // Live objects never reach the checkpointed state.
        expect(Object.keys(result)).not.toContain("sandbox");

        const sandbox = context.sandbox!;
        await disposeContext(context);
        expect(sandbox.disposed).toBe(true);
        expect(context.sandbox).toBeUndefined();
    });

    it("disposes in a dispose node before END", async () => {
        const {graph, sandboxes} = buildGraph({disposeNode: true});
        const context: Partial<EngineeringContext> = {};
        await graph.invoke({repo: "foundations"}, {context, configurable: {thread_id: "2"}});
        expect(sandboxes[0].disposed).toBe(true);
        expect(context.sandbox).toBeUndefined();
    });

    it("lets the caller clean up when a node throws", async () => {
        const {graph} = buildGraph({fail: true});
        const context: Partial<EngineeringContext> = {};
        let sandbox: FakeSandbox | undefined;
        try {
            await expect(graph.invoke({repo: "r"}, {context, configurable: {thread_id: "3"}})).rejects.toThrow("boom");
            sandbox = context.sandbox;
        } finally {
            await disposeContext(context);
        }
        expect(sandbox!.disposed).toBe(true);
    });

    it("creates once per context and leaves caller-provided values alone", async () => {
        const {graph, sandboxes} = buildGraph();
        const logger = {[Symbol.dispose]: () => { throw new Error("should not be disposed"); }};
        const context: Record<string, unknown> = {logger};
        await graph.invoke({repo: "r"}, {context, configurable: {thread_id: "4"}});
        await graph.invoke({repo: "r"}, {context, configurable: {thread_id: "4"}});
        expect(sandboxes).toHaveLength(1);

        await disposeContext(context);
        expect(context.logger).toBe(logger);
    });

    it("explains what is missing", async () => {
        const {graph} = buildGraph();
        await expect(graph.invoke({repo: "r"}, {configurable: {thread_id: "5"}})).rejects.toThrow(/Invoke the graph with a context object/);
        expect(() => requireContext<EngineeringContext, "sandbox">({context: {}}, "sandbox")).toThrow(/"sandbox" is not in the runtime context/);
    });

    it("disposes sync and async disposables newest first, and removes plain values", async () => {
        const order: string[] = [];
        const context: Record<string, unknown> = {};
        addToContext(context, {
            connection: {[Symbol.dispose]: () => order.push("connection")},
            sandbox: {[Symbol.asyncDispose]: async () => { order.push("sandbox"); }},
            settings: {retries: 2},
            name: "plain",
            empty: null,
        });

        await disposeContext(context);
        expect(order).toEqual(["sandbox", "connection"]);
        expect(context).toEqual({});
    });

    it("disposes everything and rethrows the first error when disposers fail", async () => {
        const disposed: string[] = [];
        const context: Record<string, unknown> = {};
        addToContext(context, {
            first: {[Symbol.dispose]: () => { disposed.push("first"); throw new Error("first failed"); }},
            second: {[Symbol.asyncDispose]: async () => { disposed.push("second"); throw new Error("second failed"); }},
        });

        await expect(disposeContext(context)).rejects.toThrow("second failed");
        expect(disposed).toEqual(["second", "first"]);
        expect(context).toEqual({});
    });

    it("does nothing without a context or with one nothing was added to", async () => {
        await expect(disposeContext(undefined)).resolves.toBeUndefined();
        const context = {kept: {[Symbol.dispose]: () => { throw new Error("should not be disposed"); }}};
        await disposeContext(context);
        expect(context.kept).toBeDefined();
        await expect(createDisposeContextNode()({}, undefined)).resolves.toEqual({});
    });

    it("rejects a null context", async () => {
        const initialize = createInitializeContextNode(() => ({}));
        await expect(initialize({}, {context: null as never})).rejects.toThrow(/No runtime context to initialize/);
        expect(() => requireContext<EngineeringContext, "sandbox">(undefined, "sandbox")).toThrow(/No runtime context/);
    });
});
