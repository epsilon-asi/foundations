import {AgenticMessagingState, createOptionSelectionNode} from "@epsilon-asi/langgraph";
import {Annotation, END, START, StateGraph} from "@langchain/langgraph";

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

export const ParseIntentNode = createOptionSelectionNode(parseIntentPrompt, Intents);

const ParseIntentState = Annotation.Root({
    ...AgenticMessagingState.spec,
    choice: Annotation<Intent>,
    reasoning: Annotation<string>,
});

/** A graph with only ParseIntentNode in it, for trying the intent parsing on its own. */
export const buildParseIntentGraph = () => {
    return new StateGraph(ParseIntentState)
        .addNode("parseIntent", ParseIntentNode)
        .addEdge(START, "parseIntent")
        .addEdge("parseIntent", END)
        .compile();
};
    