export default {
  id: 'extraction-helper',
  description: 'Add or modify reusable extraction helpers, pagination behavior, data mapping utilities, and extraction tests.',
  instructions: `
Add or revise extraction utilities for reusable scraping behavior.

Rules:
- Keep extraction helpers generic and site-agnostic.
- Use PageAdapter methods before reaching for raw Puppeteer APIs.
- Preserve existing Extractor and Pagination behavior unless the user asks for a change.
- Return normalized values where possible: trimmed text, null for missing optional attributes, arrays for lists.
- Make missing-required-element behavior explicit in options rather than surprising callers.
- Add unit tests using FakePage for every new extraction behavior.
- Update src/extraction/index.ts when adding a new exported helper.
- Update src/index.ts if the new helper is part of the public package API.

DO NOT put site-specific selectors or actor-specific data shapes in generic extraction helpers.
`.trim(),
  output: {
    pathTemplates: [
      {
        key: 'helper',
        pathTemplate: 'src/extraction/{{helperPascal}}.ts',
        description: 'New extraction helper. Use Extractor.ts or Pagination.ts directly when editing existing helpers.'
      },
      {
        key: 'extraction-index',
        pathTemplate: 'src/extraction/index.ts',
        description: 'Extraction barrel export.'
      },
      {
        key: 'root-index',
        pathTemplate: 'src/index.ts',
        description: 'Root package export when public API changes.'
      },
      {
        key: 'tests',
        pathTemplate: 'tests/unit/extraction/{{helperPascal}}.test.ts',
        description: 'Unit tests for the extraction helper.'
      },
      {
        key: 'fake-page',
        pathTemplate: 'tests/fixtures/FakePage.ts',
        description: 'Update when the helper requires new fake page behavior.'
      }
    ],
    maxFiles: 5
  },
  parameters: {
    helper: {
      description: 'Extraction helper to add or modify, for example TableExtractor, Pagination, JsonLdExtractor, or Extractor.',
      required: true
    },
    instructions: {
      description: 'Specific selectors, data shape, normalization, pagination, or edge cases.',
      required: false
    }
  },
  examples: [
    'src/extraction/Extractor.ts',
    'src/extraction/Pagination.ts',
    'tests/unit/extraction/Extractor.test.ts',
    'tests/unit/extraction/Pagination.test.ts'
  ],
  context: [
    { kind: 'path', path: 'src/extraction/Extractor.ts', description: 'Current extraction helper.' },
    { kind: 'path', path: 'src/extraction/Pagination.ts', description: 'Current pagination helper.' },
    { kind: 'path', path: 'src/extraction/index.ts', description: 'Extraction barrel export.' },
    { kind: 'path', path: 'src/interaction/PageAdapter.ts', description: 'Page operations available to extraction helpers.' },
    { kind: 'path', path: 'src/errors/ExtractionError.ts', description: 'Typed extraction error.' },
    { kind: 'path', path: 'tests/unit/extraction/Extractor.test.ts', description: 'Extractor tests.' },
    { kind: 'path', path: 'tests/unit/extraction/Pagination.test.ts', description: 'Pagination tests.' },
    { kind: 'path', path: 'tests/fixtures/FakePage.ts', description: 'Fake page fixture.' },
    { kind: 'path', path: 'tests/fixtures/FakeCursor.ts', description: 'Fake cursor for pagination click tests.' }
  ],
  keywordContexts: [
    {
      keywords: ['actor', 'site', 'task', 'scraper'],
      context: [
        { kind: 'path', path: 'src/core/ActorContext.ts', description: 'Extraction helpers available in ActorContext.' },
        { kind: 'path', path: 'src/sites/example/example.actor.ts', description: 'Example actor usage of extraction.' }
      ]
    },
    {
      keywords: ['selector', 'wait', 'page adapter', 'raw puppeteer'],
      context: [
        { kind: 'path', path: 'tests/unit/interaction/PageAdapter.test.ts', description: 'PageAdapter behavior tests.' }
      ]
    }
  ],
  tooling: {
    allowGetExistingCode: true,
    allowFindFiles: true,
    allowSearchRepo: true
  }
};
