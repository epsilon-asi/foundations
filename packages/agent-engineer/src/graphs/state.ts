import {AgenticMessagingState} from '@epsilon-asi/langgraph';
import {Annotation} from '@langchain/langgraph';
import type {Intent} from './router.js';

/** What a change agent left behind: the branch it committed to, and its commit. */
export interface EngineerChanges {
    readonly branch: string;
    readonly commit: string;
    /** Repository-relative paths the commit changed. */
    readonly files: readonly string[];
}

/** State shared by the router graph and every intent graph, so intent graphs plug in as nodes. */
export const EngineerState = Annotation.Root({
    ...AgenticMessagingState.spec,
    choice: Annotation<Intent>,
    reasoning: Annotation<string>,
    /** Set by change graphs that committed something. */
    changes: Annotation<EngineerChanges | undefined>,
});

export type EngineerStateType = typeof EngineerState.State;
