import { describe, expect, it } from 'vitest';
import {
  agenda,
  bulletList,
  checklist,
  clampPercent,
  createMessage,
  documentShare,
  formatMoney,
  goalProgress,
  leaderboard,
  meetingSummary,
  priorityLabel,
  progressBar,
  projectStatus,
  resolveComponent,
  standupSummary,
  taskAssignment
} from '../src';

type ActionsLike = { type: string; elements: Array<{ action_id?: string; value?: string; style?: string; text?: { text: string } }> };

function actionsOf(blocks: Array<{ type: string }>): ActionsLike['elements'] {
  const block = blocks.find((candidate) => candidate.type === 'actions') as ActionsLike | undefined;
  return block?.elements ?? [];
}

describe('shared prebuilt helpers', () => {
  it('formats progress, money, priority, and lists', () => {
    expect(progressBar(50)).toBe('█████░░░░░');
    expect(progressBar(-10, 4)).toBe('░░░░');
    expect(progressBar(250, 4)).toBe('████');
    expect(clampPercent(Number.NaN)).toBe(0);
    expect(clampPercent(42.6)).toBe(43);
    expect(formatMoney(1234.5)).toBe('$1,234.50');
    expect(formatMoney(10, 'EUR')).toBe('€10.00');
    expect(priorityLabel('urgent')).toBe('🚨 Urgent');
    expect(priorityLabel('low')).toBe('• Low');
    expect(bulletList(['a', 'b'])).toBe('• a\n• b');
    expect(bulletList(['a'], '-')).toBe('- a');
  });
});

