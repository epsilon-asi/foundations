export default {
  id: 'core-framework',
  description:
    'Modify core actor framework behavior: ActorRunner, ActorContext, ActorRegistry, defineActor, hooks, context services, and execution lifecycle.',
  instructions: `
Make reusable framework changes in src/core unless another layer clearly owns the behavior.

Rules:
- ActorRunner coordinates browser session creation, auth, task execution, hooks, error wrapping, and cleanup.
- ActorContext should expose stable services to site actors; avoid leaking low-level implementation details unless necessary.
- Keep defineActor simple and type-preserving.
- Keep ActorRegistry focused on registration and lookup.
- Do not implement site-specific scraping in core.
- Add unit tests for every lifecycle, auth, context, or hook behavior change.
`.trim(),
  output: {
    pathTemplates: [
      { key: 'actor', pathTemplate: 'src/core/Actor.ts', description: 'Actor/task/hook types.' },
      { key: 'context', pathTemplate: 'src/core/ActorContext.ts', description: 'Task context services.' },
      { key: 'runner', pathTemplate: 'src/core/ActorRunner.ts', description: 'Execution lifecycle implementation.' },
      { key: 'registry', pathTemplate: 'src/core/ActorRegistry.ts', description: 'Actor registry implementation.' },
      { key: 'define-actor', pathTemplate: 'src/core/defineActor.ts', description: 'Actor definition helper.' },
      { key: 'core-index', pathTemplate: 'src/core/index.ts', description: 'Core barrel exports.' },
      { key: 'runner-tests', pathTemplate: 'tests/unit/core/ActorRunner.test.ts', description: 'Runner lifecycle tests.' },
      { key: 'define-tests', pathTemplate: 'tests/unit/core/defineActor.test.ts', description: 'defineActor type/runtime tests.' }
    ],
    maxFiles: 8
  },
  parameters: {
    feature: {
      description: 'Core framework feature to add or change, for example hooks, context service, actor lookup, or error wrapping.',
      required: true
    },
    instructions: {
      description: 'Detailed behavior, affected actors, lifecycle semantics, and test expectations.',
      required: false
    }
  },
  examples: [
    'src/core/ActorRunner.ts',
    'src/core/ActorContext.ts',
    'src/core/ActorRegistry.ts',
    'tests/unit/core/ActorRunner.test.ts'
  ],
  context: [
    { kind: 'path', path: 'src/core/Actor.ts', description: 'Actor/task/hook types.' },
    { kind: 'path', path: 'src/core/ActorContext.ts', description: 'Services exposed to tasks.' },
    { kind: 'path', path: 'src/core/ActorRunner.ts', description: 'Execution lifecycle.' },
    { kind: 'path', path: 'src/core/ActorRegistry.ts', description: 'Registry behavior.' },
    { kind: 'path', path: 'src/core/defineActor.ts', description: 'Type-preserving actor helper.' },
    { kind: 'path', path: 'src/browser/BrowserSession.ts', description: 'Session lifecycle consumed by ActorRunner.' },
    { kind: 'path', path: 'src/auth/LoginFlow.ts', description: 'Auth service used by ActorRunner.' },
    { kind: 'path', path: 'src/errors/AutomationError.ts', description: 'Base error wrapper used by ActorRunner.' },
    { kind: 'pattern', pattern: 'tests/unit/core/*.test.ts', description: 'Core unit tests.', limit: 5 },
    { kind: 'path', path: 'tests/fixtures/makeContext.ts', description: 'ActorContext test fixture.' }
  ],
  keywordContexts: [
    {
      keywords: ['browser', 'session', 'cleanup', 'close', 'disconnect'],
      context: [
        { kind: 'path', path: 'src/browser/BrowserFactory.ts', description: 'BrowserSession creation behavior.' },
        { kind: 'path', path: 'src/browser/BrowserSession.ts', description: 'Close/disconnect behavior.' },
        { kind: 'path', path: 'tests/unit/browser/BrowserFactory.test.ts', description: 'Browser lifecycle tests.' }
      ]
    },
    {
      keywords: ['auth', 'login', 'ensureAuthenticated', 'isLoggedIn'],
      context: [
        { kind: 'path', path: 'src/auth/LoginFlow.ts', description: 'Auth execution consumed by ActorRunner.' },
        { kind: 'path', path: 'src/auth/AuthStateDetector.ts', description: 'Logged-in detection consumed by context auth controller.' },
        { kind: 'path', path: 'tests/unit/auth/LoginFlow.test.ts', description: 'Auth behavior tests.' }
      ]
    }
  ],
  tooling: {
    allowGetExistingCode: true,
    allowFindFiles: true,
    allowSearchRepo: true
  }
};
