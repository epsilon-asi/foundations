import {z} from "zod/v4";
import OpenAI from "openai";

export type ZodInputType<Type extends {} = any> = z.ZodObject<Type>;
export type ZodOutputType<InputType extends ZodInputType | string> = InputType extends string ? string : z.infer<InputType>
export type OpenAICallableFunction = (...args: any[]) => Promise<string>
export type OpenAICallableFunctionDefinition = {
    cb: OpenAICallableFunction,
    tool: OpenAI.Responses.Tool
}
export type OpenAICallableFunctionObject = Record<string, OpenAICallableFunctionDefinition>;

export interface GenerateResponseOpts<Type extends ZodInputType | string, ApplicationMetadata extends Record<string, string>> {
    previousResponseId?: string,
    model?: OpenAI.ResponsesModel
    reasoning?: OpenAI.Reasoning
    web_search?: OpenAI.Responses.WebSearchTool,
    tool_choice?: OpenAI.Responses.ResponseCreateParams['tool_choice']
    metadata?: ApplicationMetadata
    tools?: OpenAICallableFunctionObject,
    vectorStores?: string[]
    schema?: Type
    input: OpenAI.Responses.ResponseInputItem[],
}
