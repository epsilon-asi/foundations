import {createAgentGraph} from '../agent-graph.js';

/** Builds or changes one self-contained component, module, class or function. */
export const buildComponentChangeGraph = () => createAgentGraph({
    name: 'component-change',
    access: 'write',
    instructions: [
        'Build or change the one component, module, class or function the user described. Read how similar code in the',
        'repository is structured and follow it. Update its callers, exports and tests to match its new interface.',
        'Reply with what the component now does and every file you changed.',
    ].join(' '),
});
