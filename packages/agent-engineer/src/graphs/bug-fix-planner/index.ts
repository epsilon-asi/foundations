import {createAgentGraph} from '../agent-graph.js';

/** Investigates a bug and writes a plan for fixing it, without changing code. */
export const buildBugFixPlannerGraph = () => createAgentGraph({
    name: 'bug-fix-planner',
    instructions: [
        'Investigate the bug the user reported and plan its fix; do not fix it. Trace the behaviour through the code,',
        'list the likely causes ranked by how well the code supports each, and say how to confirm each one. Then give',
        'a step-by-step plan for the fix: the files to change, what changes in each, and the tests that prove it.',
    ].join(' '),
});
