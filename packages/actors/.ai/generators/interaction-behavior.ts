export default {
  id: 'interaction-behavior',
  description: 'Modify human interaction behavior: ghost-cursor adapter, native interactor, typing, field clearing, forms, navigation, waits, and page adapter behavior.',
  instructions: `
Modify the interaction layer while preserving the HumanInteractor abstraction.

Rules:
- Keep HumanInteractor as the contract that site actors and forms use.
- Keep ghost-cursor-specific details inside GhostCursorAdapter.
- Keep NativePuppeteerInteractor deterministic and suitable for tests/fallbacks.
- Human-like typing should remain key-by-key unless explicitly disabled.
- Field clearing should remain opt-in through options and login defaults, not forced globally for all interactions.
- If PageAdapter gains a method, update PuppeteerPageAdapter and FakePage where appropriate.
- If FormFiller behavior changes, update Forms tests and any affected LoginFlow tests.
- If typing timing changes, update HumanTyping tests with deterministic random/sleep functions.

DO NOT put site-specific selectors or auth flow logic in the interaction layer.
DO NOT introduce sleeps where selector waits or navigation waits are more precise.
`.trim(),
  output: {
    pathTemplates: [
      {
        key: 'human-interactor',
        pathTemplate: 'src/interaction/HumanInteractor.ts',
        description: 'Human interaction interface and shared options.'
      },
      {
        key: 'ghost-adapter',
        pathTemplate: 'src/interaction/GhostCursorAdapter.ts',
        description: 'ghost-cursor-backed interactor implementation.'
      },
      {
        key: 'native-adapter',
        pathTemplate: 'src/interaction/NativePuppeteerInteractor.ts',
        description: 'Puppeteer-native interactor implementation.'
      },
      {
        key: 'typing',
        pathTemplate: 'src/interaction/HumanTyping.ts',
        description: 'Typing timing and key-by-key typing implementation.'
      },
      {
        key: 'field-clearer',
        pathTemplate: 'src/interaction/FieldClearer.ts',
        description: 'Field clearing strategies.'
      },
      {
        key: 'forms',
        pathTemplate: 'src/interaction/Forms.ts',
        description: 'Form filling helper.'
      },
      {
        key: 'page-adapter',
        pathTemplate: 'src/interaction/PageAdapter.ts',
        description: 'Page adapter when new selector/page operations are needed.'
      },
      {
        key: 'tests',
        pathTemplate: 'tests/unit/interaction/{{componentPascal}}.test.ts',
        description: 'Focused tests for the changed interaction component.'
      },
      {
        key: 'fake-page',
        pathTemplate: 'tests/fixtures/FakePage.ts',
        description: 'Update when PageAdapter or keyboard/page behavior changes.'
      },
      {
        key: 'fake-cursor',
        pathTemplate: 'tests/fixtures/FakeCursor.ts',
        description: 'Update when cursor behavior or recorded calls change.'
      }
    ],
    maxFiles: 10
  },
  parameters: {
    component: {
      description: 'Interaction component or behavior to edit, for example typing, cursor, forms, field clearing, page adapter, or navigation.',
      required: true
    },
    instructions: {
      description: 'Specific behavior, options, timing, selectors, or compatibility requirements.',
      required: false
    }
  },
  examples: [
    'src/interaction/HumanInteractor.ts',
    'src/interaction/GhostCursorAdapter.ts',
    'src/interaction/HumanTyping.ts',
    'src/interaction/FieldClearer.ts',
    'tests/unit/interaction/HumanTyping.test.ts',
    'tests/fixtures/FakePage.ts'
  ],
  context: [
    { kind: 'path', path: 'src/interaction/HumanInteractor.ts', description: 'Interaction contract.' },
    { kind: 'path', path: 'src/interaction/GhostCursorAdapter.ts', description: 'ghost-cursor interactor.' },
    { kind: 'path', path: 'src/interaction/NativePuppeteerInteractor.ts', description: 'Puppeteer-native interactor.' },
    { kind: 'path', path: 'src/interaction/HumanTyping.ts', description: 'Human typing implementation.' },
    { kind: 'path', path: 'src/interaction/FieldClearer.ts', description: 'Field clearing implementation.' },
    { kind: 'path', path: 'src/interaction/Forms.ts', description: 'Form helper.' },
    { kind: 'path', path: 'src/interaction/PageAdapter.ts', description: 'Page wrapper.' },
    { kind: 'path', path: 'src/interaction/Navigation.ts', description: 'Navigation helper.' },
    { kind: 'path', path: 'src/interaction/Waits.ts', description: 'Wait profiles.' },
    { kind: 'path', path: 'src/browser/PuppeteerLike.ts', description: 'Keyboard/page/browser types used by interactors and tests.' },
    { kind: 'pattern', pattern: 'tests/unit/interaction/*.test.ts', description: 'Existing interaction tests.', limit: 10 },
    { kind: 'path', path: 'tests/fixtures/FakePage.ts', description: 'Fake page fixture.' },
    { kind: 'path', path: 'tests/fixtures/FakeCursor.ts', description: 'Fake cursor fixture.' }
  ],
  keywordContexts: [
    {
      keywords: ['login', 'auth', 'clearFieldBeforeTyping'],
      context: [
        { kind: 'path', path: 'src/auth/LoginFlow.ts', description: 'Login fill steps consume form/interactor options.' },
        { kind: 'path', path: 'tests/unit/auth/LoginFlow.test.ts', description: 'Login tests may need updates after interaction changes.' }
      ]
    },
    {
      keywords: ['runtime config', 'default typing', 'config'],
      context: [
        { kind: 'path', path: 'src/browser/RuntimeConfig.ts', description: 'Global interaction typing config.' },
        { kind: 'path', path: 'src/core/ActorRunner.ts', description: 'Passes typing config to GhostCursorAdapter.' }
      ]
    }
  ],
  tooling: {
    allowGetExistingCode: true,
    allowFindFiles: true,
    allowSearchRepo: true
  }
};
