export default {
  id: 'core-module',
  description:
    'Generate or update core framework utilities for component rendering, payload composition, validation, fallback handling, or reusable library internals.',

  instructions: `
Generate or update a core framework module for this Slack message library.

Repository-specific rules:
- Inspect the relevant files in src/core before writing.
- Keep core modules framework-level and domain-neutral; business-specific Slack layouts belong in src/prebuilt.
- Preserve pure rendering: component renderers should not send network requests or read environment variables.
- Preserve the ComponentLike, RenderedComponent, MessageBuilder, SlackMessagePayload, and SlackMessenger contracts unless explicitly requested.
- Prefer small pure functions with explicit TypeScript types.
- Add unit tests covering behavior and branch cases.
- Update src/index.ts only when the new module is public API.
- Update docs/ARCHITECTURE.md when architecture-level conventions change.

General safety rules:
- Follow existing repo patterns.
- Use existing imports, naming, function style, and test style.
- Do not invent APIs, properties, config keys, or conventions.
- Update tests when behavior changes.
- Keep outputs minimal and focused.
- Do not touch unrelated files.
- Do not include secrets.
- Run or describe the relevant typecheck/test command after changes.

Additional user instructions:
{{instructions}}
`.trim(),

  output: {
    pathTemplates: [
      {
        key: 'core-module',
        pathTemplate: 'src/core/{{nameCamel}}.ts',
        description: 'Core module implementation. Use camelCase filenames to match existing core files.',
      },
      {
        key: 'root-index',
        pathTemplate: 'src/index.ts',
        description: 'Root public export barrel; update only if the new module is public API.',
      },
      {
        key: 'test',
        pathTemplate: 'tests/{{nameKebab}}.test.ts',
        description: 'Focused Vitest unit tests for the core module.',
      },
      {
        key: 'architecture-docs',
        pathTemplate: 'docs/ARCHITECTURE.md',
        description: 'Architecture docs; update only for framework-level changes.',
      },
    ],
    maxFiles: 5,
  },

  parameters: {
    name: {
      description: 'Core concern name, for example fallback, scheduler, registry, renderer, or chunking.',
      required: true,
    },
    instructions: {
      description: 'Desired behavior, public/private API expectations, and integration points.',
      required: false,
    },
  },

  examples: [
    'src/core/component.ts',
    'src/core/builder.ts',
    'src/core/fallback.ts',
    'src/core/validation.ts',
    'tests/components-builder.test.ts',
    'tests/validation.test.ts',
  ],

  context: [
    {
      kind: 'pattern',
      pattern: 'src/core/**/*.ts',
      description: 'Existing core framework modules.',
      limit: 10,
    },
    {
      kind: 'path',
      path: 'src/types/slack.ts',
      description: 'Slack payload and block types used by core modules.',
      required: false,
    },
    {
      kind: 'pattern',
      pattern: 'src/utils/**/*.ts',
      description: 'Shared utility helpers.',
      limit: 5,
    },
    {
      kind: 'pattern',
      pattern: 'tests/**/*.test.ts',
      description: 'Existing unit test patterns.',
      limit: 8,
    },
    {
      kind: 'path',
      path: 'docs/ARCHITECTURE.md',
      description: 'Architecture principles for core framework changes.',
      required: false,
    },
  ],

  keywordContexts: [
    {
      keywords: ['component', 'defineComponent', 'render', 'RenderedComponent', 'ComponentLike'],
      description: 'Component framework internals.',
      context: [
        {
          kind: 'path',
          path: 'src/core/component.ts',
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
      keywords: ['builder', 'compose', 'payload', 'createMessage'],
      description: 'MessageBuilder integration context.',
      context: [
        {
          kind: 'path',
          path: 'src/core/builder.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/core/fallback.ts',
          required: false,
        },
      ],
    },
    {
      keywords: ['validation', 'limits', 'error', 'fallback'],
      description: 'Validation, limits, errors, and fallback behavior.',
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
          path: 'src/core/errors.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/core/fallback.ts',
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
