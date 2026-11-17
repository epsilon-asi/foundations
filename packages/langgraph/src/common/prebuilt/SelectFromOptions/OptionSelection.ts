import type {LangGraphRunnableConfig} from "@langchain/langgraph";
import {AgenticIntermediaryNode} from "../../wrappers/AgenticIntermediaryNode.js";
import {z} from "zod/v4";
import {AgenticMessagingStateZod} from "../../../types/AgenticMessagingState.js";
import {ChatOpenAI} from "@langchain/openai";
import {formatRecord} from "./util.js";

type EnumToPromptMap<Keys extends string, Values extends string> = Record<Keys, Values>;

/** The OpenAI model option selection uses when no `model` is given. */
export const DEFAULT_OPTION_SELECTION_MODEL = "gpt-5.5";

/**
 * The part of a chat model option selection uses; every LangChain chat model has it. It is typed by shape rather
 * than as BaseChatModel, so models built against the ESM or the CommonJS types of @langchain/core both fit.
 */
export interface StructuredOutputModel {
    withStructuredOutput(schema: any, config?: any): { invoke(input: any, options?: any): Promise<any> };
}

/** What a model resolver is given: the node's runtime, of which it usually reads `context`. */
export type OptionSelectionRuntime = { readonly context?: unknown } | undefined;

export interface OptionSelectionNodeOptions {
    /**
     * The model that makes the choice, or a function that picks one for each run from the node's runtime and
     * returns undefined to use the default. Default: `DEFAULT_OPTION_SELECTION_MODEL` through the OpenAI Responses API.
     */
    model?: StructuredOutputModel | ((runtime: OptionSelectionRuntime) => StructuredOutputModel | undefined);
}

const createDefaultModel = (): StructuredOutputModel => new ChatOpenAI({
    model: DEFAULT_OPTION_SELECTION_MODEL,
    useResponsesApi: true,
    zdrEnabled: true,
    maxRetries: 2,
});

const resolveModel = (model: OptionSelectionNodeOptions["model"], runtime: LangGraphRunnableConfig | undefined): StructuredOutputModel =>
    (typeof model === "function" ? model(runtime) : model) ?? createDefaultModel();

export const createOptionSelectionNode = <
    Keys extends string,
    Values extends string, >(
    prompt: string,
    options: EnumToPromptMap<Keys, Values>,
    nodeOptions: OptionSelectionNodeOptions = {},
) => {
    const TypedOptionsArray: (Keys & string)[] = Object.keys(options) as (Keys)[];
    const InputSchema = z.object({
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
    }, async (nodeInput, runtime) => {
        const structuredModel = resolveModel(nodeOptions.model, runtime).withStructuredOutput(z.object(OutputFields), {
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
        }], {
            // Callbacks carry tracing and run recorders into the model call; the signal lets a caller abort it.
            ...(runtime?.callbacks ? {callbacks: runtime.callbacks} : {}),
            ...(runtime?.signal ? {signal: runtime.signal} : {}),
        });

        return {
            // The choice adds nothing to the conversation; returning nodeInput.messages would duplicate its last message.
            messages: [],
            ...response.parsed,
        }
    })
}
