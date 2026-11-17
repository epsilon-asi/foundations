import type {LangGraphRunnableConfig} from "@langchain/langgraph";
import {z} from "zod/v4";

/**
 * Wraps a node so its input is parsed before it runs and its output after. The node's runtime (the second
 * argument LangGraph passes every node) is handed on, so the node can read its context, callbacks and signal.
 */
export function ProtectedStructuredNode<Input, Output>(
    schemas: {
        input: z.ZodType<Input>,
        output: z.ZodType<Output>
    },
    node: (state: Input, runtime?: LangGraphRunnableConfig) => Promise<Output> | Output,
) {
    return async (rawState: Input, runtime?: LangGraphRunnableConfig) => {
        const data: Input = schemas.input.parse(rawState);
        const result = await node(data, runtime);
        return schemas.output.parse(result);
    }
}
