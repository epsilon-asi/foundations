# Component guide

## Prebuilt components

### `card(options)`

A general-purpose component for compact updates.

```ts
prebuilt.card({
  title: 'Daily report',
  body: 'All systems healthy.',
  severity: 'success',
  fields: [
    { label: 'Errors', value: 0 },
    { label: 'SLO', value: '99.99%' }
  ],
  actions: [{ text: 'View report', url: 'https://example.com/report' }]
});
```

### `alertCard(options)`

Best for monitoring and operational alerts.

```ts
prebuilt.alertCard({
  title: 'Queue depth high',
  message: 'billing-sync has more than 400 jobs pending.',
  severity: 'warning',
  source: 'queue-monitor',
  runbookUrl: 'https://runbooks.example.com/queue-depth'
});
```

### `imageAlert(options)`

Best for screenshots, camera frames, test artifacts, visual diffs, and generated previews.

```ts
prebuilt.imageAlert({
  title: 'Visual diff detected',
  message: 'Homepage visual regression exceeded threshold.',
  imageUrl: 'https://images.example.com/diff.png',
  altText: 'Visual diff highlighting a changed hero banner.',
  severity: 'warning'
});
```

### `chartImage(options)`

Best when the chart is pre-rendered by another service.

```ts
prebuilt.chartImage({
  title: 'Revenue trend',
  chartUrl: 'https://images.example.com/revenue.png',
  altText: 'Line chart showing revenue increasing over the week.',
  summary: 'Revenue is up 8% week over week.',
  metrics: [{ label: 'ARR', value: '$10M' }]
});
```

### `metricGrid(options)`

Best for a dense set of KPIs.

```ts
prebuilt.metricGrid({
  title: 'Service health',
  metrics: [
    { label: 'Uptime', value: 99.99, unit: '%', severity: 'success' },
    { label: 'Errors', value: 3, severity: 'warning' }
  ]
});
```

### `compactTable(options)`

Best for small lists. Keep rows short. Slack is not a spreadsheet.

```ts
prebuilt.compactTable({
  title: 'Top queues',
  columns: [
    { key: 'name', width: 12 },
    { key: 'depth', width: 8, align: 'right' }
  ],
  rows: [
    { name: 'billing', depth: 420 },
    { name: 'email', depth: 190 }
  ]
});
```

### `digest(options)`

Best for grouped updates and daily summaries.

```ts
prebuilt.digest({
  title: 'Release digest',
  items: [
    { title: 'API deployed', severity: 'success', url: 'https://example.com/1' },
    { title: 'Worker queued', text: 'Backlog growing', severity: 'warning' }
  ]
});
```

### `deploymentNotice(options)`

```ts
prebuilt.deploymentNotice({
  service: 'checkout-api',
  environment: 'production',
  version: '2026.05.20-1',
  status: 'succeeded',
  actor: '<@U123456>',
  commit: 'abc1234'
});
```

### `incidentUpdate(options)`

```ts
prebuilt.incidentUpdate({
  incidentId: 'INC-123',
  title: 'Checkout degraded',
  status: 'Investigating',
  summary: 'Payments are intermittently failing.',
  impact: 'Some customers cannot check out.',
  owner: 'payments',
  nextUpdateAt: '12:30 UTC'
});
```

### `approvalRequest(options)`

```ts
prebuilt.approvalRequest({
  title: 'Approve production deploy',
  requester: 'alice',
  reason: 'Deploying a hotfix for checkout failures.'
});
```

## Severity levels

Supported levels:

- `neutral`
- `info`
- `success`
- `warning`
- `danger`

Slack blocks do not have a reliable cross-client colored-card primitive, so this library uses compact severity emoji in headers instead of attachment colors.

## Component authoring rules

- Keep the final payload under 50 blocks.
- Keep messages skimmable; use fields and compact tables instead of long prose.
- Always provide meaningful `altText` for images and charts.
- Prefer action URLs for navigation and action IDs for interactive callbacks.
- Put domain-specific wording in custom components, not in generic primitives.
- Add a fallback text string that is useful in notifications.
