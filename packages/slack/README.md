# @epsilon-asi/slack

A generalized TypeScript framework for building compact, visually structured Slack messages with very little call-site code.

This package gives you:

- A composable `MessageBuilder` for assembling Slack Block Kit payloads.
- Prebuilt message components for alerts, cards, image alerts, chart images, metric grids, compact tables, digests, deployments, incidents, and approval requests.
- A `defineComponent` API so product teams can create their own reusable message components without hand-writing full Slack JSON every time.
- Transport adapters for `@slack/web-api` and Slack incoming webhooks.
- Validation against common Slack limits before messages are sent.
- ESM, CommonJS, and generated `.d.ts` output for private package publishing.

## Why this exists

Raw Slack Block Kit JSON gets repetitive quickly. Most internal Slack messages need the same UX patterns: a header, a short summary, a few facts, optional actions, and a safe fallback string for notifications and accessibility. This library turns those patterns into small, typed functions.

Instead of this at every call site:

```ts
const payload = {
  text: 'Checkout latency is high',
  blocks: [
    { type: 'header', text: { type: 'plain_text', text: '🚨 Checkout latency is high' } },
    { type: 'section', text: { type: 'mrkdwn', text: 'p95 crossed threshold.' } }
  ]
};
```

Use this:

```ts
import { message } from '@epsilon-asi/slack';

const payload = message()
  .alert({
    title: 'Checkout latency is high',
    message: 'p95 crossed threshold.',
    severity: 'danger'
  })
  .build();
```

## Slack compatibility notes

The library is intentionally Block Kit-first. It follows Slack's documented message model:

- Messages are built from `blocks` arrays.
- A message can include up to 50 blocks.
- `chat.postMessage` uses top-level `text` as the fallback string when blocks are present.
- Header text is capped at 150 characters.
- Section text is capped at 3,000 characters, and section fields are rendered compactly in two columns.
- Image blocks require `alt_text` and either `image_url` or `slack_file`.

See the official Slack docs:

- https://docs.slack.dev/block-kit/
- https://docs.slack.dev/reference/methods/chat.postMessage/
- https://docs.slack.dev/reference/block-kit/blocks/section-block/
- https://docs.slack.dev/reference/block-kit/blocks/image-block/
- https://docs.slack.dev/reference/block-kit/blocks/header-block/

## Installation

For private npm publishing, change the scope in `package.json` from `@epsilon-asi` to your real npm/GitHub Packages scope.

```bash
npm install @epsilon-asi/slack
```

For local development:

```bash
npm install
npm run verify
```

`npm run verify` performs type checking, production build, and coverage tests.

## Package exports

```ts
import { message, prebuilt, defineComponent, SlackMessenger } from '@epsilon-asi/slack';
import { alertCard, chartImage } from '@epsilon-asi/slack/prebuilt';
import { header, section, button } from '@epsilon-asi/slack/blocks';
```

The package builds all of these outputs:

- `dist/index.js` / `dist/index.cjs`
- `dist/prebuilt/index.js` / `dist/prebuilt/index.cjs`
- `dist/blocks/index.js` / `dist/blocks/index.cjs`
- Type declarations for all exports

## Basic usage

### Send a prebuilt alert

```ts
import { message } from '@epsilon-asi/slack';

const payload = message()
  .alert({
    title: 'Checkout latency is high',
    message: 'p95 checkout latency crossed 1.5s for 5 minutes.',
    severity: 'danger',
    source: 'datadog.checkout.latency',
    fields: [
      { label: 'p95', value: '1.8s' },
      { label: 'Threshold', value: '1.5s' },
      { label: 'Region', value: 'us-east-1' }
    ],
    runbookUrl: 'https://runbooks.example.com/checkout-latency',
    actions: [{ text: 'Open dashboard', url: 'https://dashboards.example.com/checkout' }]
  })
  .build();
```

### Compose several prebuilt components

```ts
import { compose } from '@epsilon-asi/slack';

const payload = compose({ unfurlLinks: false, unfurlMedia: false })
  .header('Morning ops snapshot')
  .metrics({
    title: 'Core KPIs',
    metrics: [
      { label: 'Availability', value: 99.99, unit: '%', severity: 'success' },
      { label: 'Error rate', value: 0.03, unit: '%', delta: '-0.01%', severity: 'success' },
      { label: 'Queue depth', value: 420, delta: '+80', severity: 'warning' }
    ],
    context: ['Window: last 24h']
  })
  .chart({
    title: 'Traffic by hour',
    chartUrl: 'https://images.example.com/charts/traffic.png',
    altText: 'Bar chart showing traffic increasing from 8 AM to noon.',
    summary: 'Traffic is 12% higher than yesterday, with no matching error spike.'
  })
  .build();
```

