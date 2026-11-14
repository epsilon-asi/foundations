import {BaseChatModel} from '@langchain/core/language_models/chat_models';
import {AIMessage, type BaseMessage} from '@langchain/core/messages';
import type {ChatResult} from '@langchain/core/outputs';

/** A tool call the scripted model makes. */
export interface ScriptedToolCall {
    name: string;
    args: Record<string, unknown>;
}

/** A reply: text ends the agent's run, a list of tool calls makes another tool round. */
export type ScriptedReply = string | ScriptedToolCall[] | Error;

/** Token usage every scripted reply reports. */
export const SCRIPTED_USAGE = {input_tokens: 100, output_tokens: 20, total_tokens: 120};

/** A chat model that gives scripted replies in order and records the messages of every call. A reply that is an Error is thrown. */
export class ScriptedChatModel extends BaseChatModel {
    readonly calls: BaseMessage[][] = [];
    readonly replies: ScriptedReply[];

    constructor(replies: ScriptedReply[]) {
        super({});
        this.replies = [...replies];
    }

    _llmType(): string {
        return 'scripted';
    }

    /** Names of the tools the agent bound, from the last bindTools call. */
    boundTools: string[] = [];

    override bindTools(tools: readonly ({ name?: string } | unknown)[]): this {
        this.boundTools = tools.map((tool) => (tool as { name?: string }).name ?? '?');
        return this;
    }

    async _generate(messages: BaseMessage[]): Promise<ChatResult> {
        this.calls.push(messages);
        const reply = this.replies.shift() ?? 'done';
        if (reply instanceof Error) {
            throw reply;
        }
        const message = typeof reply === 'string'
            ? new AIMessage(reply)
            : new AIMessage({
                content: '',
                tool_calls: reply.map((call, index) => ({...call, id: `call_${this.calls.length}_${index}`, type: 'tool_call' as const})),
            });
        // Untyped: AIMessage's default type parameters type usage_metadata as undefined in this @langchain/core.
        Object.assign(message, {usage_metadata: SCRIPTED_USAGE});
        return {generations: [{message, text: typeof reply === 'string' ? reply : ''}]};
    }

    /** The tool results the model was shown, by tool name, in order. */
    toolResults(): { name: string; content: string }[] {
        const last = this.calls.at(-1) ?? [];
        return last
            .filter((message) => message.getType() === 'tool')
            .map((message) => ({name: (message as BaseMessage & { name?: string }).name ?? '', content: String(message.content)}));
    }
}
