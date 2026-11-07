import {z} from 'zod/v4';

/** Variables every template gets without declaring them. */
export const BUILT_IN_VARIABLES = ['name', 'packageName', 'PascalName'] as const;

/** A variable name usable as `{{name}}`. */
export const VARIABLE_NAME = /^[A-Za-z]\w*$/;

/** A template id, which is also its folder name. */
export const TEMPLATE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const TemplateVariableSchema = z.object({
    description: z.string().min(1),
    required: z.boolean().default(false),
    default: z.string().optional(),
});

export const ProjectTemplateSchema = z
    .object({
        id: z.string().regex(TEMPLATE_ID, 'id must be kebab-case (e.g. express-api)'),
        description: z.string().min(1),
        variables: z.record(z.string(), TemplateVariableSchema).default({}),
    })
    .superRefine((template, ctx) => {
        for (const [key, variable] of Object.entries(template.variables)) {
            if (!VARIABLE_NAME.test(key)) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['variables', key],
                    message: `variable '${key}' must start with a letter and contain only letters, digits and _`,
                });
            }
            if ((BUILT_IN_VARIABLES as readonly string[]).includes(key)) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['variables', key],
                    message: `variable '${key}' is built in and cannot be declared`,
                });
            }
            if (variable.required && variable.default !== undefined) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['variables', key],
                    message: `variable '${key}' cannot be required and have a default`,
                });
            }
        }
    });

export type TemplateVariable = z.infer<typeof TemplateVariableSchema>;
export type ProjectTemplate = z.infer<typeof ProjectTemplateSchema>;
