import {defineEval} from '@epsilon-asi/evals';
import {createOpenAIModel} from '../../src/agents/index.js';
import {createIntentEval} from './intent.js';

// The intent eval calls OpenAI. EVAL_INTENT_MODEL picks another model to compare against the default.
if (!process.env['OPENAI_API_KEY']) {
    throw new Error('The intent eval calls OpenAI: set OPENAI_API_KEY, in the shell or the repository\'s .env.');
}
const modelName = process.env['EVAL_INTENT_MODEL'];

defineEval(createIntentEval(modelName ? {model: createOpenAIModel(modelName), modelName} : {}));
