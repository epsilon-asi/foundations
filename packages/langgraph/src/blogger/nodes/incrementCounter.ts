import { z } from "zod/v4";

const CounterNodeInputSchema = z.object({
    counter: z.number().int(),
});

const CounterNodeOutputSchema = z.object({
    counter: z.number().int(),
});

type CounterNodeInput = z.input<typeof CounterNodeInputSchema>;
type CounterNodeOutput = z.output<typeof CounterNodeOutputSchema>;

export async function incrementCounterNode(
    rawState: CounterNodeInput,
): Promise<CounterNodeOutput> {
    const state = CounterNodeInputSchema.parse(rawState);

    console.log("Current state:", state);

    return CounterNodeOutputSchema.parse({
        counter: state.counter + 1,
    });
}