import { tool, ServerTool } from "@langchain/core/tools";
import { z } from "zod/v4";

export const addNumbersTool = tool(
    async ({ a, b }) => {
        return {
            result: a + b,
        };
    },
    {
        name: "add_numbers",
        description: "Add two numbers together.",
        schema: z.object({
            a: z.number().describe("The first number"),
            b: z.number().describe("The second number"),
        }),
    },
);

