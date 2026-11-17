import {isCommand, type CommandInstance, type LangGraphRunnableConfig} from "@langchain/langgraph";
import {addToContext, disposeContext} from "../nodes/initializeContext.js";

type InvokableGraph = {
    invoke: (input: any, options?: any) => Promise<any>;
};

// The graph's own input; resuming with a Command (or null) has none.
type GraphInput<Graph extends InvokableGraph> = Exclude<Parameters<Graph["invoke"]>[0], CommandInstance<any, any, any> | null>;

/**
 * Wraps a compiled graph so every `invoke` creates live objects (sandboxes, database connections, ...) in the runtime
 * context before the graph runs and disposes them after it finishes, even when a node throws.
 * Nodes read them with `requireContext(runtime, "<key>")`. Everything other than `invoke` is the original graph.
 *
 * @example const graph = ContextualGraph(buildGraph(), async () => ({ sandbox: await Sandbox.create({...}) }));
 */
export function ContextualGraph<Graph extends InvokableGraph, Live extends Record<string, unknown>>(
    graph: Graph,
    create: (input: GraphInput<Graph> | undefined, runtime: LangGraphRunnableConfig) => Promise<Live> | Live,
): Graph {
    const invoke: Graph["invoke"] = async (input, options = {}) => {
        // A context passed by the caller is extended; only the objects created here are disposed.
        const context = options.context ?? {};
        try {
            const config = {...options, context};
            addToContext(context, await create(input === null || isCommand(input) ? undefined : input, config));
            return await graph.invoke(input, config);
        } finally {
            await disposeContext(context);
        }
    };

    return new Proxy(graph, {
        get: (target, property) => {
            if (property === "invoke") {
                return invoke;
            }
            const value = Reflect.get(target, property);
            return typeof value === "function" ? value.bind(target) : value;
        },
    });
}
