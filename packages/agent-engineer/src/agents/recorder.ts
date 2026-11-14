import {BaseCallbackHandler} from '@langchain/core/callbacks/base';
import type {BaseMessage} from '@langchain/core/messages';
import type {LLMResult} from '@langchain/core/outputs';
import type {Serialized} from '@langchain/core/load/serializable';

/** One tool call of a run, in the order the calls started. */
export interface RecordedToolCall {
    readonly name: string;
    /** The arguments the model passed, parsed from JSON when they are JSON. */
    readonly input: unknown;
    /** What the tool returned to the model; undefined while running or after an error. */
    output: string | undefined;
    /** Set when the tool threw. Repo tools turn their errors into output, so this is rare. */
    error: string | undefined;
    durationMs: number | undefined;
}

/** One model call of a run, in the order the calls started. */
export interface RecordedModelCall {
    /** The model name, when the model reports it. */
    readonly model: string | undefined;
    inputTokens: number | undefined;
    outputTokens: number | undefined;
    error: string | undefined;
    durationMs: number | undefined;
}

/** Totals over a recorded run. Token counts only include calls that reported usage. */
export interface RunSummary {
    readonly toolCalls: number;
    readonly toolErrors: number;
    readonly modelCalls: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    /** Tool calls by tool name. */
    readonly toolsUsed: Readonly<Record<string, number>>;
}

/**
 * Records what a run did: every tool call with its input and output, and every model call with its token usage
 * and duration. Pass it in the callbacks of an engineer graph's `invoke`; it sees the intent model, the repo agent
 * and its tools. Tests assert on the trajectory, and evals score it.
 *
 * @example
 * const recorder = new RunRecorder();
 * await buildRouterGraph().invoke(input, { context: { config }, callbacks: [recorder] });
 * recorder.summary(); // { toolCalls: 4, modelCalls: 3, ... }
 */
export class RunRecorder extends BaseCallbackHandler {
    readonly name = 'run-recorder';
    readonly toolCalls: RecordedToolCall[] = [];
    readonly modelCalls: RecordedModelCall[] = [];
    readonly #tools = new Map<string, { call: RecordedToolCall; started: number }>();
    readonly #models = new Map<string, { call: RecordedModelCall; started: number }>();
    readonly #now: () => number;

    constructor(options: { now?: () => number } = {}) {
        super();
        this.#now = options.now ?? (() => performance.now());
    }

    override handleToolStart(tool: Serialized, input: string, runId: string, _parentRunId?: string, _tags?: string[], _metadata?: Record<string, unknown>, runName?: string): void {
        const call: RecordedToolCall = {name: runName ?? tool.id.at(-1) ?? 'unknown', input: parseJson(input), output: undefined, error: undefined, durationMs: undefined};
        this.toolCalls.push(call);
        this.#tools.set(runId, {call, started: this.#now()});
    }

    override handleToolEnd(output: unknown, runId: string): void {
        const run = this.#finish(this.#tools, runId);
        if (run !== undefined) {
            run.output = contentOf(output);
        }
    }

    override handleToolError(error: Error, runId: string): void {
        const run = this.#finish(this.#tools, runId);
        if (run !== undefined) {
            run.error = error.message;
        }
    }

    override handleChatModelStart(llm: Serialized, _messages: BaseMessage[][], runId: string, _parentRunId?: string, extraParams?: Record<string, unknown>): void {
        const invocation = extraParams?.['invocation_params'] as { model?: unknown } | undefined;
        const kwargs = (llm as { kwargs?: { model?: unknown } }).kwargs;
        const model = typeof invocation?.model === 'string' ? invocation.model : typeof kwargs?.model === 'string' ? kwargs.model : undefined;
        const call: RecordedModelCall = {model, inputTokens: undefined, outputTokens: undefined, error: undefined, durationMs: undefined};
        this.modelCalls.push(call);
        this.#models.set(runId, {call, started: this.#now()});
    }

    override handleLLMEnd(output: LLMResult, runId: string): void {
        const run = this.#finish(this.#models, runId);
        if (run === undefined) {
            return;
        }
        const message = (output.generations[0]?.[0] as { message?: { usage_metadata?: { input_tokens?: number; output_tokens?: number } } } | undefined)?.message;
        run.inputTokens = message?.usage_metadata?.input_tokens;
        run.outputTokens = message?.usage_metadata?.output_tokens;
    }

    override handleLLMError(error: Error, runId: string): void {
        const run = this.#finish(this.#models, runId);
        if (run !== undefined) {
            run.error = error.message;
        }
    }

    /** Totals over everything recorded so far. */
    summary(): RunSummary {
        const toolsUsed: Record<string, number> = {};
        for (const call of this.toolCalls) {
            toolsUsed[call.name] = (toolsUsed[call.name] ?? 0) + 1;
        }
        return {
            toolCalls: this.toolCalls.length,
            toolErrors: this.toolCalls.filter((call) => call.error !== undefined || call.output?.startsWith('Error: ')).length,
            modelCalls: this.modelCalls.length,
            inputTokens: sum(this.modelCalls.map((call) => call.inputTokens)),
            outputTokens: sum(this.modelCalls.map((call) => call.outputTokens)),
            toolsUsed,
        };
    }

    #finish<Call extends { durationMs: number | undefined }>(runs: Map<string, { call: Call; started: number }>, runId: string): Call | undefined {
        const run = runs.get(runId);
        if (run === undefined) {
            return undefined;
        }
        runs.delete(runId);
        run.call.durationMs = this.#now() - run.started;
        return run.call;
    }
}

const parseJson = (text: string): unknown => {
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
};

/** The text of a tool's result: a ToolMessage's content, or the value itself. */
const contentOf = (output: unknown): string => {
    const content = typeof output === 'object' && output !== null && 'content' in output ? (output as { content: unknown }).content : output;
    return typeof content === 'string' ? content : JSON.stringify(content);
};

const sum = (values: readonly (number | undefined)[]): number =>
    values.reduce<number>((total, value) => total + (value ?? 0), 0);
