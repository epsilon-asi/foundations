export default {
  id: 'unit-test',
  description:
    'Generate or update focused Vitest unit tests for library source, preserving existing coverage thresholds, mocks, and deterministic test style.',

  instructions: `
Generate or update unit tests for the requested source behavior.

Repository-specific rules:
- Inspect existing tests before writing, especially the test file closest to the requested target.
- Match Vitest imports, describe/it style, assertion style, and fake/mock style used in this repository.
- Test public behavior and Slack payload shape rather than private implementation details unless existing tests do otherwise.
- Cover default behavior, optional branches, validation failures, truncation boundaries, fallback text, and export behavior where relevant.
- Do not make real Slack API calls or external network calls.
- Do not require real Slack tokens, webhook URLs, or environment secrets.
- Keep tests deterministic; use fake clients/fetch implementations for transports.
- If production code needs minor testability changes, keep them minimal and explain them.
- Maintain the repository's 80% minimum coverage thresholds for statements, branches, lines, and functions.

General safety rules:
- Follow existing repo patterns.
- Use existing imports, naming, function style, and test style.
- Do not invent APIs, properties, imports, or conventions.
- Update tests when behavior changes.
- Keep outputs minimal and focused.
- Do not touch unrelated files.
- Run or describe the relevant typecheck/test command after changes.

Additional user instructions:
{{instructions}}
`.trim(),

  output: {
    pathTemplate: 'tests/{{targetPath}}.test.ts',
    maxFiles: 4,
  },

  parameters: {
    targetPath: {
      description:
        'Relative test path/name without .test.ts, for example blocks, components-builder, transport, validation, or prebuilt/runbook-card.',
      required: true,
    },
    instructions: {
      description: 'Source file, behavior, edge cases, or coverage gaps to test.',
      required: false,
    },
  },

  examples: [
    'tests/blocks.test.ts',
    'tests/components-builder.test.ts',
    'tests/transport.test.ts',
    'tests/validation.test.ts',
    'vitest.config.ts',
  ],

  context: [
    {
      kind: 'pattern',
      pattern: 'tests/**/*.test.ts',
      description: 'Existing Vitest unit test style.',
      limit: 10,
    },
    {
      kind: 'path',
      path: 'vitest.config.ts',
      description: 'Coverage provider, included files, and thresholds.',
      required: false,
    },
    {
      kind: 'path',
      path: 'package.json',
      description: 'Test, coverage, typecheck, and verify scripts.',
      required: false,
    },
    {
      kind: 'pattern',
      pattern: 'src/**/*.ts',
      description: 'Representative source files to test. Prefer using search to select the target source file.',
      limit: 8,
    },
  ],

  keywordContexts: [
    {
      keywords: ['component', 'prebuilt', 'builder', 'compose', 'fallback'],
      description: 'Component framework, prebuilt component, and builder tests.',
      context: [
        {
          kind: 'path',
          path: 'tests/components-builder.test.ts',
          required: false,
        },
        {
          kind: 'pattern',
          pattern: 'src/prebuilt/**/*.ts',
          limit: 8,
        },
        {
          kind: 'path',
          path: 'src/core/builder.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/core/component.ts',
          required: false,
        },
      ],
    },
    {
      keywords: ['transport', 'webhook', 'web api', 'send', 'mock', 'fake'],
      description: 'Transport and mocked external send tests.',
      context: [
        {
          kind: 'path',
          path: 'tests/transport.test.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/core/transport.ts',
          required: false,
        },
      ],
    },
    {
      keywords: ['validation', 'limit', 'truncate', 'error', 'boundary'],
      description: 'Validation, truncation, and boundary tests.',
      context: [
        {
          kind: 'path',
          path: 'tests/validation.test.ts',
          required: false,
        },
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
          path: 'src/utils/text.ts',
          required: false,
        },
      ],
    },
    {
      keywords: ['block', 'blocks', 'primitive', 'button', 'image', 'section', 'header'],
      description: 'Low-level block helper tests.',
      context: [
        {
          kind: 'path',
          path: 'tests/blocks.test.ts',
          required: false,
        },
        {
          kind: 'pattern',
          pattern: 'src/blocks/**/*.ts',
          limit: 6,
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
