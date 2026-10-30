# Architecture

This library is intentionally split into four layers.

## 1. Block primitives: `src/blocks`

The block layer creates raw Slack Block Kit JSON with guardrails:

- `header()`
- `section()`
- `context()`
- `image()`
- `imageElement()`
- `button()`
- `actions()`
- `fieldSections()`

These helpers are thin and predictable. They do not know about business concepts like incidents or deployments. They only know how to create valid Slack-ish block objects and truncate common fields to Slack-compatible lengths.

Use these when creating low-level custom components.

## 2. Component framework: `src/core/component.ts`

A component is a named renderer that returns blocks and optional fallback text.

```ts
const myComponent = defineComponent<Props>('my.component', (props, { blocks }) => ({
  blocks: [blocks.header(props.title)],
  fallbackText: props.title
}));
```

Components are intentionally pure. They do not send messages and should not perform network calls. This makes them easy to test and reuse across services.

## 3. Prebuilt components: `src/prebuilt`

The prebuilt layer is where reusable, high-level message patterns live:

- Generic card
- Alert card
- Image alert
- Chart image
- Metric grid
- Compact table
- Digest
- Deployment notice
- Incident update
- Approval request
- Organization scenarios: people and communication (announcements, events, welcomes, kudos, celebrations, polls, surveys, ratings, reminders, policies, profiles, training), work and projects (tasks, checklists, standups, meetings, project status, goals, agendas, documents, leaderboards), engineering and IT (pull requests, pipelines, errors, release notes, on-call handoffs, maintenance, security, access requests), sales, support and recruiting (deals, tickets, feedback, leads, candidates), and finance and operations (invoices, expenses, time off, budgets, orders, inventory)

Prebuilt components should accept a small number of domain-friendly parameters and return a polished Slack layout.

## 4. Builder and transports: `src/core`

`MessageBuilder` composes components and primitives into a `SlackMessagePayload`.

`SlackMessenger` sends payloads through a transport. The two included transports are:

- `createWebApiTransport(client)` for `@slack/web-api` or compatible clients.
- `createIncomingWebhookTransport(url, fetchImpl?)` for incoming webhook URLs.

The transport layer is deliberately small so internal platforms can add their own delivery layer, retry policy, observability, or queueing outside this library.

## Design principles

1. **Small call-site surface area**: callers should usually pass 3-8 parameters, not 100 lines of JSON.
2. **Pure rendering**: components render blocks; transports send blocks.
3. **Good defaults**: fallback text, truncation, compact fields, and severity emojis are automatic.
4. **Extensible without forks**: teams can use `defineComponent` for their own domain-specific cards.
5. **No hard Slack SDK runtime dependency**: the package can be used with `@slack/web-api`, webhooks, queue workers, or test stubs.

## Adding a new prebuilt component

1. Create `src/prebuilt/myComponent.ts`.
2. Define an options interface with friendly parameters.
3. Implement a pure render function.
4. Wrap it with `defineComponent` unless it is a thin wrapper around an existing component.
5. Export it from `src/prebuilt/index.ts`.
6. Add tests covering default, optional, and edge branches.
7. Add a README/docs example.

Preferred shape:

```ts
import { defineComponent, type RenderedComponent } from '../core/component';

export interface MyComponentOptions {
  title: string;
  summary?: string;
}

function renderMyComponent(options: MyComponentOptions): RenderedComponent {
  return {
    blocks: [/* ... */],
    fallbackText: options.title
  };
}

export const myComponent = defineComponent<MyComponentOptions>('prebuilt.myComponent', renderMyComponent);
```
