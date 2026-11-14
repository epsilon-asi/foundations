import {createAgentGraph} from '../agent-graph.js';

/** Adds or changes a feature that spans several components or files. */
export const buildFeatureChangeGraph = () => createAgentGraph({
    name: 'feature-change',
    access: 'write',
    instructions: [
        'Build the feature the user described, across every component and file it touches. Map the code involved',
        'before changing anything, then make the change end to end: implementation, wiring, exports, tests and docs.',
        'Reply with how the feature works, every file you changed, and anything left to do.',
    ].join(' '),
});
