import {classify, type EvalCase, type EvalDefinition, formatConfusionMatrix, loadDataset, type TrialResult} from '@epsilon-asi/evals';
import {DEFAULT_OPTION_SELECTION_MODEL, RunRecorder, type StructuredOutputModel} from '@epsilon-asi/langgraph';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {type Intent, intentAccess, Intents, PARSE_INTENT_PROMPT, ParseIntentNode} from '../../src/graphs/router.js';

/** The labeled requests the intent eval runs. */
export const INTENT_DATASET = fileURLToPath(new URL('./dataset.yaml', import.meta.url));

/**
 * What the intent eval holds the model to. `correct` is the share of requests routed to their intent (or one listed
 * in `also`); `readRoutedToWrite` is the share of read-only requests (questions and plans) sent to an agent that
 * changes code, the costly mistake. First guesses: calibrate them against the first recorded baseline.
 */
export const INTENT_THRESHOLDS = {
    correct: {min: 0.8},
    readRoutedToWrite: {max: 0.05},
} as const;

export interface IntentExpectation {
    readonly intent: Intent;
    /** Other intents that are as good for this request. */
    readonly also: readonly Intent[];
}

export interface IntentChoice {
    readonly choice: Intent;
    readonly reasoning: string;
}

const isIntent = (value: unknown): value is Intent => typeof value === 'string' && Object.hasOwn(Intents, value);

/** One dataset record as an eval case, rejecting unknown intents and missing fields. */
export const parseIntentCase = (record: unknown): EvalCase<string, IntentExpectation> => {
    const {id, request, intent, also = [], tags = []} = (record ?? {}) as Record<string, unknown>;
    if (typeof id !== 'string' || id === '') throw new Error('needs an id');
    if (typeof request !== 'string' || request.trim() === '') throw new Error(`${id} needs a request`);
    if (!isIntent(intent)) throw new Error(`${id} has the intent ${String(intent)}, which is not one of ${Object.keys(Intents).join(', ')}`);
    if (!Array.isArray(also) || !also.every(isIntent)) throw new Error(`${id} has an also that is not a list of intents`);
    if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')) throw new Error(`${id} has tags that are not a list of strings`);
    return {id, input: request, expected: {intent, also}, tags};
};

/** Every acceptable intent of a case is read-only. */
const readOnly = (expected: IntentExpectation) => [expected.intent, ...expected.also].every((intent) => intentAccess(intent) === 'read');

const rate = (trials: readonly TrialResult<string, IntentExpectation, IntentChoice>[], wrong: (choice: Intent) => boolean): number => {
    const answered = trials.filter((trial) => trial.output !== undefined);
    return answered.length === 0 ? 0 : answered.filter((trial) => wrong(trial.output!.choice)).length / answered.length;
};

const predictions = (trials: readonly TrialResult<string, IntentExpectation, IntentChoice>[]) => trials.map((trial) => ({
    expected: trial.expected.intent,
    actual: trial.output?.choice,
    accepted: trial.expected.also,
}));

/** A short fingerprint of the routing prompt and the intent descriptions, so a baseline shows which prompt it measured. */
export const intentPromptVersion = (): string =>
    createHash('sha256').update(PARSE_INTENT_PROMPT).update(JSON.stringify(Intents)).digest('hex').slice(0, 12);

export interface IntentEvalOptions {
    /** The model under test. Default: the intent node's own, DEFAULT_OPTION_SELECTION_MODEL. */
    model?: StructuredOutputModel;
    /** Names the model in the report and baseline. Default: DEFAULT_OPTION_SELECTION_MODEL. */
    modelName?: string;
    /** Default: INTENT_DATASET. */
    dataset?: string;
}

/**
 * The intent eval: each labeled request goes through ParseIntentNode, the node `do` routes with, on the model under
 * test. It scores the routing, the costly mistakes, and per-intent recall, and shows a confusion matrix.
 */
export const createIntentEval = (options: IntentEvalOptions = {}): EvalDefinition<string, IntentExpectation, IntentChoice> => {
    const {model, modelName = DEFAULT_OPTION_SELECTION_MODEL, dataset = INTENT_DATASET} = options;
    return {
        name: 'intent',
        meta: {intentModel: modelName, prompt: intentPromptVersion()},
        cases: () => loadDataset(dataset, parseIntentCase),
        task: async (request, {signal, recordUsage}) => {
            const recorder = new RunRecorder();
            const result = await ParseIntentNode(
                {messages: [{role: 'user', content: request}]},
                {context: {models: model === undefined ? {} : {intent: model}}, callbacks: [recorder], signal},
            );
            const {inputTokens, outputTokens} = recorder.summary();
            recordUsage({inputTokens, outputTokens});
            return {choice: result.choice, reasoning: result.reasoning};
        },
        graders: {
            correct: ({case: evalCase, output}) => {
                const right = output.choice === evalCase.expected.intent || evalCase.expected.also.includes(output.choice);
                return right ? 1 : {score: 0, note: `chose ${output.choice}: ${output.reasoning}`};
            },
        },
        metrics: (trials) => {
            const report = classify(predictions(trials), Object.keys(Intents));
            const recalls = Object.values(report.perLabel).map((label) => label.recall);
            return {
                readRoutedToWrite: rate(trials.filter((trial) => readOnly(trial.expected)), (choice) => intentAccess(choice) === 'write'),
                writeRoutedToRead: rate(trials.filter((trial) => intentAccess(trial.expected.intent) === 'write'), (choice) => intentAccess(choice) === 'read'),
                macroRecall: recalls.reduce((total, recall) => total + recall, 0) / recalls.length,
            };
        },
        details: (report) => `### Confusion matrix\n\n${formatConfusionMatrix(classify(predictions(report.trials), Object.keys(Intents)))}`,
        thresholds: INTENT_THRESHOLDS,
    };
};
