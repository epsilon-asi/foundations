import OpenAI from "openai";
import {
    Annotation,
    END,
    START,
    StateGraph,
} from "@langchain/langgraph";
import {supervisor} from "./agents/supervisor";

type StandardMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};

const client = new OpenAI();

const GraphState = Annotation.Root({
    messages: Annotation<StandardMessage[]>({

        reducer: (left, right) => [...left, ...right.splice(-1)]
    })
});

async function callOpenAI(state: typeof GraphState.State) {
    const response = await client.responses.create({
        model: "gpt-5.5",
        input: state.messages.map((m) => ({
            role: m.role,
            content: m.content,
        })),
    });

    return {
        messages: [
            {
                role: "assistant",
                content: response.output_text,
            },
        ],
    };
}

export const buildGraph = () => {
    return new StateGraph(GraphState)
        .addNode("supervisor", supervisor.graph)
        .addEdge(START, "supervisor")
        .addEdge("supervisor", END)
        .compile();
}
