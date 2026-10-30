import type { Meta, StoryObj } from '@storybook/react-vite';

import { message } from '../src';
import { renderNothing, slackPreview } from './support';

/**
 * Engineering, DevOps, and IT components from `@epsilon-asi/slack`.
 */
const meta = {
  title: 'Package/Engineering & IT',
  render: renderNothing
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const PullRequestReview: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .pullRequest({
          repository: 'acme/web',
          number: 482,
          title: 'Add dark mode toggle to settings',
          author: 'Ana Silva',
          url: 'https://git.example.com/acme/web/pull/482',
          state: 'open',
          description: 'Adds a theme toggle, persists the preference, and respects the OS setting by default.',
          reviewers: ['Ben', 'Cy'],
          additions: 412,
          deletions: 87,
          filesChanged: 14,
          headBranch: 'feat/dark-mode',
          baseBranch: 'main',
          labels: ['frontend', 'accessibility']
        })
        .build()
    )
  }
};

export const PullRequestMerged: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .pullRequest({
          repository: 'acme/api',
          number: 1290,
          title: 'Rate limit the export endpoint',
          author: 'Ben Ito',
          url: 'https://git.example.com/acme/api/pull/1290',
          state: 'merged',
          additions: 58,
          deletions: 4,
          filesChanged: 3
        })
        .build()
    )
  }
};

export const PipelineFailed: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .pipeline({
          pipeline: 'web-ci',
          status: 'failed',
          branch: 'main',
          commit: 'a1b2c3d',
          triggeredBy: 'Ana Silva',
          duration: '6m 12s',
          runId: 'run-4821',
          url: 'https://ci.example.com/runs/4821',
          stages: [
            { name: 'Install', status: 'passed', duration: '41s' },
            { name: 'Lint', status: 'passed', duration: '22s' },
            { name: 'Unit tests', status: 'failed', duration: '3m 02s' },
            { name: 'Deploy preview', status: 'skipped' }
          ]
        })
        .build()
    )
  }
};

export const PipelineRunning: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .pipeline({
          pipeline: 'api-deploy',
          status: 'running',
          branch: 'release/2.7',
          commit: '9f8e7d6',
          runId: 'run-4822',
          url: 'https://ci.example.com/runs/4822',
          stages: [
            { name: 'Build image', status: 'passed', duration: '2m 10s' },
            { name: 'Canary 5%', status: 'running' },
            { name: 'Full rollout', status: 'pending' }
          ]
        })
        .build()
    )
  }
};

export const ErrorReport: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .error({
          title: 'TypeError in checkout',
          service: 'checkout-web',
          environment: 'production',
          level: 'error',
          message: "TypeError: Cannot read properties of undefined (reading 'total')",
          stackTrace: [
            'at computeTotals (cart/totals.ts:42:18)',
            'at CheckoutSummary (checkout/Summary.tsx:88:9)',
            'at renderWithHooks (react-dom.js:15486:18)',
            'at mountIndeterminateComponent (react-dom.js:20103:13)'
          ].join('\n'),
          occurrences: 1204,
          usersAffected: 311,
          firstSeen: '10:02 UTC',
          lastSeen: '10:41 UTC',
          url: 'https://errors.example.com/issues/ERR-9',
          issueId: 'ERR-9'
        })
        .build()
    )
  }
};

export const ReleaseNotes: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .releaseNotes({
          product: 'Acme App',
          version: 'v3.2.0',
          date: 'Oct 30, 2026',
          summary: 'A faster, friendlier release with dark mode and saved searches.',
          breaking: ['The legacy `/v1/reports` endpoint has been removed'],
          features: ['Dark mode', 'Saved searches', 'Bulk edit for tasks'],
          improvements: ['Dashboard loads 40% faster', 'Better keyboard navigation'],
          fixes: ['Login loop on Safari', 'Timezone drift in weekly reports'],
          url: 'https://example.com/changelog/3.2.0'
        })
        .build()
    )
  }
};

export const OnCallHandoff: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .handoff({
          rotation: 'Platform',
          from: 'Ana Silva',
          to: 'Ben Ito',
          startsAt: 'Mon 09:00 ET',
          endsAt: 'Mon 09:00 ET (+7d)',
          openIncidents: [
            { id: 'INC-2041', title: 'Elevated 5xx on search', severity: 'danger', url: 'https://example.com/incidents/2041' },
            { id: 'INC-2038', title: 'Disk at 82% on db-replica-2', severity: 'warning' }
          ],
          notes: ['Cache cluster was noisy over the weekend; dashboards are pinned in #platform.', 'Vendor maintenance Tue 02:00 UTC.'],
          scheduleUrl: 'https://example.com/oncall/platform'
        })
        .build()
    )
  }
};

export const MaintenanceScheduled: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .maintenance({
          title: 'Database upgrade',
          status: 'scheduled',
          startsAt: 'Sat, Nov 8 · 02:00 UTC',
          endsAt: '04:00 UTC',
          description: 'We are upgrading our primary database. The app will be read-only for about 10 minutes.',
          services: ['API', 'Dashboard', 'Exports'],
          impact: 'Read-only for ~10 minutes',
          statusUrl: 'https://status.example.com'
        })
        .build()
    )
  }
};

export const MaintenanceCompleted: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .maintenance({ title: 'Database upgrade', status: 'completed', startsAt: 'Sat 02:00 UTC', endsAt: '02:48 UTC', statusUrl: 'https://status.example.com' })
        .build()
    )
  }
};

export const SecurityAlert: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .security({
          title: 'New sign-in to your account',
          description: 'We noticed a sign-in from a device we haven’t seen before. Was this you?',
          user: 'ana@example.com',
          occurredAt: 'Oct 30 · 03:12 UTC',
          ipAddress: '203.0.113.7',
          location: 'Lisbon, Portugal',
          device: 'Chrome on Windows',
          alertId: 'sec-8812',
          url: 'https://example.com/security/events/8812'
        })
        .build()
    )
  }
};

export const AccessRequest: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .access({
          requester: 'Cy Park',
          resource: 'prod-billing-db',
          accessLevel: 'Read-only',
          justification: 'Investigate duplicate invoices reported in SUP-1042.',
          duration: '4 hours',
          ticketId: 'SEC-311',
          requestId: 'AR-77'
        })
        .build()
    )
  }
};
