import { createOptionSelectionNode } from "../prebuilt/SelectFromOptions/OptionSelection.js";
import {pathToFileURL} from "node:url";

// Each key is an option the model can choose; each value tells the model when to choose it.
const SupportTeams = {
    billing: "The user has a question about a charge, a refund, an invoice or a payment method.",
    technical: "Something in the app is broken: an error, a crash, or a feature not working as expected.",
    account: "The user needs help signing in, resetting a password, or changing their profile details.",
};

const routingPrompt = "Which support team should handle this conversation?";

const routeToTeam = createOptionSelectionNode(routingPrompt, SupportTeams);

export const routeSupportRequest = async (request: string) => {
    return routeToTeam({ messages: [{ role: "user", content: request }] });
};

// Run directly: npx tsx --env-file=.env src/common/example/option-selection.ts
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    const requests = [
        "I was charged twice for my last booking. Can one of the charges be refunded?",
        "The app crashes every time I open the messages tab.",
        "I got a new phone and can't remember my password. How do I reset it?",
    ];

    Promise.all(requests.map(routeSupportRequest))
        .then((results) => results.forEach(({ choice, reasoning }, i) => {
            console.log({ request: requests[i], choice, reasoning });
        }))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
