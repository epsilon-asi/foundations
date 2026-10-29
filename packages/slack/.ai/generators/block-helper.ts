export default {
  id: 'block-helper',
  description:
    'Generate or update low-level Slack Block Kit helper functions in src/blocks while preserving typed Slack payloads, truncation, validation, and tests.',

  instructions: `
Generate or update a low-level Block Kit helper.

Repository-specific rules:
- Inspect src/blocks/primitives.ts, src/blocks/text.ts, src/blocks/index.ts, and tests/blocks.test.ts before writing.
- Keep helpers thin, predictable, and close to Slack Block Kit JSON.
- Do not put domain-specific wording or business concepts in block primitives; use prebuilt components for that.
- Use existing Slack types from src/types/slack.ts.
- Use existing truncation helpers and limit constants for header, section, context, image alt text, and button text limits.
- Preserve compact behavior such as fieldSections and action helpers when extending similar functionality.
- Update src/blocks/index.ts only if the helper is public.
- Add tests for exact block shape, truncation behavior, optional arguments, and export availability.

General safety rules:
- Follow existing repo patterns.
- Use existing imports, naming, function style, and test style.
- Do not invent Slack block properties, element types, or API conventions.
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
        key: 'primitive',
        pathTemplate: 'src/blocks/primitives.ts',
        description: 'Primary Block Kit helper implementations. Add here when extending existing primitives.',
      },
      {
        key: 'text-helper',
        pathTemplate: 'src/blocks/text.ts',
        description: 'Text object helper changes if the requested helper needs mrkdwn/plain_text utilities.',
      },
      {
        key: 'blocks-index',
        pathTemplate: 'src/blocks/index.ts',
        description: 'Public block helper exports; update only for public helpers.',
      },
      {
        key: 'types',
        pathTemplate: 'src/types/slack.ts',
        description: 'Slack block/element type definitions; update only if the helper requires a new typed shape.',
      },
      {
        key: 'test',
        pathTemplate: 'tests/blocks.test.ts',
        description: 'Block helper tests.',
      },
    ],
    maxFiles: 5,
  },

  parameters: {
    name: {
      description: 'Helper name, for example overflowMenu, confirmationDialog, richContext, or datePicker.',
      required: true,
    },
    instructions: {
      description: 'Slack block/element shape, arguments, truncation needs, and public API expectations.',
      required: false,
    },
  },

  examples: [
    'src/blocks/primitives.ts',
    'src/blocks/text.ts',
    'src/blocks/index.ts',
    'tests/blocks.test.ts',
  ],

  context: [
    {
      kind: 'pattern',
      pattern: 'src/blocks/**/*.ts',
      description: 'Existing block and text helper conventions.',
      limit: 8,
    },
    {
      kind: 'path',
      path: 'src/types/slack.ts',
      description: 'Slack block and element type definitions.',
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
      path: 'src/utils/text.ts',
      description: 'Truncation and formatting utilities.',
      required: false,
    },
    {
      kind: 'path',
      path: 'tests/blocks.test.ts',
      description: 'Block helper test style.',
      required: false,
    },
  ],

  keywordContexts: [
    {
      keywords: ['type', 'types', 'payload', 'element', 'accessory', 'option', 'confirm'],
      description: 'Slack type definitions for block/element helpers.',
      context: [
        {
          kind: 'path',
          path: 'src/types/slack.ts',
          required: false,
        },
      ],
    },
    {
      keywords: ['limit', 'truncate', 'max length', 'header', 'section', 'button text', 'alt text'],
      description: 'Slack length limits and truncation helpers.',
      context: [
        {
          kind: 'path',
          path: 'src/core/limits.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/utils/text.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/core/validation.ts',
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
