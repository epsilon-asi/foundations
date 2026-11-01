import {AgenticIntermediaryNode} from "../../wrappers/AgenticIntermediaryNode";
import {z} from "zod/v4";
import {AgenticMessagingStateZod} from "../../../types/AgenticMessagingState";
import {ChatOpenAI} from "@langchain/openai";
import {formatRecord} from "./util";

type EnumToPromptMap<Keys extends string, Values extends string> = Record<Keys, Values>;

export const createOptionSelectionNode = <
    Keys extends string,
    Values extends string, >(
    prompt: string,
    options: EnumToPromptMap<Keys, Values>,
) => {
    const TypedOptionsArray: (Keys & string)[] = Object.keys(options) as (Keys)[];
    const InputFields = {
        prompt: z.string(),
    }
    const InputSchema = z.object({
        ...InputFields,
        messages: AgenticMessagingStateZod
    })
    const OutputFields = {
        choice: z.literal(TypedOptionsArray),
        reasoning: z.string(),
    }
    const OutputSchema = z.object({
        ...OutputFields,
        messages: AgenticMessagingStateZod
    })


    return AgenticIntermediaryNode<z.Infer<typeof InputSchema>, z.Infer<typeof OutputSchema>>({
        input: InputSchema,
        output: OutputSchema
    }, async (nodeInput) => {
        const model = new ChatOpenAI({
            model: "gpt-5.5",
            useResponsesApi: true,
            zdrEnabled: true,
            maxRetries: 2,
        });
        const structuredModel = model.withStructuredOutput(z.object(OutputFields), {
            name: "option_selection",
            strict: true,
            includeRaw: true,
        });
        const response = await structuredModel.invoke([...nodeInput.messages.map((m) => ({
            role: m.role,
            content: m.content,
        })), {
            role: "system",
            content: ["The options and when to choose them can be found below:", formatRecord(options),].join("\n"),
        }, {
            role: "user",
            content: prompt,
        }]);

        return {
            messages: nodeInput.messages,
            ...response.parsed,
        }
    })
}
