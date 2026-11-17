import {type AgentGraphOptions, createAgentGraph} from '../agent-graph.js';

/** Answers a question about the code, the project or how something works, from what the repository says. */
export const answerQuestionAgent: AgentGraphOptions = {
    name: 'answer-question',
    instructions: [
        'Answer the user\'s question about this repository. Search for the code, docs and config involved and read them',
        'before answering. Lead with the direct answer, then the detail that supports it. When the repository does not',
        'settle the question, say what you found and what is still unknown rather than guessing.',
    ].join(' '),
};

export const buildAnswerQuestionGraph = () => createAgentGraph(answerQuestionAgent);
