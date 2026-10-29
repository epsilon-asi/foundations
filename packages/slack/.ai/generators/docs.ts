export default {
  id: 'docs',
  description:
    'Generate or update README and docs pages for this Slack message-kit library while keeping examples, imports, commands, and architecture notes accurate.',

  instructions: `
Generate or update documentation for this library.

Repository-specific rules:
- Inspect current code before documenting behavior.
- Keep package name, import paths, scripts, examples, Slack compatibility notes, and public exports accurate.
- Do not document features, components, transports, entrypoints, or APIs that do not exist.
- Keep code examples compact and realistic, usually showing the MessageBuilder, prebuilt components, defineComponent, or SlackMessenger.
- Keep examples synchronized with current code and examples/*.ts.
- Do not include secrets, real Slack tokens, real webhook URLs, real channel IDs, or customer data.
- If documenting commands, verify them against package.json scripts.
- Update docs/ARCHITECTURE.md for architecture-level guidance and docs/COMPONENTS.md for component catalog changes.

General safety rules:
- Follow existing repo patterns.
- Use existing imports, naming, function style, and documentation terminology.
- Do not invent APIs, properties, imports, or conventions.
- Keep outputs minimal and focused.
- Do not touch unrelated files.
- Run or describe the relevant typecheck/docs validation command after changes.

Additional user instructions:
{{instructions}}
`.trim(),

  output: {
    pathTemplates: [
      {
        key: 'readme',
        pathTemplate: 'README.md',
        description: 'Main public package README.',
      },
      {
        key: 'architecture',
        pathTemplate: 'docs/ARCHITECTURE.md',
        description: 'Architecture and extension guide.',
      },
      {
        key: 'components',
        pathTemplate: 'docs/COMPONENTS.md',
        description: 'Prebuilt component catalog and authoring guide.',
      },
      {
        key: 'publishing',
        pathTemplate: 'docs/PUBLISHING.md',
        description: 'Private package publishing guidance.',
      },
      {
        key: 'testing',
        pathTemplate: 'docs/TESTING.md',
        description: 'Testing and coverage guidance.',
      },
      {
        key: 'topic-doc',
        pathTemplate: 'docs/{{nameKebab}}.md',
        description: 'Optional topic-specific documentation page.',
      },
    ],
    maxFiles: 6,
  },

  parameters: {
    name: {
      description: 'Documentation topic, for example getting-started, components, transports, testing, or publishing.',
      required: false,
      default: 'getting-started',
    },
    instructions: {
      description: 'Documentation scope, audience, sections, or examples to include.',
      required: false,
    },
  },

  examples: [
    'README.md',
    'docs/ARCHITECTURE.md',
    'docs/COMPONENTS.md',
    'docs/PUBLISHING.md',
    'docs/TESTING.md',
    'examples/02-composed-dashboard.ts',
    'examples/03-custom-component.ts',
  ],

  context: [
    {
      kind: 'path',
      path: 'README.md',
      description: 'Current README and public usage guide.',
      required: false,
    },
    {
      kind: 'pattern',
      pattern: 'docs/**/*.md',
      description: 'Existing documentation pages and style.',
      limit: 8,
    },
    {
      kind: 'pattern',
      pattern: 'examples/**/*.ts',
      description: 'Examples to keep documentation snippets aligned with code.',
      limit: 8,
    },
    {
      kind: 'path',
      path: 'package.json',
      description: 'Package scripts, dependencies, exports, and publishing metadata.',
      required: false,
    },
    {
      kind: 'pattern',
      pattern: 'src/**/*.ts',
      description: 'Representative source files for accurate API documentation.',
      limit: 10,
    },
  ],

  keywordContexts: [
    {
      keywords: ['component', 'prebuilt', 'card', 'alert', 'metric', 'table', 'digest'],
      description: 'Prebuilt component documentation context.',
      context: [
        {
          kind: 'pattern',
          pattern: 'src/prebuilt/**/*.ts',
          limit: 10,
        },
        {
          kind: 'path',
          path: 'docs/COMPONENTS.md',
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
      keywords: ['send', 'transport', 'web api', 'webhook', 'slackmessenger'],
      description: 'Transport and sending documentation context.',
      context: [
        {
          kind: 'path',
          path: 'src/core/transport.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'examples/05-send-with-web-api.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'tests/transport.test.ts',
          required: false,
        },
      ],
    },
    {
      keywords: ['build', 'publish', 'private package', 'npm', 'exports', 'esm', 'cjs'],
      description: 'Build, package exports, and private publishing documentation context.',
      context: [
        {
          kind: 'path',
          path: 'package.json',
          required: false,
        },
        {
          kind: 'path',
          path: 'docs/PUBLISHING.md',
          required: false,
        },
        {
          kind: 'path',
          path: 'tsconfig.json',
          required: false,
        },
      ],
    },
    {
      keywords: ['test', 'testing', 'coverage', 'vitest', 'verify'],
      description: 'Testing command and coverage documentation context.',
      context: [
        {
          kind: 'path',
          path: 'docs/TESTING.md',
          required: false,
        },
        {
          kind: 'path',
          path: 'vitest.config.ts',
          required: false,
        },
        {
          kind: 'pattern',
          pattern: 'tests/**/*.test.ts',
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
