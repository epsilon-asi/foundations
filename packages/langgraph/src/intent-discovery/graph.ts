import OpenAI from "openai";
import {
    Annotation,
    END,
    START,
    StateGraph,
} from "@langchain/langgraph";


const GraphState = Annotation.Root({
    messages: Annotation<StandardMessage[]>({

        reducer: (left, right) => [...left, ...right.splice(-1)]
    })
});

export const buildGraph = () => {
    return new StateGraph(GraphState)
        .addNode("supervisor", supervisor.graph)
        .addEdge(START, "supervisor")
        .addEdge("supervisor", END)
        .compile();
}
