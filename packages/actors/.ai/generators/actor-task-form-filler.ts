export default {
  id: 'actor-task-form-filler',
  description: 'Add or update a site actor task that uses defineFormTask/defineFormFillerTask to fill listed fields and submit forms from typed input.',
  instructions: `
Generate a form-filler actor task using the core task generator helper.

Rules:
- Define the task with defineFormTask or defineFormFillerTask from src/core/Actor.ts.
- Keep the task inside actor.tasks on an existing site actor.
- Use typed input/output interfaces in src/sites/{{siteKebab}}/{{siteKebab}}.types.ts.
- Keep selectors in src/sites/{{siteKebab}}/{{siteKebab}}.selectors.ts.
- Prefer declarative field mapping via inputKey and use value resolvers only when needed.
- Mark optional fields with required: false.
- Use submit.waitForNavigation when submit triggers a page transition.
- Use onComplete to map final output when the task should return data.
- Keep actor logic site-specific; do not modify src/core unless the request explicitly requires framework changes.
- Add focused unit tests that verify field fill order, optional-field behavior, submit click, and completion output.

DO NOT call Puppeteer directly for form-filling flows that can be expressed with the form-task definition.
DO NOT hard-code credentials or secrets.
`.trim(),
  output: {
    pathTemplates: [
      {
        key: 'actor',
        pathTemplate: 'src/sites/{{siteKebab}}/{{siteKebab}}.actor.ts',
        description: 'Site actor task definition using defineFormTask/defineFormFillerTask.'
      },
      {
        key: 'selectors',
        pathTemplate: 'src/sites/{{siteKebab}}/{{siteKebab}}.selectors.ts',
        description: 'Form selectors used by the generated task.'
      },
      {
        key: 'types',
        pathTemplate: 'src/sites/{{siteKebab}}/{{siteKebab}}.types.ts',
        description: 'Input/output interfaces for the form task.'
      },
      {
        key: 'tests',
        pathTemplate: 'tests/unit/sites/{{siteKebab}}.{{taskName}}.test.ts',
        description: 'Focused form-task behavior tests.'
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
      description: 'Task name to add or update, for example submitContactForm or applyToJob.',
      required: true
    },
    instructions: {
      description: 'Form URL, selectors, field mapping, optional fields, submit behavior, and expected output.',
      required: false
    }
  },
  examples: [
    'src/core/Actor.ts',
    'src/sites/example/example.actor.ts',
    'src/sites/example/example.selectors.ts',
    'src/sites/example/example.types.ts',
    'tests/unit/core/defineActor.test.ts'
  ],
  context: [
    {
      kind: 'path',
      path: 'src/sites/{{siteKebab}}/{{siteKebab}}.actor.ts',
      description: 'Actor that owns the form task.',
      required: true
    },
    {
      kind: 'path',
      path: 'src/sites/{{siteKebab}}/{{siteKebab}}.selectors.ts',
      description: 'Form selectors used by the task.',
      required: false
    },
    {
      kind: 'path',
      path: 'src/sites/{{siteKebab}}/{{siteKebab}}.types.ts',
      description: 'Typed task input/output contracts.',
      required: false
    },
    {
      kind: 'path',
      path: 'src/core/Actor.ts',
      description: 'defineFormTask and defineFormFillerTask definitions.'
    },
    {
      kind: 'path',
      path: 'src/core/ActorContext.ts',
      description: 'Context services available to tasks and resolvers.'
    },
    {
      kind: 'path',
      path: 'tests/fixtures/makeContext.ts',
      description: 'Context fixture for deterministic unit tests.'
    },
    {
      kind: 'path',
      path: 'tests/fixtures/FakePage.ts',
      description: 'Fake page fixture for selector and navigation assertions.'
    },
    {
      kind: 'path',
      path: 'tests/fixtures/FakeCursor.ts',
      description: 'Fake cursor fixture for typed/click assertions.'
    }
  ],
  keywordContexts: [
    {
      keywords: ['optional', 'required false', 'nullable'],
      context: [
        {
          kind: 'path',
          path: 'src/core/Actor.ts',
          description: 'Form task required-field semantics.'
        }
      ]
    },
    {
      keywords: ['navigation', 'waitForNavigation', 'submit'],
      context: [
        {
          kind: 'path',
          path: 'src/core/Actor.ts',
          description: 'Submit behavior and navigation wait handling.'
        }
      ]
    }
  ],
  tooling: {
    allowGetExistingCode: true,
    allowFindFiles: true,
    allowSearchRepo: true
  }
};
