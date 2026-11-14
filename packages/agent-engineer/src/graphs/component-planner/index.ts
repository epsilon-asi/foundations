import {createAgentGraph} from '../agent-graph.js';

/** Designs a new or reworked component and writes a plan, without changing code. */
export const buildComponentPlannerGraph = () => createAgentGraph({
    name: 'component-planner',
    instructions: [
        'Design the component, module or class the user described and plan how to build it; do not build it. Study the',
        'code it will sit beside and the patterns the repository already uses. Propose its interface (as code),',
        'where it lives, how callers use it, the alternatives you rejected and why, and the steps to build and test it.',
    ].join(' '),
});
