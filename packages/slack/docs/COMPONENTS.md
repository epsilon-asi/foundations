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

## Organization scenario components

Each component below also has a `MessageBuilder` method (shown in parentheses) that wraps it.

### People and communication

#### `announcement(options)` (`.announcement()`)

```ts
prebuilt.announcement({
  title: 'Office move',
  body: 'We move to the new building on Monday.',
  author: 'Workplace team',
  audience: 'HQ staff',
  imageUrl: 'https://images.example.com/office.png',
  actions: [{ text: 'Read the FAQ', url: 'https://example.com/faq' }]
});
```

#### `eventInvite(options)` (`.event()`)

Adds Going / Maybe / Can't go buttons unless `rsvp: false`. Action IDs are prefixed with a slug of `eventId` (or the title).

```ts
prebuilt.eventInvite({
  title: 'Q4 all hands',
  startsAt: 'Nov 3, 10:00',
  endsAt: '11:00',
  location: 'Main hall',
  eventId: 'q4-all-hands',
  videoUrl: 'https://meet.example.com/all-hands',
  calendarUrl: 'https://calendar.example.com/event/123'
});
```

#### `welcomeMessage(options)` (`.welcome()`)

```ts
prebuilt.welcomeMessage({
  name: 'Sam Rivera',
  role: 'Product Designer',
  team: 'Growth',
  manager: 'Jordan Lee',
  buddy: 'Priya N.',
  resources: [{ label: 'Handbook', url: 'https://example.com/handbook' }]
});
```

#### `kudos(options)` (`.kudos()`)

```ts
prebuilt.kudos({ recipient: 'Dana', from: 'Chris', message: 'Shipped the migration early!', value: 'Ownership' });
```

#### `celebration(options)` (`.celebration()`)

`occasion` is `birthday`, `work_anniversary` (use `years`), `promotion` (use `newRole`), or `milestone`. Override the defaults with `title` or `message`.

```ts
prebuilt.celebration({ name: 'Kim', occasion: 'work_anniversary', years: 5 });
```

#### `poll(options)` (`.poll()`)

Each option gets a Vote button (`<pollId>_vote_<n>`) unless `allowVoting: false`. Set `showResults` to draw result bars.

```ts
prebuilt.poll({
  question: 'Where should we hold the offsite?',
  pollId: 'offsite',
  showResults: true,
  options: [{ label: 'Lisbon', votes: 6 }, { label: 'Denver', votes: 3 }]
});
```

#### `surveyRequest(options)` (`.survey()`)

```ts
prebuilt.surveyRequest({ title: 'Engagement survey', surveyUrl: 'https://example.com/survey', estimatedMinutes: 5, dueDate: 'Nov 10', anonymous: true });
```

#### `ratingRequest(options)` (`.rating()`)

`scale` is `stars` (1–5, default), `nps` (0–10), or `thumbs`. Buttons use `<requestId>_rate_<value>` action IDs.

```ts
prebuilt.ratingRequest({ question: 'How likely are you to recommend us?', scale: 'nps', requestId: 'nps-q4' });
```

#### `reminder(options)` (`.reminder()`)

```ts
prebuilt.reminder({ title: 'Submit your timesheet', dueAt: 'Today 17:00', overdue: true, url: 'https://example.com/timesheet' });
```

#### `policyAcknowledgement(options)` (`.policy()`)

The acknowledge button asks for confirmation. Pass `acknowledged: true` to show the completed state.

```ts
prebuilt.policyAcknowledgement({
  policyName: 'Code of conduct',
  summary: 'Updated for 2027.',
  documentUrl: 'https://example.com/coc',
  dueDate: 'Dec 15',
  policyId: 'coc-2027'
});
```

#### `userProfile(options)` (`.profile()`)

```ts
prebuilt.userProfile({ name: 'Morgan Diaz', title: 'Engineering Manager', department: 'Platform', email: 'morgan@example.com', profileUrl: 'https://example.com/people/morgan' });
```

#### `trainingAssignment(options)` (`.training()`)

