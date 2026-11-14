import {createAgentGraph} from '../agent-graph.js';

/** Scopes and designs a feature and writes a plan, without changing code. */
export const buildFeaturePlannerGraph = () => createAgentGraph({
    name: 'feature-planner',
    instructions: [
        'Scope and plan the feature the user described; do not build it. Map the parts of the repository it touches and',
        'what each needs. Give the goal, what is in and out of scope, the design, open questions, and an ordered plan',
        'of changes small enough to review one at a time, each with its files and tests.',
    ].join(' '),
});
