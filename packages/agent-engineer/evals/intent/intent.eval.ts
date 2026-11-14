import {defineEval} from '@epsilon-asi/evals';
import {ChatOpenAI} from '@langchain/openai';
import {createIntentEval} from './intent.js';

// The intent eval calls OpenAI. EVAL_INTENT_MODEL picks another model to compare against the default.
if (!process.env['OPENAI_API_KEY']) {
    throw new Error('The intent eval calls OpenAI: set OPENAI_API_KEY.');
}
const modelName = process.env['EVAL_INTENT_MODEL'];

defineEval(createIntentEval(modelName
    ? {model: new ChatOpenAI({model: modelName, useResponsesApi: true, zdrEnabled: true, maxRetries: 2}), modelName}
    : {}));
