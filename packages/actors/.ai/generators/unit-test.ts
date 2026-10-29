export default {
  id: 'unit-test',
  description: 'Generate or update Vitest unit tests for framework modules, site actors, and test fixtures.',
  instructions: `
Write deterministic Vitest unit tests that match the repo style.

Rules:
- Use Vitest APIs and existing test structure under tests/unit.
- Prefer FakePage, FakeCursor, FakeCredentialsProvider, and makeContext over live browser tests.
- Do not launch Chrome in unit tests.
- Test observable behavior, calls, returned data, and typed errors.
- Cover success and failure paths for core/auth/browser changes.
- Keep fixtures minimal and reusable.
- If a source change requires fixture updates, update the fixture in the same result.
- Match strict TypeScript settings; avoid any unless the existing test pattern requires it.

DO NOT write brittle tests that depend on real websites, external network, or a user profile path.
`.trim(),
  output: {
    pathTemplates: [
      {
        key: 'test',
        pathTemplate: 'tests/unit/{{areaKebab}}/{{subjectPascal}}.test.ts',
        description: 'Unit test file for the requested area and subject.'
      },
      {
        key: 'fake-page',
        pathTemplate: 'tests/fixtures/FakePage.ts',
        description: 'Update only when page behavior required by the tests is missing.'
      },
      {
        key: 'fake-cursor',
        pathTemplate: 'tests/fixtures/FakeCursor.ts',
        description: 'Update only when cursor behavior required by the tests is missing.'
      },
      {
        key: 'fake-credentials',
        pathTemplate: 'tests/fixtures/FakeCredentialsProvider.ts',
        description: 'Update only when credential behavior required by the tests is missing.'
      },
      {
        key: 'make-context',
        pathTemplate: 'tests/fixtures/makeContext.ts',
        description: 'Update only when ActorContext construction changes.'
      }
    ],
    maxFiles: 5
  },
  parameters: {
    area: {
      description: 'Test area folder, for example auth, browser, core, extraction, interaction, logging, sites, or cli.',
      required: true
    },
    subject: {
      description: 'Class/function/component under test, for example LoginFlow, BrowserFactory, or HumanTyping.',
      required: true
    },
    instructions: {
      description: 'Specific behaviors, branches, errors, and edge cases that must be tested.',
      required: false
    }
  },
  examples: [
    'tests/unit/auth/LoginFlow.test.ts',
    'tests/unit/browser/BrowserFactory.test.ts',
    'tests/unit/core/ActorRunner.test.ts',
    'tests/unit/interaction/HumanTyping.test.ts',
    'tests/fixtures/FakePage.ts',
    'tests/fixtures/FakeCursor.ts',
    'tests/fixtures/makeContext.ts'
  ],
  context: [
    { kind: 'path', path: 'vitest.config.ts', description: 'Vitest configuration.' },
    { kind: 'pattern', pattern: 'tests/unit/{{areaKebab}}/*.test.ts', description: 'Existing tests in the target area.', limit: 8 },
    { kind: 'pattern', pattern: 'tests/unit/**/*.test.ts', description: 'Representative test style from the rest of the repo.', limit: 5 },
    { kind: 'path', path: 'tests/fixtures/FakePage.ts', description: 'Main fake page fixture.' },
    { kind: 'path', path: 'tests/fixtures/FakeCursor.ts', description: 'Fake cursor fixture.' },
    { kind: 'path', path: 'tests/fixtures/FakeCredentialsProvider.ts', description: 'Fake credentials fixture.' },
    { kind: 'path', path: 'tests/fixtures/makeContext.ts', description: 'ActorContext test fixture.' },
    { kind: 'path', path: 'src/{{areaKebab}}/{{subjectPascal}}.ts', description: 'Conventional source module under test, when present.', required: false }
  ],
  keywordContexts: [
    {
      keywords: ['login', 'auth', 'credentials', 'multi-step'],
      context: [
        { kind: 'path', path: 'src/auth/LoginFlow.ts', description: 'Auth source likely under test.' },
        { kind: 'path', path: 'src/auth/LoginFlow.types.ts', description: 'Auth types likely under test.' }
      ]
    },
    {
      keywords: ['browser', 'chrome', 'profile', 'remote debugging'],
      context: [
        { kind: 'path', path: 'src/browser/BrowserFactory.ts', description: 'Browser source likely under test.' },
        { kind: 'path', path: 'src/browser/PuppeteerLike.ts', description: 'Fakeable browser/page interfaces.' }
      ]
    },
    {
      keywords: ['interaction', 'typing', 'cursor', 'forms'],
      context: [
        { kind: 'pattern', pattern: 'src/interaction/*.ts', description: 'Interaction source files.', limit: 10 }
      ]
    }
  ],
  tooling: {
    allowGetExistingCode: true,
    allowFindFiles: true,
    allowSearchRepo: true
  }
};
