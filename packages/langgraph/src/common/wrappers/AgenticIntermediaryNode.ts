import type {LangGraphRunnableConfig} from "@langchain/langgraph";
import {z} from "zod/v4";
import {AgenticMessagingState} from "../../types/AgenticMessagingState.js";
import {ProtectedStructuredNode} from "./ProtectedNode.js";


export type AgenticMessageBasedState<StateType> = typeof AgenticMessagingState.State & StateType
export type AgenticMessageBasedOutput<OutputType> = typeof AgenticMessagingState.State & OutputType

export function AgenticIntermediaryNode<Input, Output>(
    schemas: {
        input: z.ZodType<AgenticMessageBasedState<Input>>,
        output: z.ZodType<AgenticMessageBasedState<Output>>
    },
    node: (state: AgenticMessageBasedState<Input>, runtime?: LangGraphRunnableConfig) => Promise<Output> | Output,
) {
    return ProtectedStructuredNode(schemas, async (state: AgenticMessageBasedState<Input>, runtime?: LangGraphRunnableConfig) => {
        return node(state, runtime);
    })
}


