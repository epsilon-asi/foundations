import { message } from '../src';

export const payload = message()
  .alert({
    title: 'Checkout latency is high',
    message: 'p95 checkout latency crossed 1.5s for 5 minutes.',
    severity: 'danger',
    source: 'datadog.checkout.latency',
    timestamp: new Date('2026-05-20T12:00:00Z').toISOString(),
    fields: [
      { label: 'p95', value: '1.8s' },
      { label: 'Threshold', value: '1.5s' },
      { label: 'Region', value: 'us-east-1' }
    ],
    runbookUrl: 'https://runbooks.example.com/checkout-latency',
    actions: [{ text: 'Open dashboard', url: 'https://dashboards.example.com/checkout' }]
  })
  .build({ text: 'Checkout latency is high: p95 checkout latency crossed 1.5s.' });
