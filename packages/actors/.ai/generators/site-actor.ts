export default {
  id: 'site-actor',
  description: 'Create or update a website-specific actor, selector map, types, barrel exports, and focused unit tests.',
  instructions: `
Generate a site actor that follows the existing framework conventions.

Rules:
- Use defineActor from src/core/defineActor.ts.
- Keep selectors in src/sites/{{siteKebab}}/{{siteKebab}}.selectors.ts.
- Keep task input/output types in src/sites/{{siteKebab}}/{{siteKebab}}.types.ts.
- Export the site through src/sites/{{siteKebab}}/index.ts and src/sites/index.ts.
- Prefer context.nav, context.forms, context.cursor, context.extract, and context.pagination over raw Puppeteer APIs.
- Use context.page.raw() only when the abstraction does not support the needed operation.
- Never hard-code credentials or secrets.
- If login is required, use defineLoginFlow and the typed LoginFlowDefinition shape.
- If the task scrapes data, use Extractor/Pagination helpers before inventing new extraction logic.
- Add or update focused unit tests when behavior is non-trivial.
- Keep actor tasks small and named by what they do, for example scrapeDashboard or scrapeListings.
- Update barrel exports when adding a new site.

DO NOT INVENT selectors that were not supplied by the user unless the instructions explicitly say to make placeholders.
DO NOT add CAPTCHA bypass, anti-bot evasion, or credential harvesting behavior.
`.trim(),
  output: {
    pathTemplates: [
      {
        key: 'actor',
        pathTemplate: 'src/sites/{{siteKebab}}/{{siteKebab}}.actor.ts',
        description: 'The site actor with auth definition, hooks, and task implementations.'
      },
      {
        key: 'selectors',
        pathTemplate: 'src/sites/{{siteKebab}}/{{siteKebab}}.selectors.ts',
        description: 'Site-specific CSS selector constants grouped by page/flow.'
      },
      {
        key: 'types',
        pathTemplate: 'src/sites/{{siteKebab}}/{{siteKebab}}.types.ts',
        description: 'Task input/output types for this site.'
      },
      {
        key: 'site-index',
        pathTemplate: 'src/sites/{{siteKebab}}/index.ts',
        description: 'Per-site barrel exports.'
      },
      {
        key: 'sites-index',
        pathTemplate: 'src/sites/index.ts',
        description: 'Global sites barrel export; add this site export if needed.'
      },
      {
        key: 'tests',
        pathTemplate: 'tests/unit/sites/{{siteKebab}}.actor.test.ts',
        description: 'Focused unit tests for task behavior or auth config when useful.'
      }
    ],
    maxFiles: 6
  },
  parameters: {
    site: {
      description: 'The website/site name, for example Apple, Upwork, Example Marketplace, or Acme Dashboard.',
      required: true
    },
    actorId: {
      description: 'Actor id used at runtime. Defaults to the kebab-case site name when omitted.',
      required: false
    },
    baseUrl: {
      description: 'The site base URL, for example https://example.com.',
      required: false
    },
    instructions: {
      description: 'Specific login, task, selector, or scraping behavior to implement.',
      required: false
    }
  },
  examples: [
    'src/sites/example/example.actor.ts',
    'src/sites/example/example.selectors.ts',
    'src/sites/example/example.types.ts',
    'src/sites/example/index.ts',
    'src/sites/index.ts'
  ],
  context: [
    { kind: 'path', path: 'src/core/defineActor.ts', description: 'Helper used to define actors.' },
    { kind: 'path', path: 'src/core/Actor.ts', description: 'Actor/task/hook contracts.' },
    { kind: 'path', path: 'src/core/ActorContext.ts', description: 'Task context available to actor implementations.' },
    { kind: 'path', path: 'src/sites/example/example.actor.ts', description: 'Canonical example actor.' },
    { kind: 'path', path: 'src/sites/example/example.selectors.ts', description: 'Canonical selector map.' },
    { kind: 'path', path: 'src/sites/example/example.types.ts', description: 'Canonical site task types.' },
    { kind: 'path', path: 'src/auth/LoginFlow.types.ts', description: 'Auth/login configuration types.' },
    { kind: 'path', path: 'src/extraction/Extractor.ts', description: 'Reusable extraction helper.' },
    { kind: 'path', path: 'src/extraction/Pagination.ts', description: 'Reusable pagination helper.' },
    { kind: 'path', path: 'src/sites/index.ts', description: 'Global site export pattern.' }
  ],
  keywordContexts: [
    {
      keywords: ['login', 'auth', 'sign in', 'signin', 'multi-step', 'username', 'password'],
      context: [
        { kind: 'path', path: 'src/auth/LoginFlow.ts', description: 'Login execution behavior.' },
        { kind: 'path', path: 'tests/unit/auth/LoginFlow.test.ts', description: 'Login config/test examples.' }
      ]
    },
    {
      keywords: ['scrape', 'extract', 'pagination', 'next page', 'table', 'href', 'jsonld'],
      context: [
        { kind: 'path', path: 'tests/unit/extraction/Extractor.test.ts', description: 'Extractor behavior examples.' },
        { kind: 'path', path: 'tests/unit/extraction/Pagination.test.ts', description: 'Pagination behavior examples.' }
      ]
    },
    {
      keywords: ['form', 'type', 'click', 'navigation', 'wait', 'selector'],
      context: [
        { kind: 'path', path: 'src/interaction/Forms.ts', description: 'Form filler helper.' },
        { kind: 'path', path: 'src/interaction/Navigation.ts', description: 'Navigation helper.' },
        { kind: 'path', path: 'src/interaction/PageAdapter.ts', description: 'Page wrapper methods available to actors.' }
      ]
    }
  ],
  tooling: {
    allowGetExistingCode: true,
    allowFindFiles: true,
    allowSearchRepo: true
  }
};
