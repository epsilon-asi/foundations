export default {
  id: 'auth-core',
  description: 'Modify authentication infrastructure: credentials providers, auth state detection, login flow execution, session snapshots, and auth tests.',
  instructions: `
Modify the authentication layer while preserving the standardized site login API.

Rules:
- LoginFlowDefinition and LoginStep types are public-ish contracts for site authors; preserve compatibility when possible.
- Keep credentials abstracted through CredentialsProvider.
- Never log raw passwords, tokens, cookies, or secret values.
- Use redact() for logging sensitive credential metadata.
- Keep AuthStateDetector focused on deciding whether the current profile/session is already logged in.
- Keep LoginFlow responsible for executing simple and multi-step flows.
- If login step semantics change, update LoginFlow.types.ts and LoginFlow.test.ts.
- If field typing/clearing behavior changes, coordinate with Forms, FieldClearer, and HumanTyping.
- If session snapshots change, keep them optional because existing Chrome profile state is the primary session store.

DO NOT add CAPTCHA bypass, 2FA bypass, or anti-bot circumvention.
DO NOT store credentials in session snapshots.
`.trim(),
  output: {
    pathTemplates: [
      {
        key: 'login-types',
        pathTemplate: 'src/auth/LoginFlow.types.ts',
        description: 'Login flow public types and config shape.'
      },
      {
        key: 'login-flow',
        pathTemplate: 'src/auth/LoginFlow.ts',
        description: 'Login flow execution behavior.'
      },
      {
        key: 'credentials',
        pathTemplate: 'src/auth/CredentialsProvider.ts',
        description: 'Credential providers and credential references.'
      },
      {
        key: 'detector',
        pathTemplate: 'src/auth/AuthStateDetector.ts',
        description: 'Logged-in state detection.'
      },
      {
        key: 'session-store',
        pathTemplate: 'src/auth/SessionStore.ts',
        description: 'Optional session snapshot abstraction.'
      },
      {
        key: 'auth-index',
        pathTemplate: 'src/auth/index.ts',
        description: 'Auth barrel exports.'
      },
      {
        key: 'tests',
        pathTemplate: 'tests/unit/auth/{{componentPascal}}.test.ts',
        description: 'Auth unit tests for changed behavior.'
      },
      {
        key: 'fake-credentials',
        pathTemplate: 'tests/fixtures/FakeCredentialsProvider.ts',
        description: 'Test credential provider fixture.'
      }
    ],
    maxFiles: 8
  },
  parameters: {
    component: {
      description: 'Auth component or behavior to edit, for example LoginFlow, multi-step steps, credentials, auth detection, or session store.',
      required: true
    },
    instructions: {
      description: 'Specific auth behavior, config shape, step semantics, or failure handling to implement.',
      required: false
    }
  },
  examples: [
    'src/auth/LoginFlow.types.ts',
    'src/auth/LoginFlow.ts',
    'src/auth/CredentialsProvider.ts',
    'tests/unit/auth/LoginFlow.test.ts',
    'tests/unit/auth/AuthStateDetector.test.ts'
  ],
  context: [
    { kind: 'path', path: 'src/auth/LoginFlow.types.ts', description: 'Auth config and login step types.' },
    { kind: 'path', path: 'src/auth/LoginFlow.ts', description: 'Login execution.' },
    { kind: 'path', path: 'src/auth/CredentialsProvider.ts', description: 'Credential provider model.' },
    { kind: 'path', path: 'src/auth/AuthStateDetector.ts', description: 'Auth state detection.' },
    { kind: 'path', path: 'src/auth/SessionStore.ts', description: 'Optional session store.' },
    { kind: 'path', path: 'src/core/ActorRunner.ts', description: 'Ensures auth before tasks.' },
    { kind: 'path', path: 'src/core/ActorContext.ts', description: 'Auth controller available to actors.' },
    { kind: 'path', path: 'src/utils/redact.ts', description: 'Sensitive data redaction.' },
    { kind: 'path', path: 'src/interaction/Forms.ts', description: 'Login fill steps use FormFiller.' },
    { kind: 'path', path: 'src/interaction/FieldClearer.ts', description: 'Field clearing used by login fills.' },
    { kind: 'path', path: 'src/interaction/HumanTyping.ts', description: 'Typing options for login fills.' },
    { kind: 'path', path: 'tests/unit/auth/LoginFlow.test.ts', description: 'Login flow tests.' },
    { kind: 'path', path: 'tests/unit/auth/AuthStateDetector.test.ts', description: 'Detector tests.' },
    { kind: 'path', path: 'tests/fixtures/makeContext.ts', description: 'Test context factory.' }
  ],
  keywordContexts: [
    {
      keywords: ['multi-step', 'multistep', 'steps', 'waitForSelector', 'hook'],
      context: [
        { kind: 'path', path: 'src/sites/example/example.actor.ts', description: 'Example login config shape.' }
      ]
    },
    {
      keywords: ['logging', 'redact', 'secret', 'password', 'token'],
      context: [
        { kind: 'path', path: 'tests/unit/logging/redact.test.ts', description: 'Redaction test expectations.' },
        { kind: 'path', path: 'src/logging/Logger.ts', description: 'Logger interface.' }
      ]
    },
    {
      keywords: ['browser profile', 'existing profile', 'cookies', 'localStorage'],
      context: [
        { kind: 'path', path: 'src/browser/RuntimeConfig.ts', description: 'Existing Chrome profile config model.' },
        { kind: 'path', path: 'src/browser/BrowserSession.ts', description: 'Browser session behavior.' }
      ]
    }
  ],
  tooling: {
    allowGetExistingCode: true,
    allowFindFiles: true,
    allowSearchRepo: true
  }
};
