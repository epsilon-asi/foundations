export default {
  id: 'cli-command',
  description: 'Modify CLI behavior, environment variable parsing, command inputs, actor registration, and CLI documentation.',
  instructions: `
Modify the CLI entrypoint in src/cli/run.ts.

Rules:
- Keep CLI config construction aligned with RuntimeConfig types.
- Preserve JSON input parsing behavior unless explicitly changing it.
- Keep environment variable names documented in README.
- Validate ambiguous or conflicting env vars and fail with clear ConfigError messages.
- When adding actor registration behavior, update ActorRegistry usage and site exports if needed.
- If CLI can affect browser lifecycle, verify close/disconnect behavior matches BrowserSession and RuntimeConfig defaults.
- Add tests if the change can be unit-tested without spawning Chrome.

DO NOT hard-code machine-specific Chrome paths, credentials, or profile directories.
DO NOT default remote debugging to a non-localhost address.
`.trim(),
  output: {
    pathTemplates: [
      {
        key: 'cli',
        pathTemplate: 'src/cli/run.ts',
        description: 'CLI entrypoint and env/input parsing.'
      },
      {
        key: 'runtime-config',
        pathTemplate: 'src/browser/RuntimeConfig.ts',
        description: 'Runtime config types if CLI config surface changes.'
      },
      {
        key: 'actor-registry',
        pathTemplate: 'src/core/ActorRegistry.ts',
        description: 'Registry behavior if actor lookup changes.'
      },
      {
        key: 'docs',
        pathTemplate: 'README.md',
        description: 'CLI usage and env var documentation.'
      },
      {
        key: 'tests',
        pathTemplate: 'tests/unit/cli/{{featureKebab}}.test.ts',
        description: 'CLI unit tests for parser/config helpers when added.'
      }
    ],
    maxFiles: 5
  },
  parameters: {
    feature: {
      description: 'CLI feature to implement, for example env var, input parsing, registry loading, or run mode.',
      required: true
    },
    instructions: {
      description: 'Detailed CLI behavior, examples, env vars, and failure cases.',
      required: false
    }
  },
  examples: [
    'src/cli/run.ts',
    'src/browser/RuntimeConfig.ts',
    'src/core/ActorRegistry.ts',
    'README.md'
  ],
  context: [
    { kind: 'path', path: 'src/cli/run.ts', description: 'Current CLI implementation.' },
    { kind: 'path', path: 'src/browser/RuntimeConfig.ts', description: 'Runtime config consumed by CLI.' },
    { kind: 'path', path: 'src/core/ActorRegistry.ts', description: 'Actor registration and lookup.' },
    { kind: 'path', path: 'src/core/ActorRunner.ts', description: 'Runner invoked by CLI.' },
    { kind: 'path', path: 'src/sites/example/example.actor.ts', description: 'Example actor currently registered by CLI.' },
    { kind: 'path', path: 'src/sites/index.ts', description: 'Site exports available to CLI.' },
    { kind: 'path', path: 'src/errors/ConfigError.ts', description: 'Config error class for CLI validation failures.' },
    { kind: 'path', path: 'README.md', description: 'Documentation that should match CLI behavior.' }
  ],
  keywordContexts: [
    {
      keywords: ['browser', 'chrome', 'profile', 'remote debugging', 'debug endpoint'],
      context: [
        { kind: 'path', path: 'src/browser/BrowserFactory.ts', description: 'Browser launch/connect behavior that CLI config drives.' },
        { kind: 'path', path: 'tests/unit/browser/BrowserFactory.test.ts', description: 'Runtime config behavior tests.' }
      ]
    },
    {
      keywords: ['site', 'actor', 'registry'],
      context: [
        { kind: 'path', path: 'src/core/Actor.ts', description: 'Actor contracts.' },
        { kind: 'pattern', pattern: 'src/sites/**/*.actor.ts', description: 'Existing site actor modules.', limit: 5 }
      ]
    }
  ],
  tooling: {
    allowGetExistingCode: true,
    allowFindFiles: true,
    allowSearchRepo: true
  }
};