### Create a custom end-user component

```ts
import { defineComponent, message } from '@epsilon-asi/slack';

const customerHealth = defineComponent<{
  customer: string;
  plan: string;
  score: number;
  owner: string;
}>('customer.health', (props, { blocks }) => ({
  blocks: [
    blocks.header(`🏥 ${props.customer} health`),
    blocks.section({
      fields: [
        { label: 'Plan', value: props.plan },
        { label: 'Score', value: props.score },
        { label: 'Owner', value: props.owner }
      ]
    })
  ],
  fallbackText: `${props.customer} health score: ${props.score}`
}));

const payload = message()
  .add(customerHealth({ customer: 'Acme Co', plan: 'Enterprise', score: 92, owner: 'CSM Team' }))
  .build();
```

### Create a custom component by wrapping a prebuilt component

```ts
import { defineComponent, message, prebuilt } from '@epsilon-asi/slack';

const sloBreach = defineComponent<{
  service: string;
  sloName: string;
  current: string;
  target: string;
  dashboardUrl: string;
}>('slo.breach', (props) =>
  prebuilt.card({
    title: `${props.service} SLO breach`,
    body: `${props.sloName} is below target.`,
    severity: 'danger',
    fields: [
      { label: 'Current', value: props.current },
      { label: 'Target', value: props.target }
    ],
    actions: [{ text: 'Open SLO dashboard', url: props.dashboardUrl }]
  })
);

const payload = message()
  .add(sloBreach({
    service: 'payments-api',
    sloName: '99.9% successful authorization rate',
    current: '99.74%',
    target: '99.90%',
    dashboardUrl: 'https://slo.example.com/payments-api'
  }))
  .build();
```

## Sending messages

### With `@slack/web-api`

The package does not require `@slack/web-api` at runtime. Your app can pass any compatible client with `chat.postMessage`.

```ts
import { WebClient } from '@slack/web-api';
import { SlackMessenger, createWebApiTransport, prebuilt } from '@epsilon-asi/slack';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const slack = new SlackMessenger(createWebApiTransport(client));

await slack.send(
  'C0123456789',
  prebuilt.deploymentNotice({
    service: 'checkout-api',
    environment: 'production',
    version: '2026.05.20-1',
    status: 'succeeded',
    actor: '<@U123456>',
    commit: 'abc1234',
    url: 'https://deployments.example.com/checkout-api/2026.05.20-1'
  })
);
```

### With an incoming webhook

```ts
import { SlackMessenger, createIncomingWebhookTransport, prebuilt } from '@epsilon-asi/slack';

const slack = new SlackMessenger(
  createIncomingWebhookTransport(process.env.SLACK_WEBHOOK_URL!)
);

await slack.send('C0123456789', prebuilt.alertCard({
  title: 'Worker queue depth high',
  message: 'billing-sync is above 400 jobs.',
  severity: 'warning'
}));
```

## Prebuilt components

| Component | Purpose |
| --- | --- |
| `card` | General-purpose summary card with title, body, fields, context, thumbnail, actions. |
| `alertCard` | Severity-based alert with optional source, timestamp, runbook link, and actions. |
| `imageAlert` | Alert centered around an image or Slack file. Useful for screenshots, camera frames, and visual checks. |
| `chartImage` | Chart summary with image URL or Slack file, metrics, and actions. |
| `metricGrid` | Compact KPI/fact grid rendered as Slack section fields. |
| `compactTable` | Small monospaced table for lists where a full chart is overkill. |
| `digest` | Short list of updates with optional severity and links. |
| `deploymentNotice` | Service deployment status card. |
| `incidentUpdate` | Incident status update with impact, owner, and next update fields. |
| `approvalRequest` | Request card with approve/reject buttons. |

### Organization scenarios

