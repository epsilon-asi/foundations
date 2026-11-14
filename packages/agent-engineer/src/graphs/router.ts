import {createOptionSelectionNode} from "@epsilon-asi/langgraph";
import {END, type LangGraphRunnableConfig, START, StateGraph} from "@langchain/langgraph";
import {type EngineerContext, engineerContext, withWorkspace} from "../agents/workspace.js";
import type {RepoAccess} from "../agents/repo-agent.js";
import {type AgentGraphOptions, createAgentGraph} from "./agent-graph.js";
import {answerQuestionAgent} from "./answer-question/index.js";
import {bugFixPlannerAgent} from "./bug-fix-planner/index.js";
import {bugFixAgent} from "./bug-fix/index.js";
import {componentChangeAgent} from "./component-change/index.js";
import {componentPlannerAgent} from "./component-planner/index.js";
import {featureChangeAgent} from "./feature-change/index.js";
import {featurePlannerAgent} from "./feature-planner/index.js";
import {miniChangeAgent} from "./mini-change/index.js";
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

/** What the intent model is asked, after the conversation and the options. */
export const PARSE_INTENT_PROMPT =
    "Which workflow should handle the user's latest request? If more than one fits, choose the one that matches the size of the work and whether the user wants a plan first.";

/** Picks the intent graph for a request, on the run's `models.intent` when it has one. */
export const ParseIntentNode = createOptionSelectionNode(PARSE_INTENT_PROMPT, Intents, {
    model: (runtime) => (runtime?.context as Partial<EngineerContext> | undefined)?.models?.intent,
});

/** ParseIntentNode, reporting the intent it chose as the run's progress. */
const parseIntent = async (state: EngineerStateType, runtime?: LangGraphRunnableConfig) => {
    engineerContext(runtime).progress?.("parsing the intent");
    const result = await ParseIntentNode(state, runtime);
    engineerContext(runtime).progress?.(`routing to ${result.choice}`);
    return result;
};

/** The agent each intent routes to. Typed by Intent, so adding an intent without its agent does not compile. */
export const IntentAgents: Record<Intent, AgentGraphOptions> = {
    answer_question: answerQuestionAgent,
    mini_change: miniChangeAgent,
    bug_fix: bugFixAgent,
    bug_fix_planner: bugFixPlannerAgent,
    component_change: componentChangeAgent,
    component_planner: componentPlannerAgent,
    feature_change: featureChangeAgent,
    feature_planner: featurePlannerAgent,
};

/** Whether an intent's agent only reads the repository or also changes it. */
export const intentAccess = (intent: Intent): RepoAccess => IntentAgents[intent].access ?? "read";

/**
 * The root graph: parses the intent of the user's request, then routes it to that intent's graph, whose agent
 * answers it or changes the repository. Every run gets a repository sandbox, removed when the run ends.
 *
 * @example await buildRouterGraph().invoke({ messages: [{ role: "user", content: query }] }, { context: { config } });
 */
export const buildRouterGraph = () => {
    const graph = new StateGraph(EngineerState).addNode("parseIntent", parseIntent);
    for (const [intent, agent] of Object.entries(IntentAgents)) {
        graph.addNode(intent, createAgentGraph(agent));
        graph.addEdge(intent as typeof START, END);
    }
    const intents = Object.keys(IntentAgents) as Intent[];
    return withWorkspace(graph
        .addEdge(START, "parseIntent")
        .addConditionalEdges("parseIntent", (state) => state.choice, intents as unknown as ["parseIntent"])
        .compile({name: "router"}));
};
