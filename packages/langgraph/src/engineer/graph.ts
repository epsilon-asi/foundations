import {END, START, StateGraph,} from "@langchain/langgraph";
import {ContextualGraph} from "../common/wrappers/ContextualGraph";
import context from "./context";
import {GraphState} from "./state";

// Every run gets its own sandbox in the runtime context; nodes read it with requireContext(runtime, "sandbox").
export const buildGraph = () => {
    return ContextualGraph(
        new StateGraph(GraphState)

            .compile(),
        context.engineering);
}
