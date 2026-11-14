import {createAgentGraph} from '../agent-graph.js';

/** Makes a small, well-defined edit to one file or a few lines. */
export const buildMiniChangeGraph = () => createAgentGraph({
    name: 'mini-change',
    access: 'write',
    instructions: [
        'Make the small, well-defined edit the user asked for: a rename, a changed value or text, a typo, a type.',
        'Find every place the edit has to reach (for a rename, search for references), make it, and reply with what',
        'you changed in one or two sentences.',
    ].join(' '),
});
