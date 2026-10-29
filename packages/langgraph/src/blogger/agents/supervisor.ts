import {tools as openAITools} from "@langchain/openai";
import {createAgent, ReactAgent} from "langchain"
import {addNumbersTool} from "../tools/addNumbers";
import {model} from "../model";
import type {BaseMessage} from "@langchain/core/messages";

const today = new Date().toISOString().slice(0, 10);

export const supervisor = createAgent({
    model,
    // responseFormat: z.object({
    //         response: z.string()
    //     }),
    tools: [addNumbersTool, openAITools.webSearch()],

    // checkpointer,
    systemPrompt: [
        "You are a concise, helpful assistant replying inside a Slack thread.",
        `The current UTC date is ${today}.`,
        "When web search is used, cite the sources supporting factual claims.",
        "Use readable Slack-compatible Markdown and keep answers focused unless the user asks for detail.",
        "Do not expose hidden chain-of-thought or private reasoning. Give conclusions and useful explanations only.",
    ].join("\n"),
});

type MessagesState = {
    messages: BaseMessage[];
};

export const AgentToNode = (
    agent: ReactAgent
) => {
    return async (
        state: MessagesState,
        config?: Parameters<typeof agent.invoke>[1],
    ) => {
        const result = await agent.invoke(
            {
                messages: state.messages,
            },
            {...config,
            runId: undefined,}
        );

        return {
            messages: result.messages.slice(state.messages.length),
        };
    };
}

const data = [{
    "content": "hello",
    "role": "user"
}]