import type { Meta, StoryObj } from '@storybook/react-vite';

import { compose, defineComponent, message } from '../src';
import { renderNothing, SAMPLE_IMAGE, slackPreview } from './support';

/**
 * This package's own builders and prebuilt components, rendered as Slack
 * would show them. Stories import from `../src` so they always reflect the
 * current source; nothing here is part of the published build.
 */
const meta = {
  title: 'Package/Core Components',
  render: renderNothing
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const AlertCard: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .alert({
          title: 'Checkout latency is high',
          message: 'p95 checkout latency crossed 1.5s for 5 minutes.',
          severity: 'danger',
          source: 'datadog.checkout.latency',
          timestamp: '2026-05-20T12:00:00Z',
          fields: [
            { label: 'p95', value: '1.8s' },
            { label: 'Threshold', value: '1.5s' },
            { label: 'Region', value: 'us-east-1' }
          ],
          runbookUrl: 'https://runbooks.example.com/checkout-latency',
          actions: [{ text: 'Open dashboard', url: 'https://dashboards.example.com/checkout' }]
        })
        .build()
    )
  }
};

export const ImageAlert: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .imageAlert({
          title: 'Disk usage forecast',
          message: 'db-primary will reach 90% disk in ~3 days at the current growth rate.',
          severity: 'warning',
          imageUrl: SAMPLE_IMAGE,
          altText: 'Disk usage trend',
          imageTitle: 'Disk usage, last 14 days',
          caption: 'Forecast based on a 7-day linear trend.',
          actions: [{ text: 'Open capacity plan', url: 'https://capacity.example.com/db-primary' }]
        })
        .build()
    )
  }
};

export const ApprovalRequest: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .approval({
          title: 'Production database access',
          requester: 'Ada Lovelace',
          reason: 'Investigate the failed billing migration for account 4821.',
          fields: [
            { label: 'Duration', value: '2 hours' },
            { label: 'Scope', value: 'read-only' }
          ]
        })
        .build()
    )
  }
};

export const DeploymentSucceeded: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .deployment({
          service: 'payments-api',
          environment: 'production',
          version: '2.7.0',
          status: 'succeeded',
          actor: 'release-bot',
          commit: 'a1b2c3d',
          url: 'https://deploys.example.com/payments-api/2.7.0'
        })
        .build()
    )
  }
};

export const DeploymentFailed: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .deployment({
          service: 'search-indexer',
          environment: 'staging',
          version: '1.12.3',
          status: 'failed',
          actor: 'Grace Hopper',
          url: 'https://deploys.example.com/search-indexer/1.12.3'
        })
        .build()
    )
  }
};

export const IncidentUpdate: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .incident({
          incidentId: 'INC-2041',
          title: 'Elevated login errors',
          status: 'Mitigating',
          severity: 'danger',
          summary: 'A bad config push is rejecting ~8% of SSO logins. Rollback in progress.',
          impact: 'Some users cannot sign in via SSO.',
          owner: 'Identity on-call',
          startedAt: '2026-10-30 14:05 UTC',
          nextUpdateAt: '2026-10-30 14:45 UTC',
          actions: [{ text: 'Join incident channel', url: 'https://slack.example.com/inc-2041' }]
        })
        .build()
    )
  }
};

export const Digest: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .digest({
          title: 'Overnight summary',
          items: [
            { title: 'Nightly backup', text: 'Completed in 42 minutes.', severity: 'success' },
            { title: 'Queue backlog', text: 'email-send peaked at 1.2k messages.', severity: 'warning' },
            { title: 'Cert renewal', text: 'api.example.com renews in 12 days.', severity: 'info' },
            { title: 'Release notes', url: 'https://example.com/releases/2.7.0' }
          ],
          actions: [{ text: 'Open status page', url: 'https://status.example.com' }]
        })
        .build()
    )
  }
};

export const ComposedOpsDashboard: Story = {
  parameters: {
    slackBlocks: slackPreview(
      compose({ unfurlLinks: false, unfurlMedia: false })
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
          chartUrl: SAMPLE_IMAGE,
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
        .build()
    )
  }
};

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

export const CustomComponent: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .add(customerHealth({ customer: 'Acme Co', plan: 'Enterprise', score: 92, owner: 'CSM Team' }))
        .divider()
        .context(['Custom components are defined with `defineComponent()`.'])
        .build()
    )
  }
};
