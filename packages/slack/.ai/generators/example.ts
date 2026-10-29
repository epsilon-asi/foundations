export default {
  id: 'example',
  description:
    'Generate or update runnable usage examples showing prebuilt components, custom components, builder composition, and Slack sending patterns.',

  instructions: `
Generate or update a usage example for this Slack message-kit library.

Repository-specific rules:
- Inspect existing examples before writing and follow their import paths, naming, and standalone style.
- Examples should demonstrate intended package usage with a small amount of call-site code.
- Prefer realistic Slack workflows: alerts, dashboards, incidents, approvals, deployments, image/chart alerts, custom components, and sending through transports.
- Keep examples deterministic and safe; do not send real Slack messages unless explicitly framed as code that requires user-provided credentials.
- Never include real Slack tokens, webhook URLs, channel IDs, customer data, or secrets.
- Use placeholder URLs and environment variable names only where existing examples do.
- Keep examples synchronized with current public exports and docs.
- Add or update docs if the example introduces an important public workflow.

General safety rules:
- Follow existing repo patterns.
- Use existing imports, naming, function style, and test style.
- Do not invent APIs, properties, imports, or conventions.
- Keep outputs minimal and focused.
- Do not touch unrelated files.
- Run or describe the relevant typecheck command after changes.

Additional user instructions:
{{instructions}}
`.trim(),

  output: {
    pathTemplates: [
      {
        key: 'example',
        pathTemplate: 'examples/{{exampleNumber}}-{{nameKebab}}.ts',
        description: 'Runnable TypeScript example. Use the next numeric prefix, for example 06.',
      },
      {
        key: 'readme',
        pathTemplate: 'README.md',
        description: 'README usage section; update only if the example should be part of public docs.',
      },
      {
        key: 'docs',
        pathTemplate: 'docs/{{nameKebab}}.md',
        description: 'Optional deeper usage guide if the example needs more explanation.',
      },
    ],
    maxFiles: 4,
  },

  parameters: {
    name: {
      description: 'Example name, for example custom-incident-component, webhook-send, or composed-dashboard.',
      required: true,
    },
    exampleNumber: {
      description: 'Two-digit numeric prefix matching examples directory convention, for example 06.',
      required: true,
    },
    instructions: {
      description: 'Workflow to demonstrate, API surface to use, or audience for the example.',
      required: false,
    },
  },

  examples: [
    'examples/01-prebuilt-alert.ts',
    'examples/02-composed-dashboard.ts',
    'examples/03-custom-component.ts',
    'examples/04-custom-component-composed.ts',
    'examples/05-send-with-web-api.ts',
    'README.md',
  ],

  context: [
    {
      kind: 'pattern',
      pattern: 'examples/**/*.ts',
      description: 'Existing usage examples and naming conventions.',
      limit: 8,
    },
    {
      kind: 'path',
      path: 'src/index.ts',
      description: 'Public exports available to examples.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/prebuilt/index.ts',
      description: 'Prebuilt public exports available to examples.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/blocks/index.ts',
      description: 'Block helper public exports available to examples.',
      required: false,
    },
    {
      kind: 'path',
      path: 'README.md',
      description: 'Existing example snippets and package usage documentation.',
      required: false,
    },
  ],

  keywordContexts: [
    {
      keywords: ['custom component', 'defineComponent', 'domain component', 'end-user component'],
      description: 'Custom component authoring examples and framework API.',
      context: [
        {
          kind: 'path',
          path: 'examples/03-custom-component.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'examples/04-custom-component-composed.ts',
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
      keywords: ['send', 'slack', 'web api', 'webhook', 'transport', 'channel'],
      description: 'Slack sending examples and transport context.',
      context: [
        {
          kind: 'path',
          path: 'examples/05-send-with-web-api.ts',
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
      keywords: ['dashboard', 'metrics', 'chart', 'digest', 'table'],
      description: 'Composed dashboard and dense summary examples.',
      context: [
        {
          kind: 'path',
          path: 'examples/02-composed-dashboard.ts',
          required: false,
        },
        {
          kind: 'pattern',
          pattern: 'src/prebuilt/*.ts',
          limit: 8,
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
