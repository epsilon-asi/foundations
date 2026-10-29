export default {
  id: 'slack-types-validation',
  description:
    'Generate or update Slack payload types, limits, validation, truncation, and fallback safeguards while preserving Block Kit compatibility.',

  instructions: `
Generate or update Slack types, limits, validation, or truncation behavior.

Repository-specific rules:
- Inspect src/types/slack.ts, src/core/limits.ts, src/core/validation.ts, src/core/errors.ts, src/core/fallback.ts, src/utils/text.ts, and tests/validation.test.ts before writing.
- Treat src/types/slack.ts as the source of truth for internal Slack payload shapes.
- Keep validation aligned with documented Slack limits and with the existing MessageValidationError style.
- Prefer rejecting malformed payloads through assertValidMessage and truncating predictable text inputs through existing helper functions.
- Do not add overly broad any types unless adapting to a deliberately unknown external Slack SDK response.
- Do not weaken validation to make tests pass.
- Add tests for valid payloads, invalid payloads, boundary values, truncation, and fallback behavior.
- Update docs when user-facing limits or compatibility behavior changes.

General safety rules:
- Follow existing repo patterns.
- Use existing imports, naming, function style, and test style.
- Do not invent Slack APIs, properties, or conventions.
- Update tests when behavior changes.
- Keep outputs minimal and focused.
- Do not include secrets.
- Run or describe the relevant typecheck/test command after changes.

Additional user instructions:
{{instructions}}
`.trim(),

  output: {
    pathTemplates: [
      {
        key: 'types',
        pathTemplate: 'src/types/slack.ts',
        description: 'Slack payload, block, text, element, and metadata types.',
      },
      {
        key: 'limits',
        pathTemplate: 'src/core/limits.ts',
        description: 'Slack limit constants.',
      },
      {
        key: 'validation',
        pathTemplate: 'src/core/validation.ts',
        description: 'Message validation rules.',
      },
      {
        key: 'text-utils',
        pathTemplate: 'src/utils/text.ts',
        description: 'Truncation or text normalization utilities if needed.',
      },
      {
        key: 'test',
        pathTemplate: 'tests/validation.test.ts',
        description: 'Validation, limits, and boundary tests.',
      },
      {
        key: 'docs',
        pathTemplate: 'README.md',
        description: 'Slack compatibility notes; update only if public behavior changes.',
      },
    ],
    maxFiles: 6,
  },

  parameters: {
    name: {
      description: 'Validation or type area, for example context-elements, button-confirm, metadata, or section-accessory.',
      required: true,
    },
    instructions: {
      description: 'Type shape, Slack limit, validation behavior, or compatibility change to implement.',
      required: false,
    },
  },

  examples: [
    'src/types/slack.ts',
    'src/core/limits.ts',
    'src/core/validation.ts',
    'src/core/fallback.ts',
    'tests/validation.test.ts',
  ],

  context: [
    {
      kind: 'path',
      path: 'src/types/slack.ts',
      description: 'Internal Slack payload type definitions.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/core/limits.ts',
      description: 'Slack-compatible limit constants.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/core/validation.ts',
      description: 'Validation implementation.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/core/errors.ts',
      description: 'MessageValidationError shape and error formatting.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/core/fallback.ts',
      description: 'Fallback text behavior for payloads.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/utils/text.ts',
      description: 'Text truncation and compact formatting helpers.',
      required: false,
    },
    {
      kind: 'path',
      path: 'tests/validation.test.ts',
      description: 'Validation test style and existing boundary coverage.',
      required: false,
    },
  ],

  keywordContexts: [
    {
      keywords: ['fallback', 'notification', 'accessibility', 'top-level text'],
      description: 'Fallback text generation and message text validation.',
      context: [
        {
          kind: 'path',
          path: 'src/core/fallback.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/core/builder.ts',
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
      keywords: ['error', 'MessageValidationError', 'invalid', 'throw'],
      description: 'Validation error handling conventions.',
      context: [
        {
          kind: 'path',
          path: 'src/core/errors.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/core/validation.ts',
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