```ts
prebuilt.trainingAssignment({ course: 'Security awareness', courseUrl: 'https://example.com/course', dueDate: 'Nov 30', required: true, progress: 40 });
```

### Work and projects

#### `taskAssignment(options)` (`.task()`)

`priority` (`low`, `medium`, `high`, `urgent`) sets the header severity.

```ts
prebuilt.taskAssignment({ title: 'Prepare board deck', assignee: 'Riley', dueDate: 'Nov 12', priority: 'high', url: 'https://example.com/task/1', taskId: 'TASK-1' });
```

#### `checklist(options)` (`.checklist()`)

```ts
prebuilt.checklist({
  title: 'New hire onboarding',
  items: [{ text: 'Laptop setup', done: true, owner: 'IT' }, { text: 'Read handbook', url: 'https://example.com/handbook' }]
});
```

#### `standupSummary(options)` (`.standup()`)

```ts
prebuilt.standupSummary({
  team: 'Platform',
  date: 'Oct 30',
  entries: [{ person: 'Ana', yesterday: 'Fixed flaky test', today: 'Caching', blockers: 'Waiting on review' }]
});
```

#### `meetingSummary(options)` (`.meeting()`)

```ts
prebuilt.meetingSummary({
  title: 'Roadmap review',
  summary: 'Agreed on Q1 scope.',
  decisions: ['Ship search v2'],
  actionItems: [{ owner: 'Ana', task: 'Write spec', dueDate: 'Nov 5' }],
  notesUrl: 'https://example.com/notes'
});
```

#### `projectStatus(options)` (`.project()`)

`health` is `on_track`, `at_risk`, `off_track`, `completed`, or `paused`.

```ts
prebuilt.projectStatus({ project: 'Billing migration', health: 'at_risk', progress: 64, risks: ['Vendor API delayed'], url: 'https://example.com/project' });
```

#### `goalProgress(options)` (`.goals()`)

```ts
prebuilt.goalProgress({
  objective: 'Delight new customers',
  period: 'Q4 2026',
  keyResults: [{ title: 'Activation rate', progress: 80, current: '42%', target: '50%' }]
});
```

#### `agenda(options)` (`.agenda()`)

```ts
prebuilt.agenda({ title: 'Offsite day 1', date: 'Nov 4', items: [{ time: '09:00', title: 'Breakfast', location: 'Lobby' }] });
```

#### `documentShare(options)` (`.document()`)

```ts
prebuilt.documentShare({ title: 'FY27 plan', url: 'https://example.com/doc', documentType: 'Doc', sharedBy: 'Avery' });
```

#### `leaderboard(options)` (`.leaderboard()`)

```ts
prebuilt.leaderboard({ title: 'Top closers', metric: 'deals', entries: [{ name: 'Ana', score: 12, change: 2 }, { name: 'Ben', score: 9 }] });
```

### Engineering and IT

#### `pullRequest(options)` (`.pullRequest()`)

```ts
prebuilt.pullRequest({
  repository: 'acme/web',
  number: 482,
  title: 'Add dark mode',
  author: 'Ana',
  url: 'https://git.example.com/acme/web/pull/482',
  reviewers: ['Ben'],
  additions: 120,
  deletions: 30
});
```

#### `pipelineStatus(options)` (`.pipeline()`)

Failed runs get a Retry button; pending or running runs get Cancel.

```ts
prebuilt.pipelineStatus({
  pipeline: 'web-ci',
  status: 'failed',
  branch: 'main',
  stages: [{ name: 'Build', status: 'passed' }, { name: 'Test', status: 'failed' }],
  url: 'https://ci.example.com/run/77'
});
```

#### `errorReport(options)` (`.error()`)

Stack traces are trimmed to `maxStackLines` (default 12).

```ts
prebuilt.errorReport({ title: 'TypeError in checkout', service: 'checkout-web', environment: 'production', message: 'Cannot read properties of undefined', occurrences: 1204, url: 'https://errors.example.com/9' });
```

#### `releaseNotes(options)` (`.releaseNotes()`)

