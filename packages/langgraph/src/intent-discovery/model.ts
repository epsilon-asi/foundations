import {ChatOpenAI, ChatOpenAIFields, OpenAIChatModelId} from "@langchain/openai";

export const createModel = (model: OpenAIChatModelId, opts?: Partial<ChatOpenAIFields>) => {
    return new ChatOpenAI({
        model,
        useResponsesApi: true,
        zdrEnabled: true,
        streaming: true,
        maxRetries: 2,
        ...opts,
    });
}