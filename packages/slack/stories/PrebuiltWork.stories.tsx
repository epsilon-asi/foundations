import type { Meta, StoryObj } from '@storybook/react-vite';

import { message } from '../src';
import { renderNothing, SAMPLE_AVATAR, slackPreview } from './support';

/**
 * Work-management and project components from `@epsilon-asi/slack`, plus an
 * App Home tab composed entirely from them.
 */
const meta = {
  title: 'Package/Work & Projects',
  render: renderNothing
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const TaskAssignment: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .task({
          title: 'Prepare the Q4 board deck',
          assignee: 'Riley Chen',
          description: 'Use the new template and include the revenue bridge.',
          assignedBy: 'Avery Brooks',
          dueDate: 'Nov 12',
          priority: 'high',
          project: 'Board meeting',
          status: 'To do',
          url: 'https://example.com/tasks/TASK-118',
          taskId: 'TASK-118'
        })
        .build()
    )
  }
};

export const Checklist: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .checklist({
          title: 'Launch readiness: Search v2',
          description: 'Everything that must be green before Thursday’s launch.',
          items: [
            { text: 'Load test at 2× peak', done: true, owner: 'SRE' },
            { text: 'Help center article', done: true, owner: 'Support' },
            { text: 'Feature flag rollout plan', url: 'https://example.com/rollout', owner: 'Ana' },
            { text: 'Sales enablement session', owner: 'PMM' },
            { text: 'Legal review of new copy' }
          ],
          actions: [{ text: 'Open launch doc', url: 'https://example.com/launch' }]
        })
        .build()
    )
  }
};

export const StandupSummary: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .standup({
          team: 'Platform',
          date: 'Thu, Oct 30',
          entries: [
            { person: 'Ana', yesterday: 'Fixed the flaky payments test', today: 'Start cache warm-up job', blockers: 'Waiting on DB access approval' },
            { person: 'Ben', yesterday: 'Reviewed 4 PRs', today: 'Pairing with Cy on the queue migration' },
            { person: 'Cy', today: 'Queue migration dry run' },
            { person: 'Dee' }
          ],
          actions: [{ text: 'Post my update', value: 'post_update', actionId: 'standup_post' }]
        })
        .build()
    )
  }
};

export const MeetingSummary: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .meeting({
          title: 'Roadmap review',
          date: 'Oct 30 · 45 min',
          attendees: ['Ana', 'Ben', 'Cy', 'Dee'],
          summary: 'We agreed on Q1 scope and deferred the mobile redesign to Q2.',
          decisions: ['Ship Search v2 in January', 'Pause mobile redesign until Q2'],
          actionItems: [
            { owner: 'Ana', task: 'Write the Search v2 spec', dueDate: 'Nov 5' },
            { owner: 'Ben', task: 'Estimate infra cost' },
            { owner: 'Cy', task: 'Share decision with stakeholders', dueDate: 'Oct 31' }
          ],
          notesUrl: 'https://example.com/notes/roadmap',
          recordingUrl: 'https://example.com/recordings/roadmap'
        })
        .build()
    )
  }
};

export const ProjectStatusAtRisk: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .project({
          project: 'Billing platform migration',
          health: 'at_risk',
          summary: 'The vendor’s API sandbox is two weeks late, which compresses our testing window.',
          progress: 64,
          owner: 'Finance Engineering',
          dueDate: 'Dec 1',
          highlights: ['Data model migrated', 'Invoices reconciled for 3 pilot customers'],
          risks: ['Vendor sandbox delay', 'Holiday code freeze starts Dec 15'],
          nextSteps: ['Escalate with vendor account team', 'Add a weekend test window'],
          url: 'https://example.com/projects/billing'
        })
        .build()
    )
  }
};

export const ProjectStatusOnTrack: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message().project({ project: 'Help center redesign', health: 'on_track', progress: 82, owner: 'Support Ops', dueDate: 'Nov 20' }).build()
    )
  }
};

export const GoalProgress: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .goals({
          objective: 'Delight new customers',
          period: 'Q4 2026',
          owner: 'Customer Experience',
          keyResults: [
            { title: 'Raise activation rate to 50%', progress: 84, current: '42%', target: '50%', owner: 'Growth' },
            { title: 'Cut time-to-value to 2 days', progress: 55, current: '3.1 days', target: '2 days' },
            { title: 'Support CSAT ≥ 4.5', progress: 20, current: 3.9, target: 4.5, owner: 'Support' }
          ],
          actions: [{ text: 'Open OKR tracker', url: 'https://example.com/okrs' }]
        })
        .build()
    )
  }
};

export const Agenda: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .agenda({
          title: 'Team offsite: day 1',
          date: 'Tue, Nov 4',
          items: [
            { time: '09:00', title: 'Breakfast & coffee', location: 'Lobby' },
            { time: '10:00', title: 'Strategy keynote', url: 'https://example.com/keynote', location: 'Auditorium', note: 'Bring laptops' },
            { time: '12:30', title: 'Lunch', location: 'Terrace' },
            { time: '14:00', title: 'Breakout sessions', url: 'https://example.com/breakouts' },
            { time: '18:30', title: 'Team dinner', location: 'Harbor restaurant' }
          ],
          actions: [{ text: 'Full itinerary', url: 'https://example.com/offsite' }]
        })
        .build()
    )
  }
};

export const DocumentShare: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .document({
          title: 'FY27 operating plan (draft)',
          url: 'https://example.com/docs/fy27-plan',
          description: 'Please leave comments by Friday.',
          documentType: 'Doc',
          sharedBy: 'Avery Brooks',
          updatedAt: '2 hours ago',
          access: '🔒 Leadership only',
          thumbnailUrl: SAMPLE_AVATAR,
          actions: [{ text: 'Request edit access', value: 'request_edit', actionId: 'doc_request_edit' }]
        })
        .build()
    )
  }
};

export const Leaderboard: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .leaderboard({
          title: 'Top support agents',
          metric: 'tickets solved',
          period: 'October 2026',
          entries: [
            { name: 'Ana', score: 312, change: 1 },
            { name: 'Ben', score: 298, change: -1 },
            { name: 'Cy', score: 260 },
            { name: 'Dee', score: 241, change: 3 },
            { name: 'Eli', score: 220 }
          ],
          actions: [{ text: 'Full leaderboard', url: 'https://example.com/leaderboard' }]
        })
        .build()
    )
  }
};

export const EmployeeHomeTab: Story = {
  name: 'Employee App Home (composed)',
  parameters: {
    slackBlocks: slackPreview(
      message()
        .profile({ name: 'Riley Chen', title: 'Finance Manager', status: '🟢 Available', avatarUrl: SAMPLE_AVATAR })
        .divider()
        .agenda({
          title: 'Today',
          date: 'Thu, Oct 30',
          items: [
            { time: '09:30', title: 'Budget sync', location: 'Room 4B' },
            { time: '13:00', title: '1:1 with Avery' }
          ]
        })
        .divider()
        .task({ title: 'Approve October close', assignee: 'Riley Chen', dueDate: 'Today', priority: 'urgent', taskId: 'close-oct' })
        .divider()
        .checklist({
          title: 'Month-end close',
          items: [
            { text: 'Reconcile bank accounts', done: true },
            { text: 'Accrue vendor invoices', done: true },
            { text: 'Review payroll journal' },
            { text: 'Lock period' }
          ]
        })
        .build(),
      { surface: 'home' }
    )
  }
};
