import {describe, expect, it} from "vitest";
import {z} from "zod/v4";
import {ProtectedStructuredNode} from "../../src/common/wrappers/ProtectedNode";
import {AgenticIntermediaryNode} from "../../src/common/wrappers/AgenticIntermediaryNode";
import {AgenticMessagingState, AgenticMessagingStateZod} from "../../src/types/AgenticMessagingState";

describe("ProtectedStructuredNode", () => {
    const double = ProtectedStructuredNode({
        input: z.object({value: z.number()}),
        output: z.object({doubled: z.number().max(10)}),
    }, ({value}) => ({doubled: value * 2}));

    it("parses the input, runs the node, and parses the output", async () => {
        await expect(double({value: 2, extra: true} as never)).resolves.toEqual({doubled: 4});
    });

    it("rejects invalid input before the node runs", async () => {
        await expect(double({value: "2"} as never)).rejects.toThrow();
    });

    it("rejects invalid output", async () => {
        await expect(double({value: 6})).rejects.toThrow();
    });
});

describe("AgenticIntermediaryNode", () => {
    const Conversation = z.object({messages: AgenticMessagingStateZod});
    type Conversation = z.infer<typeof Conversation>;

    it("runs the node on the validated conversation", async () => {
        const reply = AgenticIntermediaryNode<Conversation, Conversation>({input: Conversation, output: Conversation}, async (state) => ({
            messages: [{role: "assistant", content: `echo: ${state.messages[0].content}`}],
        }));
        await expect(reply({messages: [{role: "user", content: "hi"}]})).resolves.toEqual({
            messages: [{role: "assistant", content: "echo: hi"}],
        });
    });

    it("rejects messages with an unknown role", async () => {
        const reply = AgenticIntermediaryNode<Conversation, Conversation>({input: Conversation, output: Conversation}, (state) => state);
        await expect(reply({messages: [{role: "tool", content: "x"}]} as never)).rejects.toThrow();
    });
});

describe("AgenticMessagingState", () => {
    it("appends only the last message of each update", () => {
        const channel = AgenticMessagingState.spec.messages;
        const reducer = (channel as unknown as { operator: (l: unknown[], r: unknown[]) => unknown[] }).operator;
        const a = {role: "user", content: "a"};
        const b = {role: "assistant", content: "b"};
        const c = {role: "assistant", content: "c"};
        expect(reducer([a], [b, c])).toEqual([a, c]);
    });
});
