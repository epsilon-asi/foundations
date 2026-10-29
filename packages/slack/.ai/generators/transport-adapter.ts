export default {
  id: 'transport-adapter',
  description:
    'Generate or update Slack delivery transports and SlackMessenger send behavior using existing adapter, validation, and mocked test conventions.',

  instructions: `
Generate or update a Slack transport adapter or sending behavior.

Repository-specific rules:
- Inspect src/core/transport.ts and tests/transport.test.ts before writing.
- Keep transports small and dependency-light; this package should not require @slack/web-api at runtime.
- Accept compatible client/fetch interfaces instead of hard-binding to concrete SDK implementations unless explicitly requested.
- Validate outgoing SlackMessagePayloads before sending.
- Do not make real network calls in tests.
- Normalize raw transport responses into SlackSendResult consistently.
- Preserve threadTs, replyBroadcast, channel, fallback text, and buildable/component input behavior.
- Do not hardcode webhook URLs, bot tokens, or secrets.
- Add tests for success, failure, bad constructor arguments, and request payload shape.
- Update README/examples only if the adapter is part of the public API.

General safety rules:
- Follow existing repo patterns.
- Use existing imports, naming, function style, and test style.
- Do not invent Slack Web API response fields or undocumented payload properties.
- Do not weaken validation, auth, or error handling.
- Keep outputs minimal and focused.
- Do not touch unrelated files.
- Run or describe the relevant typecheck/test command after changes.

Additional user instructions:
{{instructions}}
`.trim(),

  output: {
    pathTemplates: [
      {
        key: 'transport',
        pathTemplate: 'src/core/transport.ts',
        description: 'SlackMessenger and transport adapter implementation. Split only if the repo convention changes.',
      },
      {
        key: 'test',
        pathTemplate: 'tests/transport.test.ts',
        description: 'Mocked transport tests.',
      },
      {
        key: 'root-index',
        pathTemplate: 'src/index.ts',
        description: 'Public export surface; update only for new public adapters or types.',
      },
      {
        key: 'docs',
        pathTemplate: 'README.md',
        description: 'Sending messages documentation; update only if public usage changes.',
      },
      {
        key: 'example',
        pathTemplate: 'examples/{{nameKebab}}.ts',
        description: 'Transport usage example if requested or public-facing.',
      },
    ],
    maxFiles: 5,
  },

  parameters: {
    name: {
      description: 'Transport or sending workflow name, for example incoming-webhook, web-api, queue, or retrying-web-api.',
      required: true,
    },
    instructions: {
      description: 'Client shape, response normalization, retry behavior, threading, or error handling requirements.',
      required: false,
    },
  },

  examples: [
    'src/core/transport.ts',
    'tests/transport.test.ts',
    'examples/05-send-with-web-api.ts',
  ],

  context: [
    {
      kind: 'path',
      path: 'src/core/transport.ts',
      description: 'Current SlackMessenger, Web API transport, webhook transport, and send input normalization.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/core/builder.ts',
      description: 'BuildOptions and createMessage behavior used by SlackMessenger.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/core/validation.ts',
      description: 'Message validation before send.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/types/slack.ts',
      description: 'Slack message payload and postMessage type definitions.',
      required: false,
    },
    {
      kind: 'path',
      path: 'tests/transport.test.ts',
      description: 'Transport test conventions with fake clients/fetch implementations.',
      required: false,
    },
  ],

  keywordContexts: [
    {
      keywords: ['webhook', 'incoming webhook', 'fetch', 'http'],
      description: 'Incoming webhook fetch adapter behavior.',
      context: [
        {
          kind: 'path',
          path: 'src/core/transport.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'tests/transport.test.ts',
          required: false,
        },
      ],
    },
    {
      keywords: ['web api', 'chat.postMessage', 'slack sdk', '@slack/web-api'],
      description: 'Slack Web API compatible adapter behavior.',
      context: [
        {
          kind: 'path',
          path: 'src/core/transport.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'examples/05-send-with-web-api.ts',
          required: false,
        },
      ],
    },
    {
      keywords: ['thread', 'reply', 'reply broadcast', 'thread_ts'],
      description: 'Thread and reply broadcast payload behavior.',
      context: [
        {
          kind: 'path',
          path: 'src/core/transport.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'tests/transport.test.ts',
          required: false,
        },
      ],
    },
  ],

  tooling: {
    allowGetExistingCode: true,
    allowFindFiles: true,
    allowSearchRepo: true,
  },
};
