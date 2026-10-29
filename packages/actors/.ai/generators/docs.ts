export default {
  id: 'docs',
  description: 'Update README and usage documentation for framework features, site actors, CLI examples, browser setup, and auth/login examples.',
  instructions: `
Update documentation to match the actual code.

Rules:
- Keep examples consistent with RuntimeConfig, ActorRunner, LoginFlowDefinition, and CLI behavior.
- Use the example actor only as a pattern; do not imply it scrapes a real site unless it does.
- Include concrete command examples when documenting CLI behavior.
- Include safe Chrome remote debugging examples bound to 127.0.0.1 when documenting running Chrome attach.
- Document environment variables only if src/cli/run.ts supports them.
- Avoid overstating test coverage or behavior not implemented in code.
- Keep docs practical and concise.

DO NOT include real credentials, cookies, tokens, or private local paths.
DO NOT document CAPTCHA bypass or anti-bot circumvention.
`.trim(),
  output: {
    pathTemplates: [
      {
        key: 'readme',
        pathTemplate: 'README.md',
        description: 'Primary project documentation.'
      },
      {
        key: 'example-actor',
        pathTemplate: 'src/sites/example/example.actor.ts',
        description: 'Update only if documentation examples require the example actor to change.'
      },
      {
        key: 'cli',
        pathTemplate: 'src/cli/run.ts',
        description: 'Update only if docs expose CLI behavior that code does not yet support.'
      }
    ],
    maxFiles: 3
  },
  parameters: {
    topic: {
      description: 'Documentation topic, for example multi-step login, running Chrome attach, human typing, creating site actors, or CLI usage.',
      required: true
    },
    instructions: {
      description: 'Specific docs to add, change, or clarify.',
      required: false
    }
  },
  examples: [
    'README.md',
    'src/sites/example/example.actor.ts',
    'src/cli/run.ts'
  ],
  context: [
    { kind: 'path', path: 'README.md', description: 'Existing documentation.' },
    { kind: 'path', path: 'package.json', description: 'Scripts, package name, binary name, and dependencies.' },
    { kind: 'path', path: 'src/browser/RuntimeConfig.ts', description: 'Runtime config docs must match these types.' },
    { kind: 'path', path: 'src/browser/BrowserFactory.ts', description: 'Launch/connect behavior docs must match this implementation.' },
    { kind: 'path', path: 'src/auth/LoginFlow.types.ts', description: 'Login examples must match these types.' },
    { kind: 'path', path: 'src/interaction/HumanTyping.ts', description: 'Typing docs must match these options/defaults.' },
    { kind: 'path', path: 'src/core/ActorRunner.ts', description: 'Runner examples must match constructor/run behavior.' },
    { kind: 'path', path: 'src/cli/run.ts', description: 'CLI examples must match env parsing and command behavior.' },
    { kind: 'path', path: 'src/sites/example/example.actor.ts', description: 'Example actor implementation.' }
  ],
  keywordContexts: [
    {
      keywords: ['login', 'multi-step', 'auth', 'credentials'],
      context: [
        { kind: 'path', path: 'src/auth/LoginFlow.ts', description: 'Login execution details.' },
        { kind: 'path', path: 'tests/unit/auth/LoginFlow.test.ts', description: 'Behavior examples from tests.' }
      ]
    },
    {
      keywords: ['browser', 'chrome', 'debug endpoint', 'remote debugging', 'profile'],
      context: [
        { kind: 'path', path: 'tests/unit/browser/BrowserFactory.test.ts', description: 'Browser behavior examples from tests.' }
      ]
    },
    {
      keywords: ['site', 'actor', 'task', 'scrape'],
      context: [
        { kind: 'path', path: 'src/core/Actor.ts', description: 'Actor/task contracts.' },
        { kind: 'path', path: 'src/extraction/Extractor.ts', description: 'Extraction helpers available to actor tasks.' }
      ]
    }
  ],
  tooling: {
    allowGetExistingCode: true,
    allowFindFiles: true,
    allowSearchRepo: true
  }
};
