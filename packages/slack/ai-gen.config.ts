export default {
  repoRoot: './',
  generationsDir: './.ai/generators',
  model: 'gpt-5.3-codex',
  maxToolRounds: 100,
  defaultMaxOutputFiles: 10,
  maxContextFileSizeBytes: 60_000,

  ignore: [
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env-secrets',
    '.env.secrets',
    '.env-secret',
    '.env.secret',
    '.npmrc',
    '.netrc',

    '.git',
    'node_modules',
    'dist',
    'build',
    '.next',
    '.turbo',
    '.cache',
    'coverage',

    '.idea',
    '.vscode',
    '.ai/runs',
    '.ai/tmp',
    '.ai/workflows/output',

    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '*.tgz',

    '*.generated.ts',
    '*.generated.tsx',
    '*.gen.ts',
    '*.gen.tsx',
    '*.js.map',
    '*.cjs.map',
  ],

  offLimits: [
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env-secrets',
    '.env.secrets',
    '.env-secret',
    '.env.secret',
    '.npmrc',
    '.netrc',

    '.git',
    'node_modules',
    'dist',
    'build',
    '.next',
    '.turbo',
    '.cache',
    'coverage',

    '*.tgz',
    '*.generated.ts',
    '*.generated.tsx',
    '*.gen.ts',
    '*.gen.tsx',
    '*.js.map',
    '*.cjs.map',
  ],

  defaultContext: [
    {
      kind: 'path',
      path: 'package.json',
      description: 'Package metadata, npm scripts, exports map, dependency policy, and private publishing settings.',
      required: false,
    },
    {
      kind: 'path',
      path: 'README.md',
      description: 'Primary package usage guide, Slack compatibility notes, examples, and public API overview.',
      required: false,
    },
    {
      kind: 'path',
      path: 'docs/ARCHITECTURE.md',
      description: 'Repository architecture: block primitives, component framework, prebuilt components, builder, and transports.',
      required: false,
    },
    {
      kind: 'path',
      path: 'docs/COMPONENTS.md',
      description: 'Prebuilt component catalog and component authoring rules.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/index.ts',
      description: 'Root public export surface for the package.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/core/component.ts',
      description: 'Component framework source of truth: defineComponent, render normalization, and component resolution.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/core/builder.ts',
      description: 'MessageBuilder composition API and prebuilt convenience method conventions.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/types/slack.ts',
      description: 'Internal Slack Block Kit and message payload type definitions.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/core/limits.ts',
      description: 'Slack-related length and block limit constants used by validation and truncation helpers.',
      required: false,
    },
    {
      kind: 'path',
      path: 'vitest.config.ts',
      description: 'Vitest and coverage threshold configuration.',
      required: false,
    },
    {
      kind: 'path',
      path: 'tsconfig.json',
      description: 'TypeScript compiler configuration for library source.',
      required: false,
    },
    {
      kind: 'path',
      path: 'tsconfig.test.json',
      description: 'TypeScript configuration for tests and examples.',
      required: false,
    },
  ],

  defaultKeywordContexts: [
    {
      keywords: ['prebuilt component', 'prebuilt', 'card', 'alert card', 'image alert', 'chart image', 'metric grid', 'compact table', 'digest', 'deployment notice', 'incident update', 'approval request'],
      description: 'High-level reusable Slack message component patterns and tests.',
      context: [
        {
          kind: 'pattern',
          pattern: 'src/prebuilt/**/*.ts',
          description: 'Existing prebuilt component implementations and shared helpers.',
          limit: 10,
        },
        {
          kind: 'path',
          path: 'src/core/component.ts',
          description: 'Component authoring API used by prebuilt renderers.',
          required: false,
        },
        {
          kind: 'pattern',
          pattern: 'tests/**/*components*.test.ts',
          description: 'Tests covering prebuilt components and MessageBuilder composition.',
          limit: 4,
        },
        {
          kind: 'path',
          path: 'docs/COMPONENTS.md',
          description: 'Documented component catalog and authoring rules.',
          required: false,
        },
      ],
    },
    {
      keywords: ['block kit', 'slack block', 'blocks', 'section block', 'header block', 'context block', 'image block', 'actions block', 'button', 'mrkdwn', 'plain text'],
      description: 'Low-level Slack Block Kit primitive helpers and related tests.',
      context: [
        {
          kind: 'pattern',
          pattern: 'src/blocks/**/*.ts',
          description: 'Primitive Block Kit helper implementations and exports.',
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
          path: 'tests/blocks.test.ts',
          description: 'Block helper test conventions.',
          required: false,
        },
      ],
    },
    {
      keywords: ['builder', 'message builder', 'compose', 'createMessage', 'fallback text', 'metadata', 'unfurl', 'parse'],
      description: 'MessageBuilder composition behavior, payload building, and fallback text conventions.',
      context: [
        {
          kind: 'path',
          path: 'src/core/builder.ts',
          description: 'Builder API and build options.',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/core/fallback.ts',
          description: 'Fallback text generation for notifications and accessibility.',
          required: false,
        },
        {
          kind: 'path',
          path: 'tests/components-builder.test.ts',
          description: 'Builder and component composition tests.',
          required: false,
        },
      ],
    },
    {
      keywords: ['transport', 'messenger', 'send', 'web api', 'webhook', 'incoming webhook', 'chat.postMessage', 'thread', 'reply broadcast'],
      description: 'Slack delivery adapters, send normalization, and transport tests.',
      context: [
        {
          kind: 'path',
          path: 'src/core/transport.ts',
          description: 'SlackMessenger, Web API transport, and incoming webhook transport.',
          required: false,
        },
        {
          kind: 'path',
          path: 'tests/transport.test.ts',
          description: 'Transport tests and mocked send patterns.',
          required: false,
        },
        {
          kind: 'path',
          path: 'examples/05-send-with-web-api.ts',
          description: 'Example of sending with @slack/web-api.',
          required: false,
        },
      ],
    },
    {
      keywords: ['validation', 'validate', 'limit', 'limits', 'truncate', '50 blocks', 'alt text', 'header length', 'section length', 'fields'],
      description: 'Slack limit constants, validation logic, truncation helpers, and limit-focused tests.',
      context: [
        {
          kind: 'path',
          path: 'src/core/limits.ts',
          description: 'Slack limit constants.',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/core/validation.ts',
          description: 'Message validation rules and errors.',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/utils/text.ts',
          description: 'Text truncation and formatting helpers.',
          required: false,
        },
        {
          kind: 'path',
          path: 'tests/validation.test.ts',
          description: 'Validation and Slack limit test cases.',
          required: false,
        },
      ],
    },
    {
      keywords: ['type', 'types', 'slack payload', 'payload', 'metadata', 'accessory', 'element', 'action id', 'block id'],
      description: 'Slack payload, block, element, and metadata type definitions.',
      context: [
        {
          kind: 'path',
          path: 'src/types/slack.ts',
          description: 'Slack type definitions.',
          required: false,
        },
        {
          kind: 'pattern',
          pattern: 'src/blocks/**/*.ts',
          description: 'Typed block helper usage examples.',
          limit: 6,
        },
        {
          kind: 'pattern',
          pattern: 'src/prebuilt/**/*.ts',
          description: 'Typed prebuilt component usage examples.',
          limit: 6,
        },
      ],
    },
    {
      keywords: ['test', 'tests', 'unit test', 'vitest', 'coverage', 'fixture', 'mock'],
      description: 'Vitest tests, coverage thresholds, mocks, and deterministic unit test patterns.',
      context: [
        {
          kind: 'pattern',
          pattern: 'tests/**/*.test.ts',
          description: 'Existing Vitest test files.',
          limit: 10,
        },
        {
          kind: 'path',
          path: 'vitest.config.ts',
          description: 'Coverage provider and minimum thresholds.',
          required: false,
        },
        {
          kind: 'path',
          path: 'package.json',
          description: 'Test, coverage, typecheck, build, and verify scripts.',
          required: false,
        },
      ],
    },
    {
      keywords: ['example', 'examples', 'usage', 'custom component', 'end-user component', 'documentation', 'docs', 'readme'],
      description: 'Usage examples, custom component examples, and documentation conventions.',
      context: [
        {
          kind: 'pattern',
          pattern: 'examples/**/*.ts',
          description: 'Executable usage examples.',
          limit: 8,
        },
        {
          kind: 'pattern',
          pattern: 'docs/**/*.md',
          description: 'Developer documentation style.',
          limit: 8,
        },
        {
          kind: 'path',
          path: 'README.md',
          description: 'Public package README.',
          required: false,
        },
      ],
    },
    {
      keywords: ['export', 'exports', 'barrel', 'entrypoint', 'package export', 'public api', 'esm', 'cjs', 'types'],
      description: 'Public API export surface, package export map, and generated output expectations.',
      context: [
        {
          kind: 'path',
          path: 'src/index.ts',
          description: 'Root public export barrel.',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/prebuilt/index.ts',
          description: 'Prebuilt component export barrel.',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/blocks/index.ts',
          description: 'Block helper export barrel.',
          required: false,
        },
        {
          kind: 'path',
          path: 'package.json',
          description: 'Package exports map and build entrypoints.',
          required: false,
        },
      ],
    },
  ],

  openai: {
    timeoutMs: 120_000,
    temperature: 0,
  },

  logging: {
    level: 'error',
    pretty: true,
  },
};
