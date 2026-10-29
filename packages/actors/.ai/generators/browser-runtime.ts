export default {
  id: 'browser-runtime',
  description: 'Modify Chrome launch/connect/runtime configuration, existing profile handling, remote debugging attach, profile validation, or session lifecycle.',
  instructions: `
Update browser runtime behavior while preserving the existing-profile and remote-debugging modes.

Rules:
- Existing-profile mode must use userDataDir and optional --profile-directory.
- Existing-profile mode must use browser.defaultBrowserContext(), not a new isolated context.
- If a profile is already running and fallback is enabled, connect to the configured local DevTools endpoint.
- Remote-debugging mode should disconnect by default, not close the shared Chrome process.
- Keep RuntimeConfig normalized so defaults are centralized and tests are deterministic.
- Keep BrowserFactory testable through PuppeteerLike abstractions.
- Validate paths and endpoint configuration in profileValidation.ts.
- Add or update BrowserFactory tests for every launch/connect branch and error path.
- Update CLI env parsing and README examples when runtime config surface changes.

DO NOT add code that binds Chrome debugging to a public network interface by default.
DO NOT create incognito/isolated browser contexts for existing-profile mode.
`.trim(),
  output: {
    pathTemplates: [
      {
        key: 'runtime-config',
        pathTemplate: 'src/browser/RuntimeConfig.ts',
        description: 'Runtime config types, defaults, and normalization.'
      },
      {
        key: 'browser-factory',
        pathTemplate: 'src/browser/BrowserFactory.ts',
        description: 'Chrome launch/connect/session preparation logic.'
      },
      {
        key: 'browser-session',
        pathTemplate: 'src/browser/BrowserSession.ts',
        description: 'Close/disconnect behavior for launched vs connected browsers.'
      },
      {
        key: 'validation',
        pathTemplate: 'src/browser/profileValidation.ts',
        description: 'Profile directory and remote debugging endpoint validation.'
      },
      {
        key: 'cli',
        pathTemplate: 'src/cli/run.ts',
        description: 'Environment variable parsing for runtime config.'
      },
      {
        key: 'tests',
        pathTemplate: 'tests/unit/browser/BrowserFactory.test.ts',
        description: 'Unit tests for browser launch/connect behavior.'
      },
      {
        key: 'docs',
        pathTemplate: 'README.md',
        description: 'Runtime setup and debug endpoint documentation.'
      }
    ],
    maxFiles: 7
  },
  parameters: {
    feature: {
      description: 'Browser/runtime feature to add or change, for example remote-debugging, existing profile validation, tab reuse, or timeouts.',
      required: true
    },
    instructions: {
      description: 'Specific behavior, env vars, error handling, and compatibility constraints.',
      required: false
    }
  },
  examples: [
    'src/browser/RuntimeConfig.ts',
    'src/browser/BrowserFactory.ts',
    'src/browser/BrowserSession.ts',
    'src/browser/profileValidation.ts',
    'tests/unit/browser/BrowserFactory.test.ts'
  ],
  context: [
    { kind: 'path', path: 'src/browser/RuntimeConfig.ts', description: 'Runtime config model and normalization.' },
    { kind: 'path', path: 'src/browser/BrowserFactory.ts', description: 'Launch/connect implementation.' },
    { kind: 'path', path: 'src/browser/BrowserSession.ts', description: 'Session lifecycle behavior.' },
    { kind: 'path', path: 'src/browser/profileValidation.ts', description: 'Validation helpers.' },
    { kind: 'path', path: 'src/browser/PuppeteerLike.ts', description: 'Testable Puppeteer interfaces.' },
    { kind: 'path', path: 'src/core/ActorRunner.ts', description: 'How BrowserFactory is invoked.' },
    { kind: 'path', path: 'src/cli/run.ts', description: 'CLI runtime config construction.' },
    { kind: 'path', path: 'tests/unit/browser/BrowserFactory.test.ts', description: 'Existing browser runtime tests.' }
  ],
  keywordContexts: [
    {
      keywords: ['cli', 'env', 'environment variable', 'CHROME_USER_DATA_DIR', 'CHROME_REMOTE_DEBUGGING_PORT'],
      context: [
        { kind: 'path', path: 'README.md', description: 'CLI/runtime docs that should remain accurate.' }
      ]
    },
    {
      keywords: ['actor runner', 'cleanup', 'close', 'disconnect'],
      context: [
        { kind: 'path', path: 'tests/unit/core/ActorRunner.test.ts', description: 'Runner cleanup behavior tests.' }
      ]
    },
    {
      keywords: ['typing', 'interaction', 'cursor'],
      context: [
        { kind: 'path', path: 'src/interaction/HumanTyping.ts', description: 'Interaction config nested in RuntimeConfig.' },
        { kind: 'path', path: 'src/interaction/GhostCursorAdapter.ts', description: 'Runtime config is passed into interactor construction.' }
      ]
    }
  ],
  tooling: {
    allowGetExistingCode: true,
    allowFindFiles: true,
    allowSearchRepo: true
  }
};
