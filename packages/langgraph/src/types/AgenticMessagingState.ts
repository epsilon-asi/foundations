import {Annotation} from "@langchain/langgraph";
import z from "zod/v4";

type StandardMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};

export const AgenticMessagingStateZod = z.array(z.object({
    role: z.union([z.literal("system"), z.literal("user"), z.literal("assistant")]),
    content: z.string()
}))

export const AgenticMessagingState = Annotation.Root({
    messages: Annotation<StandardMessage[]>({

        reducer: (left, right) => [...left, ...right.splice(-1)]
    })
});
