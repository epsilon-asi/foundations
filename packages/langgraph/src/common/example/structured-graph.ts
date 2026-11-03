import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod/v4";
import { ProtectedStructuredNode } from "../wrappers/ProtectedNode";

const LineItemSchema = z.object({
    name: z.string(),
    priceCents: z.number().int().nonnegative(),
    quantity: z.number().int().positive(),
});

const DiscountCodeSchema = z.enum(["SAVE10", "HALFOFF"]);

const DiscountRates: Record<z.infer<typeof DiscountCodeSchema>, number> = {
    SAVE10: 0.1,
    HALFOFF: 0.5,
};

const OrderState = Annotation.Root({
    items: Annotation<z.infer<typeof LineItemSchema>[]>,
    discountCode: Annotation<z.infer<typeof DiscountCodeSchema> | undefined>,
    subtotalCents: Annotation<number>,
    discountCents: Annotation<number>,
    totalCents: Annotation<number>,
});

// Each node sees only the fields in its input schema, and its output is validated before it is written to the graph state.
const calculateSubtotal = ProtectedStructuredNode({
    input: z.object({ items: z.array(LineItemSchema).min(1) }),
    output: z.object({ subtotalCents: z.number().int() }),
}, ({ items }) => ({
    subtotalCents: items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0),
}));

const applyDiscount = ProtectedStructuredNode({
    input: z.object({ subtotalCents: z.number().int(), discountCode: DiscountCodeSchema.optional() }),
    output: z.object({ discountCents: z.number().int(), totalCents: z.number().int() }),
}, ({ subtotalCents, discountCode }) => {
    const discountCents = discountCode ? Math.round(subtotalCents * DiscountRates[discountCode]) : 0;
    return { discountCents, totalCents: subtotalCents - discountCents };
});

export const buildGraph = () => {
    return new StateGraph(OrderState)
        .addNode("calculateSubtotal", calculateSubtotal)
        .addNode("applyDiscount", applyDiscount)
        .addEdge(START, "calculateSubtotal")
        .addEdge("calculateSubtotal", "applyDiscount")
        .addEdge("applyDiscount", END)
        .compile();
};

// Run directly: npx tsx src/common/example/structured-graph.ts
if (require.main === module) {
    buildGraph()
        .invoke({
            items: [
                { name: "Notebook", priceCents: 450, quantity: 3 },
                { name: "Pen", priceCents: 199, quantity: 2 },
            ],
            discountCode: "SAVE10",
        })
        .then((result) => console.log(result))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
