import {z} from "zod/v4";
import {AgenticMessagingState} from "../../types/AgenticMessagingState";
import {ProtectedStructuredNode} from "./ProtectedNode";


export type AgenticMessageBasedState<StateType> = typeof AgenticMessagingState.State & StateType
export type AgenticMessageBasedOutput<OutputType> = typeof AgenticMessagingState.State & OutputType

export function AgenticIntermediaryNode<Input, Output>(
    schemas: {
        input: z.ZodType<AgenticMessageBasedState<Input>>,
        output: z.ZodType<AgenticMessageBasedState<Output>>
    },
    node: (state: AgenticMessageBasedState<Input>) => Promise<Output> | Output,
) {
    return ProtectedStructuredNode(schemas, async(state: AgenticMessageBasedState<Input>) => {
        return node(state);
    })
}


