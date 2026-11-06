import {z} from "zod/v4";
export const GeneratedUpdateSchema = z.object({
    location: z.string().min(1),
    updatedContents: z.string(),
});
export const OutputTargetSchema = z.object({
    key: z.string().min(1).optional(),
    pathTemplate: z.string().min(1),
    description: z.string().optional(),
});
export const OutputSchema = z
    .object({
        pathTemplate: z.string().optional(),
        pathTemplates: z.array(OutputTargetSchema).optional(),
        maxFiles: z.number().int().max(100).optional(),
    })
    .superRefine((value, ctx) => {
        if (!value.pathTemplate && !value.pathTemplates) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'output must define either pathTemplate or pathTemplates.',
            });
        }

        if (value.pathTemplate && value.pathTemplates) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'output cannot define both pathTemplate and pathTemplates at the same time.',
            });
        }
    });


export type GeneratedUpdate = z.infer<typeof GeneratedUpdateSchema>;
export type OutputTarget = z.infer<typeof OutputTargetSchema>;
export type Output = z.infer<typeof OutputSchema>;