describe('work and project components', () => {
  it('renders task assignments with priority severity and actions', () => {
    const rendered = resolveComponent(taskAssignment({
      title: 'Prepare Q4 board deck',
      assignee: 'Riley',
      description: 'Use the new template.',
      assignedBy: 'Avery',
      dueDate: 'Nov 12',
      priority: 'high',
      project: 'Board meeting',
      status: 'To do',
      url: 'https://example.com/task/1',
      taskId: 'TASK-1',
      actions: [{ text: 'Decline', value: 'decline' }]
    }));
    expect(rendered.blocks[0]).toMatchObject({ type: 'header', text: { text: '⚠️ Prepare Q4 board deck' } });
    expect(actionsOf(rendered.blocks).map((button) => button.action_id)).toEqual(['task_1_accept', 'task_1_view', 'action_decline']);

    const minimal = resolveComponent(taskAssignment({ title: 'Review doc', assignee: 'Riley' }));
    expect(minimal.blocks[0]).toMatchObject({ text: { text: 'ℹ️ Review doc' } });
  });

  it('renders checklists with progress, links, owners, limits, and empty state', () => {
    const rendered = resolveComponent(checklist({
      title: 'New hire onboarding',
      description: 'First week tasks.',
      maxItems: 2,
      items: [
        { text: 'Laptop setup', done: true, owner: 'IT' },
        { text: 'Read handbook', url: 'https://example.com/handbook' },
        { text: 'Meet your buddy' }
      ],
      actions: [{ text: 'Open portal', url: 'https://example.com/portal' }]
    }));
    const text = JSON.stringify(rendered.blocks);
    expect(text).toContain('✅ ~Laptop setup~ — IT');
    expect(text).toContain('⬜ <https://example.com/handbook|Read handbook>');
    expect(text).toContain('1 more item not shown');
    expect(rendered.fallbackText).toBe('New hire onboarding • 1/3 complete');

    const empty = resolveComponent(checklist({ title: 'Empty', items: [], emptyText: 'All clear' }));
    expect(JSON.stringify(empty.blocks)).toContain('All clear');
    const noProgress = resolveComponent(checklist({ title: 'Simple', items: [{ text: 'a' }, { text: 'b' }, { text: 'c' }], showProgress: false, maxItems: 1 }));
    expect(JSON.stringify(noProgress.blocks)).not.toContain('complete*');
    expect(JSON.stringify(noProgress.blocks)).toContain('2 more items');
    expect(JSON.stringify(resolveComponent(checklist({ title: 'Default empty', items: [] })).blocks)).toContain('No items yet.');
  });

  it('renders standup summaries with blockers, empty entries, and limits', () => {
    const rendered = resolveComponent(standupSummary({
      team: 'Platform',
      date: 'Oct 30',
      maxEntries: 2,
      entries: [
        { person: 'Ana', yesterday: 'Fixed flaky test', today: 'Start caching work', blockers: 'Waiting on review' },
        { person: 'Ben' },
        { person: 'Cy', today: 'Docs' }
      ],
      actions: [{ text: 'Add update', value: 'add' }]
    }));
    const text = JSON.stringify(rendered.blocks);
    expect(text).toContain('🚧 1 blocker');
    expect(text).toContain('_No update submitted._');
    expect(text).toContain('1 more update not shown');
    expect(rendered.fallbackText).toBe('Platform standup • Oct 30 • 1 blockers');

    const none = resolveComponent(standupSummary({ team: 'Ops', entries: [] }));
    expect(JSON.stringify(none.blocks)).toContain('No blockers');
    expect(JSON.stringify(none.blocks)).toContain('No standup updates yet.');

    const many = resolveComponent(standupSummary({
      team: 'Web',
      entries: [{ person: 'A', blockers: 'x' }, { person: 'B', blockers: 'y' }, { person: 'C' }],
      maxEntries: 1
    }));
    expect(JSON.stringify(many.blocks)).toContain('2 blockers');
    expect(JSON.stringify(many.blocks)).toContain('2 more updates not shown');
  });

  it('renders meeting summaries with decisions, action items, and links', () => {
    const rendered = resolveComponent(meetingSummary({
      title: 'Roadmap review',
      date: 'Oct 30',
      attendees: ['Ana', 'Ben'],
      summary: 'Agreed on Q1 scope.',
      decisions: ['Ship search v2', 'Pause mobile redesign'],
      actionItems: [
        { owner: 'Ana', task: 'Write spec', dueDate: 'Nov 5' },
        { owner: 'Ben', task: 'Estimate effort' }
      ],
      notesUrl: 'https://example.com/notes',
      recordingUrl: 'https://example.com/rec',
      actions: [{ text: 'Share', value: 'share' }]
    }));
    expect(rendered.blocks.map((block) => block.type)).toEqual(['header', 'context', 'section', 'section', 'section', 'actions']);
    expect(rendered.fallbackText).toBe('Meeting notes: Roadmap review • 2 action items');

    const single = resolveComponent(meetingSummary({ title: '1:1', actionItems: [{ owner: 'Me', task: 'Follow up' }] }));
    expect(single.fallbackText).toBe('Meeting notes: 1:1 • 1 action item');
    expect(resolveComponent(meetingSummary({ title: 'Bare' })).blocks).toHaveLength(1);
  });

  it('renders project status for every health and optional section', () => {
    const rendered = resolveComponent(projectStatus({
      project: 'Billing migration',
      health: 'at_risk',
      summary: 'Vendor API delayed.',
      progress: 64,
      owner: 'Finance eng',
      dueDate: 'Dec 1',
      highlights: ['Data model done'],
      risks: ['Vendor SLA'],
      nextSteps: ['Escalate to vendor'],
      url: 'https://example.com/project',
      actions: [{ text: 'Subscribe', value: 'sub' }]
    }));
    expect(rendered.blocks).toHaveLength(8);
    expect(rendered.fallbackText).toBe('Billing migration • 🟡 At risk • 64% complete');
    expect(actionsOf(rendered.blocks)[0]?.action_id).toBe('open_project');

    for (const health of ['on_track', 'off_track', 'completed', 'paused'] as const) {
      const minimal = resolveComponent(projectStatus({ project: 'P', health }));
      expect(minimal.blocks).toHaveLength(2);
    }
  });

  it('renders goal progress with key result colors and empty state', () => {
    const rendered = resolveComponent(goalProgress({
      objective: 'Delight new customers',
      period: 'Q4 2026',
      owner: 'CX',
      keyResults: [
        { title: 'Activation rate', progress: 80, current: '42%', target: '50%', owner: 'Growth' },
        { title: 'Time to value', progress: 50 },
        { title: 'Support CSAT', progress: 10, current: 3.9, target: 4.5 }
      ],
      actions: [{ text: 'Open OKRs', url: 'https://example.com/okrs' }]
    }));
    const text = JSON.stringify(rendered.blocks);
    expect(text).toContain('🟢 *Activation rate*');
    expect(text).toContain('🟡 *Time to value*');
    expect(text).toContain('🔴 *Support CSAT*');
    expect(text).toContain('42% / 50% • Growth');
    expect(rendered.fallbackText).toBe('Delight new customers • 47% overall');

    const empty = resolveComponent(goalProgress({ objective: 'TBD', keyResults: [] }));
    expect(JSON.stringify(empty.blocks)).toContain('No key results defined yet.');
  });

  it('renders agendas with links, locations, notes, limits, and empty state', () => {
    const rendered = resolveComponent(agenda({
      title: 'Offsite day 1',
      date: 'Nov 4',
      maxItems: 2,
      items: [
        { time: '09:00', title: 'Breakfast', location: 'Lobby' },
        { time: '10:00', title: 'Keynote', url: 'https://example.com/keynote', note: 'Bring laptops' },
        { time: '12:00', title: 'Lunch' }
      ],
      actions: [{ text: 'Full schedule', url: 'https://example.com/schedule' }]
    }));
    const text = JSON.stringify(rendered.blocks);
    expect(text).toContain('📍 Lobby');
    expect(text).toContain('_Bring laptops_');
    expect(text).toContain('1 more item not shown');
    expect(rendered.fallbackText).toBe('Offsite day 1 • Nov 4 • 3 items');

    const empty = resolveComponent(agenda({ title: 'Today', items: [] }));
    expect(JSON.stringify(empty.blocks)).toContain('Nothing scheduled.');
    expect(empty.fallbackText).toBe('Today • 0 items');
    const many = resolveComponent(agenda({ title: 'Busy', items: [{ time: '1', title: 'a' }, { time: '2', title: 'b' }, { time: '3', title: 'c' }], maxItems: 1 }));
    expect(JSON.stringify(many.blocks)).toContain('2 more items');
    expect(JSON.stringify(resolveComponent(agenda({ title: 'Custom', items: [], emptyText: 'Free day' })).blocks)).toContain('Free day');
  });

  it('renders document shares with thumbnail and metadata', () => {
    const rendered = resolveComponent(documentShare({
      title: 'FY27 plan',
      url: 'https://example.com/doc',
      description: 'Draft for review.',
      documentType: 'Google Doc',
      sharedBy: 'Avery',
      updatedAt: '2h ago',
      access: 'Anyone at the company',
      thumbnailUrl: 'https://example.com/thumb.png',
      actions: [{ text: 'Request edit access', value: 'edit' }]
    }));
    expect(rendered.blocks.map((block) => block.type)).toEqual(['section', 'context', 'actions']);
    expect(rendered.fallbackText).toBe('Avery shared FY27 plan');

    const minimal = resolveComponent(documentShare({ title: 'Notes', url: 'https://example.com/notes' }));
    expect(minimal.blocks.map((block) => block.type)).toEqual(['section', 'actions']);
    expect(minimal.fallbackText).toBe('Notes');
  });

  it('renders leaderboards with medals, change arrows, and empty state', () => {
    const rendered = resolveComponent(leaderboard({
      title: 'Top closers',
      metric: 'deals',
      period: 'October',
      entries: [
        { name: 'Ana', score: 12, change: 2 },
        { name: 'Ben', score: 9, change: -1 },
        { name: 'Cy', score: 7 },
        { name: 'Di', score: 5 }
      ],
      actions: [{ text: 'Full board', url: 'https://example.com/board' }]
    }));
    const text = JSON.stringify(rendered.blocks);
    expect(text).toContain('🥇 *Ana* — 12 deals ▲2');
    expect(text).toContain('🥈 *Ben* — 9 deals ▼1');
    expect(text).toContain('4. *Di* — 5 deals');
    expect(rendered.fallbackText).toBe('Top closers • Leader: Ana');

    const empty = resolveComponent(leaderboard({ title: 'Nobody yet', entries: [] }));
    expect(JSON.stringify(empty.blocks)).toContain('No entries yet.');
    expect(empty.fallbackText).toBe('Nobody yet');
    expect(createMessage([leaderboard({ title: 'Valid', entries: [{ name: 'A', score: 1 }] })]).blocks).toHaveLength(2);
  });
});
