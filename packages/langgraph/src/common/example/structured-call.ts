import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod/v4";

// The shape we want the model to return.
const MovieReviewSchema = z.object({
    title: z.string().describe("The title of the movie"),
    sentiment: z.enum(["positive", "neutral", "negative"]).describe("Overall sentiment of the review"),
    rating: z.number().int().min(1).max(10).describe("Rating from 1 to 10"),
    summary: z.string().describe("One sentence summary of the review"),
});

export type MovieReview = z.infer<typeof MovieReviewSchema>;

const model = new ChatOpenAI({
    model: "gpt-5.5",
    useResponsesApi: true,
    zdrEnabled: true,
    maxRetries: 2,
});

// Binds the schema to the model; the result is parsed and typed as MovieReview.
const structuredModel = model.withStructuredOutput(MovieReviewSchema, {
    name: "movie_review",
    strict: true,
});

export const reviewMovie = async (review: string): Promise<MovieReview> => {
    return structuredModel.invoke([
        { role: "system", content: "Extract a structured review from the user's text." },
        { role: "user", content: review },
    ]);
};

// Run directly: npx tsx src/common/example/structured-call.ts
if (require.main === module) {
    reviewMovie("Just watched Arrival. Slow burn, but the ending floored me. Easily a 9.")
        .then((result) => console.log(result))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
