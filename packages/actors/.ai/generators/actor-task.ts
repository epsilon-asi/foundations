export default {
  id: 'actor-task',
  description: 'Add or update a task on an existing site actor, including selectors, types, extraction logic, and tests.',
  instructions: `
Add or revise an actor task for an existing site.

Rules:
- Add the task to the actor.tasks object without breaking existing tasks.
- Use explicit input and output types in the site's .types.ts file.
- Use context.nav for URL/path navigation.
- Use context.forms and context.cursor for interactions.
- Use context.extract and context.pagination for scraping/extraction.
- Put new selectors in the site's .selectors.ts file and keep names descriptive.
- Normalize returned data into typed objects rather than returning raw DOM strings when the task output is known.
- Add unit tests for branching behavior, extraction logic, and pagination when applicable.
- Keep tests deterministic by using FakePage, FakeCursor, FakeCredentialsProvider, and makeContext where useful.

DO NOT call Puppeteer directly unless the PageAdapter/Extractor abstractions cannot express the operation.
DO NOT add broad sleeps when selector waits or navigation waits are more precise.
`.trim(),
  output: {
    pathTemplates: [
      {
        key: 'actor',
        pathTemplate: 'src/sites/{{siteKebab}}/{{siteKebab}}.actor.ts',
        description: 'The site actor to update with the new or changed task.'
      },
      {
        key: 'selectors',
        pathTemplate: 'src/sites/{{siteKebab}}/{{siteKebab}}.selectors.ts',
        description: 'Selectors used by the task.'
      },
      {
        key: 'types',
        pathTemplate: 'src/sites/{{siteKebab}}/{{siteKebab}}.types.ts',
        description: 'Task input and output types.'
      },
      {
        key: 'tests',
        pathTemplate: 'tests/unit/sites/{{siteKebab}}.{{taskName}}.test.ts',
        description: 'Focused unit tests for the new task.'
      }
    ],
    maxFiles: 4
  },
  parameters: {
    site: {
      description: 'Existing site actor name.',
      required: true
    },
    taskName: {
      description: 'Task name to add or update, for example scrapeDashboard, scrapeListings, downloadInvoices.',
      required: true
    },
    instructions: {
      description: 'Detailed behavior, selectors, inputs, outputs, and edge cases for the task.',
      required: false
    }
  },
  examples: [
    'src/sites/example/example.actor.ts',
    'src/sites/example/example.selectors.ts',
    'src/sites/example/example.types.ts',
    'tests/unit/extraction/Extractor.test.ts',
    'tests/unit/extraction/Pagination.test.ts'
  ],
  context: [
    {
      kind: 'path',
      path: 'src/sites/{{siteKebab}}/{{siteKebab}}.actor.ts',
      description: 'Existing actor that owns the task.',
      required: true
    },
    {
      kind: 'path',
      path: 'src/sites/{{siteKebab}}/{{siteKebab}}.selectors.ts',
      description: 'Existing site selectors.',
      required: false
    },
    {
      kind: 'path',
      path: 'src/sites/{{siteKebab}}/{{siteKebab}}.types.ts',
      description: 'Existing site task types.',
      required: false
    },
    { kind: 'path', path: 'src/core/Actor.ts', description: 'Task contract.' },
    { kind: 'path', path: 'src/core/ActorContext.ts', description: 'Context helpers exposed to the task.' },
    { kind: 'path', path: 'src/extraction/Extractor.ts', description: 'Reusable extraction methods.' },
    { kind: 'path', path: 'src/extraction/Pagination.ts', description: 'Reusable pagination methods.' },
    { kind: 'path', path: 'src/interaction/Navigation.ts', description: 'Navigation helper.' },
    { kind: 'path', path: 'src/interaction/Forms.ts', description: 'Form helper.' },
    { kind: 'path', path: 'tests/fixtures/makeContext.ts', description: 'ActorContext factory for unit tests.' },
    { kind: 'path', path: 'tests/fixtures/FakePage.ts', description: 'Fake page fixture for task tests.' },
    { kind: 'path', path: 'tests/fixtures/FakeCursor.ts', description: 'Fake cursor fixture for task tests.' }
  ],
  keywordContexts: [
    {
      keywords: ['pagination', 'next page', 'maxPages', 'deduplicate'],
      context: [
        { kind: 'path', path: 'tests/unit/extraction/Pagination.test.ts', description: 'Pagination test patterns.' }
      ]
    },
    {
      keywords: ['table', 'jsonld', 'json-ld', 'href', 'attribute', 'textList'],
      context: [
        { kind: 'path', path: 'tests/unit/extraction/Extractor.test.ts', description: 'Extractor test patterns.' }
      ]
    },
    {
      keywords: ['login', 'auth', 'requires auth'],
      context: [
        { kind: 'path', path: 'src/auth/LoginFlow.types.ts', description: 'Actor auth config available before tasks run.' },
        { kind: 'path', path: 'src/core/ActorRunner.ts', description: 'Auth is ensured before task execution.' }
      ]
    }
  ],
  tooling: {
    allowGetExistingCode: true,
    allowFindFiles: true,
    allowSearchRepo: true
  }
};
