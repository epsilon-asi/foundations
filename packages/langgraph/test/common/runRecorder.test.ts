import {FakeListChatModel} from "@langchain/core/utils/testing";
import {tool} from "@langchain/core/tools";
import {Annotation, END, START, StateGraph, type LangGraphRunnableConfig} from "@langchain/langgraph";
import {describe, expect, it} from "vitest";
import {z} from "zod/v4";
import {RunRecorder} from "../../src/common/callbacks/RunRecorder.js";

const lookup = tool(async ({word}) => (word === "boom" ? "Error: no such word" : `${word}: a word`), {
    name: "lookup",
    description: "Look a word up.",
    schema: z.object({word: z.string()}),
});

describe("RunRecorder", () => {
    it("records the model and tool calls of a graph run, nested ones included", async () => {
        const model = new FakeListChatModel({responses: ["fine"]});
        const graph = new StateGraph(Annotation.Root({answer: Annotation<string>}))
            .addNode("work", async (_state: unknown, runtime?: LangGraphRunnableConfig) => {
                const options = runtime?.callbacks ? {callbacks: runtime.callbacks} : {};
                await lookup.invoke({word: "hello"}, options);
                await lookup.invoke({word: "boom"}, options);
                return {answer: (await model.invoke("hi", options)).text};
            })
            .addEdge(START, "work")
            .addEdge("work", END)
            .compile();
        const recorder = new RunRecorder();

        await graph.invoke({}, {callbacks: [recorder]});

        expect(recorder.toolCalls.map(({name, input, output}) => ({name, input, output}))).toEqual([
            {name: "lookup", input: {word: "hello"}, output: "hello: a word"},
            {name: "lookup", input: {word: "boom"}, output: "Error: no such word"},
        ]);
        expect(recorder.modelCalls).toHaveLength(1);
        expect(recorder.summary()).toEqual({
            toolCalls: 2,
            toolErrors: 1,
            modelCalls: 1,
            inputTokens: 0,
            outputTokens: 0,
            toolsUsed: {lookup: 2},
        });
    });

    it("records errors and durations, and ignores events for runs it did not see start", () => {
        let now = 0;
        const recorder = new RunRecorder({now: () => now});
        recorder.handleToolStart({lc: 1, type: "not_implemented", id: ["tools", "grep"]}, "not json", "tool-1");
        recorder.handleChatModelStart({lc: 1, type: "constructor", id: ["ChatOpenAI"], kwargs: {model: "gpt-x"}}, [], "model-1");
        now = 25;
        recorder.handleToolError(new Error("boom"), "tool-1");
        recorder.handleLLMError(new Error("rate limited"), "model-1");
        recorder.handleToolEnd("late", "unknown-run");
        recorder.handleLLMEnd({generations: []}, "unknown-run");

        expect(recorder.toolCalls).toEqual([{name: "grep", input: "not json", output: undefined, error: "boom", durationMs: 25}]);
        expect(recorder.modelCalls).toEqual([{model: "gpt-x", inputTokens: undefined, outputTokens: undefined, error: "rate limited", durationMs: 25}]);
        expect(recorder.summary()).toMatchObject({toolErrors: 1, inputTokens: 0, outputTokens: 0});
    });

    it("reads the model name and token usage the model reports", () => {
        const recorder = new RunRecorder();
        recorder.handleChatModelStart({lc: 1, type: "constructor", id: ["X"], kwargs: {model: "from-kwargs"}}, [], "m", undefined, {invocation_params: {model: "from-call"}});
        recorder.handleChatModelStart({lc: 1, type: "not_implemented", id: ["X"]}, [], "n");
        recorder.handleLLMEnd({generations: [[{text: "hi", message: {usage_metadata: {input_tokens: 7, output_tokens: 3}}} as never]]}, "m");
        recorder.handleLLMEnd({generations: [[{text: "hi"}]]}, "n");
        recorder.handleToolStart({lc: 1, type: "not_implemented", id: []}, "{}", "t");
        recorder.handleToolEnd({content: [{type: "text", text: "x"}]}, "t");

        expect(recorder.modelCalls.map(({model, inputTokens, outputTokens}) => ({model, inputTokens, outputTokens}))).toEqual([
            {model: "from-call", inputTokens: 7, outputTokens: 3},
            {model: undefined, inputTokens: undefined, outputTokens: undefined},
        ]);
        expect(recorder.summary()).toMatchObject({inputTokens: 7, outputTokens: 3});
        expect(recorder.toolCalls[0]).toMatchObject({name: "unknown", output: "[{\"type\":\"text\",\"text\":\"x\"}]"});
    });
});
