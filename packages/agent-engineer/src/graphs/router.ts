import {createOptionSelectionNode} from "@epsilon-asi/langgraph";
import {END, type LangGraphRunnableConfig, START, StateGraph} from "@langchain/langgraph";
import {type EngineerContext, engineerContext, withWorkspace} from "../agents/workspace.js";
import type {createAgentGraph} from "./agent-graph.js";
import {buildAnswerQuestionGraph} from "./answer-question/index.js";
import {buildBugFixPlannerGraph} from "./bug-fix-planner/index.js";
import {buildBugFixGraph} from "./bug-fix/index.js";
import {buildComponentChangeGraph} from "./component-change/index.js";
import {buildComponentPlannerGraph} from "./component-planner/index.js";
import {buildFeatureChangeGraph} from "./feature-change/index.js";
import {buildFeaturePlannerGraph} from "./feature-planner/index.js";
import {buildMiniChangeGraph} from "./mini-change/index.js";
import {EngineerState, type EngineerStateType} from "./state.js";

// One option per graph folder in src/graphs. Each value tells the model when to choose that option.
export const Intents = {
    answer_question: "The user is asking a question about the code, the project or how something works, and wants an answer rather than any change to the code.",
    mini_change: "The user wants a small, well-defined edit that touches one file or a few lines, such as renaming something, changing a value or text, fixing a typo, or adjusting a type, and that likely needs no planning.",
    bug_fix: "The user reports something broken (an error, a crash, a failing test or wrong behaviour) and wants it fixed now, and the cause or the fix is clear enough to act on without a written plan first.",
    bug_fix_planner: "The user reports something broken but the cause is unknown, the bug spans several parts of the system, or the user asks to investigate, diagnose or plan the fix before any code is changed.",
    component_change: "The user wants to build or change one self-contained component, module, class or function (its behaviour, interface or internals), and the work is clear enough to start without a written plan first.",
    component_planner: "The user wants to design or plan a new or reworked component, module or class before it is built, or the component work is large or unclear enough that it needs a plan before any code is changed.",
    feature_change: "The user wants to add or change a feature that spans several components or files, and the requirements are clear enough to start building without a written plan first.",
    feature_planner: "The user wants to scope, design or plan a new feature or a change to an existing one before it is built, or the feature work is large or unclear enough that it needs a plan before any code is changed.",
};

export type Intent = keyof typeof Intents;

const parseIntentPrompt =
    "Which workflow should handle the user's latest request? If more than one fits, choose the one that matches the size of the work and whether the user wants a plan first.";

/** Picks the intent graph for a request, on the run's `models.intent` when it has one. */
export const ParseIntentNode = createOptionSelectionNode(parseIntentPrompt, Intents, {
    model: (runtime) => (runtime?.context as Partial<EngineerContext> | undefined)?.models?.intent,
});

/** ParseIntentNode, reporting the intent it chose as the run's progress. */
const parseIntent = async (state: EngineerStateType, runtime?: LangGraphRunnableConfig) => {
    engineerContext(runtime).progress?.("parsing the intent");
    const result = await ParseIntentNode(state, runtime);
    engineerContext(runtime).progress?.(`routing to ${result.choice}`);
    return result;
};

/** The graph each intent routes to. Typed by Intent, so adding an intent without its graph does not compile. */
export const IntentGraphs: Record<Intent, () => ReturnType<typeof createAgentGraph>> = {
    answer_question: buildAnswerQuestionGraph,
    mini_change: buildMiniChangeGraph,
    bug_fix: buildBugFixGraph,
    bug_fix_planner: buildBugFixPlannerGraph,
    component_change: buildComponentChangeGraph,
    component_planner: buildComponentPlannerGraph,
    feature_change: buildFeatureChangeGraph,
    feature_planner: buildFeaturePlannerGraph,
};

/**
 * The root graph: parses the intent of the user's request, then routes it to that intent's graph, whose agent
 * answers it or changes the repository. Every run gets a repository sandbox, removed when the run ends.
 *
 * @example await buildRouterGraph().invoke({ messages: [{ role: "user", content: query }] }, { context: { config } });
 */
export const buildRouterGraph = () => {
    const graph = new StateGraph(EngineerState).addNode("parseIntent", parseIntent);
    for (const [intent, build] of Object.entries(IntentGraphs)) {
        graph.addNode(intent, build());
        graph.addEdge(intent as typeof START, END);
    }
    const intents = Object.keys(IntentGraphs) as Intent[];
    return withWorkspace(graph
        .addEdge(START, "parseIntent")
        .addConditionalEdges("parseIntent", (state) => state.choice, intents as unknown as ["parseIntent"])
        .compile({name: "router"}));
};
