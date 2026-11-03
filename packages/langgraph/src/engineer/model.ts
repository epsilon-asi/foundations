import { ChatOpenAI, tools as openAITools } from "@langchain/openai";
import { createAgent } from "langchain";

export const model = new ChatOpenAI({
    model: "gpt-5.6-sol",
    useResponsesApi: true,
    zdrEnabled: true,
    streaming: true,
    maxRetries: 2,
});