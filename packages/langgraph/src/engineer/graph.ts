import {END, START, StateGraph,} from "@langchain/langgraph";
import {ContextualGraph} from "../common/wrappers/ContextualGraph.js";
import context from "./context/index.js";
import {GraphState} from "./state/index.js";

// Every run gets its own sandbox in the runtime context; nodes read it with requireContext(runtime, "sandbox").
export const buildGraph = () => {
    return ContextualGraph(
        new StateGraph(GraphState)

            .compile(),
        context.engineering);
}
