import type {LangGraphRunnableConfig} from "@langchain/langgraph";

type LiveObjects = Record<string, unknown>;

// Keys each initializer added to a context, in creation order, so disposal only releases what was created here.
const createdKeys = new WeakMap<object, string[]>();

const getRuntimeContext = (runtime: LangGraphRunnableConfig | undefined): Record<string, unknown> => {
    if (typeof runtime?.context !== "object" || runtime.context === null) {
        throw new Error("No runtime context to initialize. Invoke the graph with a context object, e.g. graph.invoke(input, { context: {} }).");
    }
    return runtime.context;
};

/** Adds live objects to a context and records them, so `disposeContext` releases them later. */
export const addToContext = (context: object, live: LiveObjects) => {
    Object.assign(context, live);
    createdKeys.set(context, [...(createdKeys.get(context) ?? []), ...Object.keys(live)]);
};

/**
 * A node that creates live objects (database connections, sandboxes, ...) and adds them to the runtime context.
 * LangGraph passes the same context object to every node, so later nodes read them from `runtime.context`.
 * The context is never checkpointed, so the objects don't need to be serializable.
 */
export const createInitializeContextNode = <Live extends LiveObjects, State = unknown>(
    create: (state: State, runtime: LangGraphRunnableConfig) => Promise<Live> | Live,
) => {
    // Contexts this node already initialized, so re-running it (a loop, or resuming with the same context) creates nothing new.
    const initialized = new WeakSet<object>();

    return async (state: State, runtime?: LangGraphRunnableConfig) => {
        const context = getRuntimeContext(runtime);
        if (!initialized.has(context)) {
            initialized.add(context);
            addToContext(context, await create(state, runtime!));
        }
        // Nothing is written to the graph state.
        return {};
    };
};

/** Reads a live object from the runtime context, failing loudly if no initializer has added it. */
export const requireContext = <Context extends LiveObjects, Key extends keyof Context & string>(
    runtime: LangGraphRunnableConfig<Partial<Context>> | undefined,
    key: Key,
): NonNullable<Context[Key]> => {
    const value = getRuntimeContext(runtime)[key];
    if (value === undefined || value === null) {
        throw new Error(`"${key}" is not in the runtime context. Add an initialize-context node that creates it before this node.`);
    }
    return value as NonNullable<Context[Key]>;
};

/**
 * Disposes the live objects initializers added to a context, newest first (like `await using`), and removes them from it.
 * Objects implementing `Symbol.asyncDispose` or `Symbol.dispose` (e.g. Sandbox) are disposed; others are just removed.
 * Call it in a `finally` after invoking the graph, so cleanup also happens when a node throws.
 */
export const disposeContext = async (context: object | undefined) => {
    if (!context) {
        return;
    }
    const keys = createdKeys.get(context) ?? [];
    createdKeys.delete(context);

    const live = context as Record<string, unknown>;
    let firstError: unknown;
    for (const key of [...keys].reverse()) {
        const value = live[key];
        delete live[key];
        try {
            if (typeof value === "object" && value !== null) {
                if (Symbol.asyncDispose in value) {
                    await (value as AsyncDisposable)[Symbol.asyncDispose]();
                } else if (Symbol.dispose in value) {
                    (value as Disposable)[Symbol.dispose]();
                }
            }
        } catch (error) {
            firstError ??= error;
        }
    }
    if (firstError !== undefined) {
        throw firstError;
    }
};

/** A node that disposes the context's live objects, for graphs that should clean up before END. */
export const createDisposeContextNode = () => async (_state: unknown, runtime?: LangGraphRunnableConfig) => {
    await disposeContext(runtime?.context);
    return {};
};
