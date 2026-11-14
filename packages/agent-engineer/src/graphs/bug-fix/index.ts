import {createAgentGraph} from '../agent-graph.js';

/** Fixes a reported bug whose cause or fix is clear enough to act on. */
export const buildBugFixGraph = () => createAgentGraph({
    name: 'bug-fix',
    access: 'write',
    instructions: [
        'Fix the bug the user reported. Find the code behind it, confirm the cause by reading it, and make the smallest',
        'change that fixes the cause rather than the symptom. Add or update a test that would have caught it when the',
        'package has tests. Reply with the cause, the fix, and anything you could not verify.',
    ].join(' '),
});
