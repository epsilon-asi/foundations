export default {
  id: 'prebuilt-component',
  description:
    'Generate or update a reusable prebuilt Slack message component in src/prebuilt using the existing component framework, compact layout style, tests, exports, examples, and docs.',

  instructions: `
Generate or update a prebuilt Slack message component for this library.

Repository-specific rules:
- Inspect src/prebuilt/shared.ts, src/prebuilt/status.ts, and at least two existing prebuilt components before writing.
- Use defineComponent from src/core/component.ts unless the existing code pattern clearly calls for a thin wrapper.
- Keep the call-site surface small and domain-friendly; callers should not need to hand-write Slack Block Kit JSON.
- Prefer compact Slack layouts: header, one or two section blocks, fields, context, optional image, optional actions.
- Reuse existing helpers for severity, fields, actions, formatting, truncation, block IDs, and text handling.
- Always provide useful fallbackText for notifications and accessibility.
- Keep output under Slack message limits and rely on existing validation/truncation helpers where possible.
- Add or update tests for default behavior, optional branches, edge branches, validation interactions, and export availability.
- Update src/prebuilt/index.ts and src/index.ts only when the existing public export convention requires it.
- Update README.md, docs/COMPONENTS.md, or examples only when the new component is user-facing.

General safety rules:
- Follow existing repo patterns.
- Use existing imports, naming, function style, and test style.
- Do not invent Slack APIs, block properties, config keys, or component conventions.
- Do not add dependencies unless explicitly requested.
- Do not include secrets or environment-specific values.
- Do not touch unrelated files.
- Run or describe the relevant typecheck/test command after changes.

Additional user instructions:
{{instructions}}
`.trim(),

  output: {
    pathTemplates: [
      {
        key: 'component',
        pathTemplate: 'src/prebuilt/{{nameCamel}}.ts',
        description: 'Prebuilt component implementation. Use camelCase filenames to match existing src/prebuilt files.',
      },
      {
        key: 'prebuilt-index',
        pathTemplate: 'src/prebuilt/index.ts',
        description: 'Prebuilt component export barrel; update only when the component is part of the public prebuilt API.',
      },
      {
        key: 'root-index',
        pathTemplate: 'src/index.ts',
        description: 'Root public exports; update only if the repo convention requires a new root export.',
      },
      {
        key: 'test',
        pathTemplate: 'tests/{{nameKebab}}.test.ts',
        description: 'Focused Vitest coverage for the new component. If an existing test file is more appropriate, modify that instead.',
      },
      {
        key: 'docs',
        pathTemplate: 'docs/COMPONENTS.md',
        description: 'Component catalog documentation; update only for user-facing prebuilt components.',
      },
    ],
    maxFiles: 6,
  },

  parameters: {
    name: {
      description: 'Component name, for example RunbookCard, UserSnapshot, ReportDigest, or SloBreach.',
      required: true,
    },
    instructions: {
      description: 'Component purpose, required options, optional fields, actions, severity behavior, and layout constraints.',
      required: false,
    },
  },

  examples: [
    'src/prebuilt/card.ts',
    'src/prebuilt/alertCard.ts',
    'src/prebuilt/chartImage.ts',
    'src/prebuilt/metricGrid.ts',
    'src/prebuilt/compactTable.ts',
    'tests/components-builder.test.ts',
    'docs/COMPONENTS.md',
  ],

  context: [
    {
      kind: 'path',
      path: 'src/core/component.ts',
      description: 'defineComponent API, component shape, and render normalization.',
      required: false,
    },
    {
      kind: 'pattern',
      pattern: 'src/prebuilt/*.ts',
      description: 'Existing prebuilt component implementations and shared helpers.',
      limit: 10,
    },
    {
      kind: 'path',
      path: 'src/prebuilt/index.ts',
      description: 'Prebuilt export barrel.',
      required: false,
    },
    {
      kind: 'pattern',
      pattern: 'src/blocks/**/*.ts',
      description: 'Low-level block helpers used inside prebuilt components.',
      limit: 6,
    },
    {
      kind: 'pattern',
      pattern: 'tests/**/*.test.ts',
      description: 'Vitest test style and coverage expectations.',
      limit: 8,
    },
    {
      kind: 'path',
      path: 'docs/ARCHITECTURE.md',
      description: 'Component layer design principles and preferred prebuilt component shape.',
      required: false,
    },
    {
      kind: 'path',
      path: 'docs/COMPONENTS.md',
      description: 'Existing component documentation style.',
      required: false,
    },
  ],

  keywordContexts: [
    {
      keywords: ['severity', 'status', 'success', 'warning', 'danger', 'info', 'neutral'],
      description: 'Severity and status display helpers.',
      context: [
        {
          kind: 'path',
          path: 'src/prebuilt/status.ts',
          description: 'Severity/status emoji and labels.',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/prebuilt/shared.ts',
          description: 'Shared field/action rendering helpers.',
          required: false,
        },
      ],
    },
    {
      keywords: ['image', 'screenshot', 'chart', 'visual', 'alt text'],
      description: 'Image and chart component patterns.',
      context: [
        {
          kind: 'path',
          path: 'src/prebuilt/imageAlert.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/prebuilt/chartImage.ts',
          required: false,
        },
        {
          kind: 'pattern',
          pattern: 'src/blocks/**/*.ts',
          limit: 5,
        },
      ],
    },
    {
      keywords: ['action', 'button', 'approve', 'reject', 'interactive', 'action id'],
      description: 'Action button and interactive callback conventions.',
      context: [
        {
          kind: 'path',
          path: 'src/prebuilt/approvalRequest.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/prebuilt/shared.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/blocks/primitives.ts',
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
