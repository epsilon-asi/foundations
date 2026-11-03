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

import {createOptionSelectionNode} from "../../src/common/prebuilt/SelectFromOptions/OptionSelection";
import {formatRecord} from "../../src/common/prebuilt/SelectFromOptions/util";

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