```ts
prebuilt.releaseNotes({ product: 'Acme App', version: 'v3.2.0', features: ['Dark mode'], fixes: ['Login loop'], url: 'https://example.com/changelog' });
```

#### `onCallHandoff(options)` (`.handoff()`)

```ts
prebuilt.onCallHandoff({ rotation: 'Platform', from: 'Ana', to: 'Ben', openIncidents: [{ id: 'INC-1', title: 'Elevated 5xx', severity: 'danger' }] });
```

#### `maintenanceNotice(options)` (`.maintenance()`)

```ts
prebuilt.maintenanceNotice({ title: 'Database upgrade', status: 'scheduled', startsAt: 'Sat 02:00 UTC', endsAt: '04:00 UTC', services: ['API'] });
```

#### `securityAlert(options)` (`.security()`)

```ts
prebuilt.securityAlert({ title: 'New sign-in detected', description: 'A sign-in from a new device.', ipAddress: '203.0.113.7', location: 'Lisbon, PT', alertId: 'sec-42' });
```

#### `accessRequest(options)` (`.access()`)

```ts
prebuilt.accessRequest({ requester: 'Cy', resource: 'prod-db', accessLevel: 'read-only', justification: 'Debug billing issue', duration: '4 hours' });
```

### Sales, support, and recruiting

#### `dealUpdate(options)` (`.deal()`)

```ts
prebuilt.dealUpdate({ dealName: 'Enterprise renewal', account: 'Northwind', amount: 125000, stage: 'Closed won', outcome: 'won' });
```

#### `supportTicket(options)` (`.ticket()`)

```ts
prebuilt.supportTicket({ ticketId: 'SUP-1042', subject: 'Cannot export CSV', requester: 'Lee', priority: 'urgent', url: 'https://support.example.com/1042' });
```

#### `customerFeedback(options)` (`.feedback()`)

```ts
prebuilt.customerFeedback({ customer: 'Contoso', comment: 'Love the new dashboard!', rating: 5, source: 'In-app survey' });
```

#### `leadAlert(options)` (`.lead()`)

Scores at or above `hotScore` (default 80) are flagged as hot leads.

```ts
prebuilt.leadAlert({ name: 'Jamie Fox', company: 'Fabrikam', email: 'jamie@example.com', score: 92 });
```

#### `candidateUpdate(options)` (`.candidate()`)

```ts
prebuilt.candidateUpdate({ candidate: 'Jordan Park', role: 'Senior Backend Engineer', stage: 'Onsite complete', recommendation: 'strong_yes' });
```

### Finance and operations

#### `invoiceNotice(options)` (`.invoice()`)

```ts
prebuilt.invoiceNotice({ invoiceNumber: 'INV-2041', customer: 'Northwind', amount: 4800, status: 'overdue', payUrl: 'https://pay.example.com/2041' });
```

#### `expenseApproval(options)` (`.expense()`)

```ts
prebuilt.expenseApproval({ employee: 'Ana', amount: 842.1, category: 'Travel', description: 'Flight to customer onsite.', reportId: 'EXP-9' });
```

#### `timeOffRequest(options)` (`.timeOff()`)

```ts
prebuilt.timeOffRequest({ employee: 'Ben', type: 'Vacation', startDate: 'Nov 3', endDate: 'Nov 7', days: 5 });
```

#### `budgetAlert(options)` (`.budget()`)

Severity is computed from spend: over 100% is `danger`, at or above `warningThreshold` (default 80%) is `warning`.

```ts
prebuilt.budgetAlert({ budgetName: 'Cloud spend', spent: 12500, budget: 10000, period: 'October' });
```

#### `orderUpdate(options)` (`.order()`)

```ts
prebuilt.orderUpdate({ orderId: '#100245', status: 'shipped', items: [{ name: 'Desk lamp', quantity: 2, price: 39.99 }], trackingNumber: '1Z999', trackingUrl: 'https://track.example.com/1Z999' });
```

#### `inventoryAlert(options)` (`.inventory()`)

```ts
prebuilt.inventoryAlert({ product: 'Ergonomic chair', sku: 'CHR-01', onHand: 3, reorderPoint: 10 });
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
