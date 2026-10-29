export default {
  id: 'site-login-flow',
  description: 'Add or revise a site actor login flow, including simple, staged, and multi-step username/password flows.',
  instructions: `
Update the site auth configuration using defineLoginFlow.

Rules:
- Keep login configuration inside the site actor unless the repo already split auth into a separate file.
- Use selectors.loggedInSignal for post-login verification.
- Use selectors.errorMessage when the site exposes a visible error message.
- For one-page login forms, selectors.username/password/submit are acceptable.
- For staged forms, use the ordered steps array.
- For username-first/password-second forms, use fill(username), click(continue with waitForSelector), fill(password), click(submit).
- Preserve clearFieldBeforeTyping defaults unless the user explicitly requests otherwise.
- Preserve human-like typing behavior through behavior.typing or per-fill-step typing overrides.
- Use credential: 'username' and credential: 'password' for credential fields.
- Use value or a value resolver only for non-credential fields, such as tenant/workspace/account id.
- Add waitForSelector after intermediate click steps whenever the next field appears asynchronously.
- Mark the final click step with submit: true so beforeSubmit/afterSubmit hooks apply.
- Add or update tests for the login shape and any custom hook/step behavior.

DO NOT hard-code real usernames, passwords, tokens, cookies, or private profile paths.
DO NOT implement CAPTCHA bypass or anti-bot circumvention.
`.trim(),
  output: {
    pathTemplates: [
      {
        key: 'actor',
        pathTemplate: 'src/sites/{{siteKebab}}/{{siteKebab}}.actor.ts',
        description: 'The site actor whose auth definition should be added or updated.'
      },
      {
        key: 'selectors',
        pathTemplate: 'src/sites/{{siteKebab}}/{{siteKebab}}.selectors.ts',
        description: 'Selectors for login fields, buttons, errors, and logged-in signals.'
      },
      {
        key: 'tests',
        pathTemplate: 'tests/unit/sites/{{siteKebab}}.login.test.ts',
        description: 'Focused tests for the generated site login config or custom login behavior.'
      }
    ],
    maxFiles: 3
  },
  parameters: {
    site: {
      description: 'The site whose login should be implemented or edited.',
      required: true
    },
    loginUrl: {
      description: 'Login URL or path for the site.',
      required: false
    },
    flowType: {
      description: 'Login flow style, for example simple, multi-step, username-first, tenant-first, or custom.',
      required: false
    },
    instructions: {
      description: 'Selectors, step order, waits, hooks, and edge cases for this login form.',
      required: false
    }
  },
  examples: [
    'src/sites/example/example.actor.ts',
    'src/sites/example/example.selectors.ts',
    'tests/unit/auth/LoginFlow.test.ts'
  ],
  context: [
    {
      kind: 'path',
      path: 'src/sites/{{siteKebab}}/{{siteKebab}}.actor.ts',
      description: 'Existing site actor to update when present.',
      required: false
    },
    {
      kind: 'path',
      path: 'src/sites/{{siteKebab}}/{{siteKebab}}.selectors.ts',
      description: 'Existing site selectors to update when present.',
      required: false
    },
    { kind: 'path', path: 'src/auth/LoginFlow.types.ts', description: 'LoginFlowDefinition and LoginStep types.' },
    { kind: 'path', path: 'src/auth/LoginFlow.ts', description: 'How login steps execute.' },
    { kind: 'path', path: 'src/auth/CredentialsProvider.ts', description: 'Credential references and providers.' },
    { kind: 'path', path: 'src/auth/AuthStateDetector.ts', description: 'Logged-in detection behavior.' },
    { kind: 'path', path: 'src/interaction/Forms.ts', description: 'Form filling behavior used by fill steps.' },
    { kind: 'path', path: 'src/interaction/FieldClearer.ts', description: 'clearFieldBeforeTyping implementation.' },
    { kind: 'path', path: 'src/interaction/HumanTyping.ts', description: 'Human-like typing options used by login fill steps.' },
    { kind: 'path', path: 'tests/unit/auth/LoginFlow.test.ts', description: 'Canonical login flow tests.' }
  ],
  keywordContexts: [
    {
      keywords: ['multi-step', 'multistep', 'apple', 'upwork', 'continue', 'next', 'waitForSelector'],
      context: [
        { kind: 'path', path: 'tests/unit/auth/LoginFlow.test.ts', description: 'Contains multi-step login expectations.' },
        { kind: 'path', path: 'src/auth/LoginFlow.types.ts', description: 'Step-specific wait and hook options.' }
      ]
    },
    {
      keywords: ['clearFieldBeforeTyping', 'clear', 'pre-filled', 'select-delete'],
      context: [
        { kind: 'path', path: 'tests/unit/interaction/FieldClearer.test.ts', description: 'Field clearing behavior tests.' }
      ]
    },
    {
      keywords: ['typing', 'wpm', 'human-like', 'jitter'],
      context: [
        { kind: 'path', path: 'tests/unit/interaction/HumanTyping.test.ts', description: 'Typing timing tests.' },
        { kind: 'path', path: 'tests/unit/interaction/NativePuppeteerInteractor.test.ts', description: 'Typing integration tests.' }
      ]
    }
  ],
  tooling: {
    allowGetExistingCode: true,
    allowFindFiles: true,
    allowSearchRepo: true
  }
};
