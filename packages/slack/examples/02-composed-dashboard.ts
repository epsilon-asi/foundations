
import { compose } from '../src';

export const payload = compose({ unfurlLinks: false, unfurlMedia: false })
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
    chartUrl: 'https://images.example.com/charts/traffic-2026-05-20.png',
    altText: 'Bar chart showing traffic increasing from 8 AM to noon.',
    summary: 'Traffic is 12% higher than yesterday, with no matching error spike.',
    actions: [{ text: 'Open analytics', url: 'https://analytics.example.com/traffic' }]
  })
  .table({
    title: 'Highest-volume queues',
    columns: [
      { key: 'queue', label: 'Queue', width: 16 },
      { key: 'depth', label: 'Depth', width: 8, align: 'right' },
      { key: 'age', label: 'Oldest', width: 8, align: 'right' }
    ],
    rows: [
      { queue: 'billing-sync', depth: 420, age: '4m' },
      { queue: 'email-send', depth: 190, age: '2m' }
    ]
  })
  .build();
