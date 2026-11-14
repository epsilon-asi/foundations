import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod/v4";
import { AgenticMessagingState, AgenticMessagingStateZod } from "../../types/AgenticMessagingState.js";
import { createOptionSelectionNode } from "../prebuilt/SelectFromOptions/OptionSelection.js";
import { AgenticIntermediaryNode } from "../wrappers/AgenticIntermediaryNode.js";
import {pathToFileURL} from "node:url";

const model = new ChatOpenAI({
    model: "gpt-5.5",
    useResponsesApi: true,
    zdrEnabled: true,
    maxRetries: 2,
});

// Each key is an option the model can choose and also the name of the node the graph routes to.
const ResponseOptions = {
    answer: "The user asked a cooking question that can be answered as it stands.",
    clarify: "The user wants cooking help but left out details needed to give a useful answer.",
    decline: "The user's message has nothing to do with cooking.",
};

const routingPrompt = "How should the cooking assistant respond to the user's latest message?";

const GraphState = Annotation.Root({
    ...AgenticMessagingState.spec,
    choice: Annotation<keyof typeof ResponseOptions>,
    reasoning: Annotation<string>,
});

const ConversationSchema = z.object({ messages: AgenticMessagingStateZod });
type Conversation = z.infer<typeof ConversationSchema>;

// An agentic node that adds one assistant reply to the conversation, following the given instructions.
const createReplyNode = (instructions: string) => AgenticIntermediaryNode<Conversation, Conversation>({
    input: ConversationSchema,
    output: ConversationSchema,
}, async (state) => {
    const response = await model.invoke([{ role: "system", content: instructions }, ...state.messages]);
    return { messages: [{ role: "assistant", content: response.text }] };
});

const answer = createReplyNode("You are a friendly cooking assistant. Answer the user's question in two or three sentences.");
const clarify = createReplyNode("You are a friendly cooking assistant. Ask one short question to get the details you need.");

const decline = AgenticIntermediaryNode<Conversation, Conversation>({
    input: ConversationSchema,
    output: ConversationSchema,
}, () => ({
    messages: [{ role: "assistant", content: "Sorry, I can only help with cooking questions." }],
}));

export const buildGraph = () => {
    return new StateGraph(GraphState)
        .addNode("chooseResponse", createOptionSelectionNode(routingPrompt, ResponseOptions))
        .addNode("answer", answer)
        .addNode("clarify", clarify)
        .addNode("decline", decline)
        .addEdge(START, "chooseResponse")
        .addConditionalEdges("chooseResponse", (state) => state.choice, ["answer", "clarify", "decline"])
        .addEdge("answer", END)
        .addEdge("clarify", END)
        .addEdge("decline", END)
        .compile();
};

// Run directly: npx tsx --env-file=.env src/common/example/agentic-graph.ts
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    const graph = buildGraph();
    const requests = [
        "How long should I boil an egg if I want a runny yolk?",
        "How long should I cook it for?",
        "Can you help me change a flat tire?",
    ];

    Promise.all(requests.map((request) => graph.invoke({ messages: [{ role: "user", content: request }] })))
        .then((results) => results.forEach(({ choice, reasoning, messages }) => {
            console.log({ choice, reasoning, messages });
        }))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
