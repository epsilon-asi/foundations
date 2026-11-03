import {Annotation} from "@langchain/langgraph";

type StandardMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};
export const GraphState = Annotation.Root({
    messages: Annotation<StandardMessage[]>({
        reducer: (left, right) => [...left, ...right.splice(-1)]
    })
});