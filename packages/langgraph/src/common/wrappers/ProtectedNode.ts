import {z} from "zod/v4";

export function ProtectedStructuredNode<Input, Output>(
    schemas: {
        input: z.ZodType<Input>,
        output: z.ZodType<Output>
    },
    node: (state: Input)=>Promise<Output> | Output,
) {
    return async (rawState: Input) => {
        const data: Input = schemas.input.parse(rawState);
        const result = await node(data);
        return schemas.output.parse(result);
    }
}