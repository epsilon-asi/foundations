import {beforeEach, describe, expect, it, vi} from "vitest";

const openai = vi.hoisted(() => ({
    structuredInvoke: vi.fn(),
    withStructuredOutput: vi.fn(),
}));

vi.mock("@langchain/openai", () => ({
    ChatOpenAI: vi.fn(function () {
        return {withStructuredOutput: openai.withStructuredOutput};
    }),
}));

import {ChatOpenAI} from "@langchain/openai";
import {
    createOptionSelectionNode,
    DEFAULT_OPTION_SELECTION_MODEL,
    type StructuredOutputModel,
} from "../../src/common/prebuilt/SelectFromOptions/OptionSelection.js";
import {formatRecord} from "../../src/common/prebuilt/SelectFromOptions/util.js";

describe("createOptionSelectionNode", () => {
    beforeEach(() => {
        openai.withStructuredOutput.mockReturnValue({invoke: openai.structuredInvoke});
    });

    it("asks the model to choose an option and returns its choice", async () => {
        openai.structuredInvoke.mockResolvedValue({parsed: {choice: "billing", reasoning: "a refund"}});
        const node = createOptionSelectionNode("Which team?", {billing: "Charges", technical: "Bugs"});

        const result = await node({messages: [{role: "user", content: "Refund me"}]});

        expect(result).toEqual({messages: [], choice: "billing", reasoning: "a refund"});
        const [messages] = openai.structuredInvoke.mock.calls[0];
        expect(messages[0]).toEqual({role: "user", content: "Refund me"});
        expect(messages[1].content).toContain("billing   : Charges");
        expect(messages[2]).toEqual({role: "user", content: "Which team?"});
    });

    it("uses the default OpenAI model when none is given", async () => {
        openai.structuredInvoke.mockResolvedValue({parsed: {choice: "billing", reasoning: "r"}});
        await createOptionSelectionNode("Which team?", {billing: "Charges"})({messages: []});

        expect(ChatOpenAI).toHaveBeenCalledWith(expect.objectContaining({model: DEFAULT_OPTION_SELECTION_MODEL}));
    });

    it("uses the model it is given", async () => {
        const invoke = vi.fn().mockResolvedValue({parsed: {choice: "technical", reasoning: "a bug"}});
        const model: StructuredOutputModel = {withStructuredOutput: vi.fn().mockReturnValue({invoke})};
        vi.mocked(ChatOpenAI).mockClear();

        const result = await createOptionSelectionNode("Which team?", {billing: "Charges", technical: "Bugs"}, {model})({messages: []});

        expect(result.choice).toBe("technical");
        expect(model.withStructuredOutput).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({strict: true, includeRaw: true}));
        expect(ChatOpenAI).not.toHaveBeenCalled();
    });

    it("picks the model for each run from the runtime, falling back to the default", async () => {
        const invoke = vi.fn().mockResolvedValue({parsed: {choice: "billing", reasoning: "from context"}});
        const contextModel: StructuredOutputModel = {withStructuredOutput: () => ({invoke})};
        openai.structuredInvoke.mockResolvedValue({parsed: {choice: "billing", reasoning: "default"}});
        const resolver = vi.fn((runtime: { readonly context?: unknown } | undefined) =>
            (runtime?.context as { model?: StructuredOutputModel } | undefined)?.model);
        const node = createOptionSelectionNode("Which team?", {billing: "Charges"}, {model: resolver});

        await expect(node({messages: []}, {context: {model: contextModel}})).resolves.toMatchObject({reasoning: "from context"});
        await expect(node({messages: []}, {context: {}})).resolves.toMatchObject({reasoning: "default"});
        expect(resolver).toHaveBeenCalledWith(expect.objectContaining({context: {model: contextModel}}));
    });

    it("passes the runtime's callbacks and signal to the model call", async () => {
        const invoke = vi.fn().mockResolvedValue({parsed: {choice: "billing", reasoning: "r"}});
        const model: StructuredOutputModel = {withStructuredOutput: () => ({invoke})};
        const callbacks = [{handleLLMStart: vi.fn()}];
        const signal = new AbortController().signal;

        await createOptionSelectionNode("Which team?", {billing: "Charges"}, {model})({messages: []}, {callbacks, signal});

        expect(invoke).toHaveBeenCalledWith(expect.any(Array), {callbacks, signal});
    });

    it("rejects a choice that is not one of the options", async () => {
        openai.structuredInvoke.mockResolvedValue({parsed: {choice: "sales", reasoning: "?"}});
        const node = createOptionSelectionNode("Which team?", {billing: "Charges"});
        await expect(node({messages: []})).rejects.toThrow();
    });
});

describe("formatRecord", () => {
    it("aligns keys and flattens multi-line values", () => {
        expect(formatRecord({a: "one", long: "two\n   lines"})).toBe("a    : one\nlong : two lines");
    });

    it("adds a title and a custom delimiter", () => {
        expect(formatRecord({a: "one"}, "Options", "=")).toBe("Options\n\na = one");
    });

    it("handles an empty record", () => {
        expect(formatRecord({})).toBe("");
    });
});
