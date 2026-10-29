export default {
  id: 'builder-method',
  description:
    'Add or update MessageBuilder convenience methods that compose primitives and prebuilt components without changing the core component contract.',

  instructions: `
Generate or update a MessageBuilder convenience method.

Repository-specific rules:
- Inspect src/core/builder.ts and tests/components-builder.test.ts before writing.
- A builder method should be a thin convenience wrapper around a block primitive or prebuilt component.
- Do not duplicate rendering logic in MessageBuilder; rendering belongs in src/blocks or src/prebuilt.
- Use Parameters<typeof helper>[0] where existing builder methods do this for prebuilt options.
- Preserve fluent chaining by returning this.
- Keep build options, defaults, metadata, unfurl, mrkdwn, parse, and validation behavior unchanged unless explicitly requested.
- Update tests to verify fluent composition and final payload behavior.
- Update examples or docs only if this changes the public API in a user-facing way.

General safety rules:
- Follow existing repo patterns.
- Use existing imports, naming, function style, and test style.
- Do not invent component APIs or Slack payload fields.
- Update tests when behavior changes.
- Keep outputs minimal and focused.
- Do not touch unrelated files.
- Run or describe the relevant typecheck/test command after changes.

Additional user instructions:
{{instructions}}
`.trim(),

  output: {
    pathTemplates: [
      {
        key: 'builder',
        pathTemplate: 'src/core/builder.ts',
        description: 'MessageBuilder method implementation and imports.',
      },
      {
        key: 'test',
        pathTemplate: 'tests/components-builder.test.ts',
        description: 'Builder and composition tests.',
      },
      {
        key: 'docs',
        pathTemplate: 'README.md',
        description: 'Public usage docs; update only for user-facing methods.',
      },
      {
        key: 'example',
        pathTemplate: 'examples/{{nameKebab}}.ts',
        description: 'Usage example if the method introduces a new common workflow.',
      },
    ],
    maxFiles: 5,
  },

  parameters: {
    name: {
      description: 'Builder method or workflow name, for example runbook, summary, timeline, or audit.',
      required: true,
    },
    instructions: {
      description: 'Which primitive/prebuilt component the method should wrap and any public API constraints.',
      required: false,
    },
  },

  examples: [
    'src/core/builder.ts',
    'tests/components-builder.test.ts',
    'examples/02-composed-dashboard.ts',
  ],

  context: [
    {
      kind: 'path',
      path: 'src/core/builder.ts',
      description: 'Builder fluent API and build behavior.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/core/component.ts',
      description: 'ComponentLike and render resolution contracts.',
      required: false,
    },
    {
      kind: 'pattern',
      pattern: 'src/prebuilt/*.ts',
      description: 'Prebuilt components that builder methods typically wrap.',
      limit: 8,
    },
    {
      kind: 'pattern',
      pattern: 'src/blocks/**/*.ts',
      description: 'Primitive block helpers that builder methods can wrap.',
      limit: 6,
    },
    {
      kind: 'path',
      path: 'tests/components-builder.test.ts',
      description: 'Fluent builder and component composition test style.',
      required: false,
    },
  ],

  keywordContexts: [
    {
      keywords: ['fallback', 'text', 'notification', 'accessibility'],
      description: 'Fallback text behavior when builder output changes.',
      context: [
        {
          kind: 'path',
          path: 'src/core/fallback.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'tests/components-builder.test.ts',
          required: false,
        },
      ],
    },
    {
      keywords: ['validate', 'validation', 'limits', '50 blocks'],
      description: 'Validation behavior used by MessageBuilder.build.',
      context: [
        {
          kind: 'path',
          path: 'src/core/validation.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/core/limits.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'tests/validation.test.ts',
          required: false,
        },
      ],
    },
  ],

  tooling: {
    allowGetExistingCode: true,
    allowFindFiles: true,
    allowSearchRepo: true,
  },
};
