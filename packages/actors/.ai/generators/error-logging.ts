export default {
  id: 'error-logging',
  description: 'Modify typed errors, logging implementations, metadata redaction, and diagnostics behavior.',
  instructions: `
Update error/logging behavior safely.

Rules:
- Keep AutomationError as the base class for framework-level errors.
- Preserve useful metadata: actorId, taskName, url, selector, and cause where applicable.
- Keep logging implementation independent from site-specific code.
- Redact sensitive metadata recursively before writing logs.
- Add tests for every new redaction key or error metadata behavior.
- If a browser/auth/core module starts throwing a new typed error, update the relevant unit tests there too.
- Prefer typed errors over plain Error for framework-level failures.

DO NOT log raw passwords, tokens, authorization headers, cookies, or session secrets.
DO NOT swallow causes; preserve them in metadata where feasible.
`.trim(),
  output: {
    pathTemplates: [
      {
        key: 'error',
        pathTemplate: 'src/errors/{{errorPascal}}.ts',
        description: 'Typed error class. Use existing files when editing existing errors.'
      },
      {
        key: 'errors-index',
        pathTemplate: 'src/errors/index.ts',
        description: 'Error barrel exports.'
      },
      {
        key: 'logger',
        pathTemplate: 'src/logging/{{loggerPascal}}.ts',
        description: 'Logger interface or implementation. Use existing files when editing existing loggers.'
      },
      {
        key: 'redact',
        pathTemplate: 'src/utils/redact.ts',
        description: 'Sensitive metadata redaction utility.'
      },
      {
        key: 'tests',
        pathTemplate: 'tests/unit/logging/{{subjectPascal}}.test.ts',
        description: 'Logging/redaction unit tests.'
      }
    ],
    maxFiles: 5
  },
  parameters: {
    subject: {
      description: 'Error/logging/redaction behavior to implement or update.',
      required: true
    },
    instructions: {
      description: 'Specific metadata, redaction keys, logger behavior, or error semantics.',
      required: false
    }
  },
  examples: [
    'src/errors/AutomationError.ts',
    'src/errors/AuthError.ts',
    'src/logging/ConsoleLogger.ts',
    'src/logging/MemoryLogger.ts',
    'src/utils/redact.ts',
    'tests/unit/logging/redact.test.ts'
  ],
  context: [
    { kind: 'pattern', pattern: 'src/errors/*.ts', description: 'Existing typed errors and barrel export.', limit: 10 },
    { kind: 'pattern', pattern: 'src/logging/*.ts', description: 'Logger interface and implementations.', limit: 10 },
    { kind: 'path', path: 'src/utils/redact.ts', description: 'Sensitive metadata redaction utility.' },
    { kind: 'path', path: 'tests/unit/logging/redact.test.ts', description: 'Existing redaction tests.' },
    { kind: 'path', path: 'src/auth/LoginFlow.ts', description: 'Auth error and redacted logging usage.' },
    { kind: 'path', path: 'src/browser/BrowserFactory.ts', description: 'ConfigError metadata usage.' },
    { kind: 'path', path: 'src/core/ActorRunner.ts', description: 'Error wrapping behavior.' }
  ],
  keywordContexts: [
    {
      keywords: ['auth', 'login', 'credentials', 'password'],
      context: [
        { kind: 'path', path: 'tests/unit/auth/LoginFlow.test.ts', description: 'Auth tests may need error/log assertion updates.' }
      ]
    },
    {
      keywords: ['browser', 'chrome', 'profile', 'remote debugging'],
      context: [
        { kind: 'path', path: 'tests/unit/browser/BrowserFactory.test.ts', description: 'Browser error tests.' }
      ]
    },
    {
      keywords: ['selector', 'form', 'extraction'],
      context: [
        { kind: 'path', path: 'tests/unit/interaction/Forms.test.ts', description: 'Selector error behavior tests.' },
        { kind: 'path', path: 'tests/unit/extraction/Extractor.test.ts', description: 'Extraction behavior tests.' }
      ]
    }
  ],
  tooling: {
    allowGetExistingCode: true,
    allowFindFiles: true,
    allowSearchRepo: true
  }
};