| Component | Builder method | Purpose |
| --- | --- | --- |
| **People & communication** | | |
| `announcement` | `.announcement()` | Company or team announcement with optional image, author, and audience. |
| `eventInvite` | `.event()` | Event or meeting invite with When/Where/Host and RSVP, join, and calendar buttons. |
| `welcomeMessage` | `.welcome()` | New hire introduction with role, manager, buddy, and helpful links. |
| `kudos` | `.kudos()` | Peer recognition shout-out with an optional company value. |
| `celebration` | `.celebration()` | Birthday, work anniversary, promotion, or milestone post. |
| `poll` | `.poll()` | Quick poll with vote buttons and optional result bars. |
| `surveyRequest` | `.survey()` | Link-out survey request with length, due date, and anonymity. |
| `ratingRequest` | `.rating()` | Inline 1–5 star, 0–10 NPS, or thumbs feedback buttons. |
| `reminder` | `.reminder()` | Due or overdue reminder with done, snooze, and open buttons. |
| `policyAcknowledgement` | `.policy()` | Policy read-and-acknowledge request with a confirmation dialog. |
| `userProfile` | `.profile()` | Directory profile card with title, team, location, and contact details. |
| `trainingAssignment` | `.training()` | Assigned course with due date, progress bar, and start/continue button. |
| **Work & projects** | | |
| `taskAssignment` | `.task()` | Task assigned to someone, with priority, due date, and accept/view buttons. |
| `checklist` | `.checklist()` | Progress checklist (onboarding, launch, audit) with done/open items. |
| `standupSummary` | `.standup()` | Team standup roll-up with yesterday/today/blockers per person. |
| `meetingSummary` | `.meeting()` | Meeting recap with summary, decisions, action items, and notes/recording links. |
| `projectStatus` | `.project()` | Project health report with progress, highlights, risks, and next steps. |
| `goalProgress` | `.goals()` | OKR/goal progress with per-key-result progress bars. |
| `agenda` | `.agenda()` | Daily schedule or event agenda. |
| `documentShare` | `.document()` | Shared document or file link with metadata. |
| `leaderboard` | `.leaderboard()` | Ranked list with medals and rank changes. |
| **Engineering & IT** | | |
| `pullRequest` | `.pullRequest()` | Code review request or PR status with diff stats, branches, and labels. |
| `pipelineStatus` | `.pipeline()` | CI/CD pipeline run with stage results and retry/cancel buttons. |
| `errorReport` | `.error()` | Application error with message, stack trace, impact, and triage buttons. |
| `releaseNotes` | `.releaseNotes()` | Release announcement grouped into breaking, new, improvements, and fixes. |
| `onCallHandoff` | `.handoff()` | On-call shift handoff with open incidents and notes. |
| `maintenanceNotice` | `.maintenance()` | Scheduled, in-progress, or completed maintenance window. |
| `securityAlert` | `.security()` | Suspicious activity alert with "this was me" / "secure my account" buttons. |
| `accessRequest` | `.access()` | Access request approval for a system or resource. |
| **Sales, support & recruiting** | | |
| `dealUpdate` | `.deal()` | CRM deal update, win, or loss. |
| `supportTicket` | `.ticket()` | New or updated support ticket with SLA and assign-to-me button. |
| `customerFeedback` | `.feedback()` | Customer feedback with star rating and reply button. |
| `leadAlert` | `.lead()` | New or hot inbound lead with claim button. |
| `candidateUpdate` | `.candidate()` | Recruiting pipeline update with interview recommendation. |
| **Finance & operations** | | |
| `invoiceNotice` | `.invoice()` | Invoice sent, paid, or overdue with pay and reminder buttons. |
| `expenseApproval` | `.expense()` | Expense report approval. |
| `timeOffRequest` | `.timeOff()` | Time-off/PTO approval. |
| `budgetAlert` | `.budget()` | Spend vs. budget with automatic on-track/warning/over severity. |
| `orderUpdate` | `.order()` | Order status with items, total, and package tracking. |
| `inventoryAlert` | `.inventory()` | Low-stock or out-of-stock alert with reorder button. |

Shared helpers used by these components are also exported: `progressBar`, `clampPercent`, `formatMoney`, `bulletList`, `priorityLabel`, and the `Priority` type.

Run `npm run storybook` to preview every component, plus a catalog of every Slack Block Kit block and element, rendered the way Slack shows them.

## Validation behavior

`MessageBuilder.build()` validates by default. It throws `SlackKitValidationError` for errors such as:

- More than 50 blocks.
- Section blocks without text or fields.
- Header text beyond Slack's header limit.
- Image blocks without `alt_text` or an image source.
- Actions blocks without elements.

Disable validation only when you intentionally need to test or pass through custom future Slack block types:

```ts
const payload = message({ validate: false })
  .add({ type: 'future_block', experimental: true })
  .build({ text: 'Experimental message' });
```

## Development

```bash
npm install
npm run typecheck
npm run build
npm run coverage
npm run verify
```

Current verification status from this generated project:

- TypeScript typecheck: passing
- Build: passing
- Tests: 33 passing
- Coverage: statements 95.04%, branches 89.67%, lines 95.02%, functions 92.48%

## Private publishing

Change the scope and publish to your private registry:

```bash
npm pkg set name=@your-real-org/slack
npm publish --access restricted
```

For GitHub Packages, use `.npmrc.example` as the starting point.
