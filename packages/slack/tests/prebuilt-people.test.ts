import { describe, expect, it } from 'vitest';
import {
  announcement,
  celebration,
  createMessage,
  eventInvite,
  kudos,
  policyAcknowledgement,
  poll,
  ratingRequest,
  reminder,
  resolveComponent,
  surveyRequest,
  trainingAssignment,
  userProfile,
  welcomeMessage
} from '../src';

type ActionsLike = { type: string; elements: Array<{ action_id?: string; value?: string; style?: string; url?: string; text?: { text: string }; confirm?: unknown }> };

function actionsOf(blocks: Array<{ type: string }>): ActionsLike['elements'] {
  const block = blocks.find((candidate) => candidate.type === 'actions') as ActionsLike | undefined;
  return block?.elements ?? [];
}

describe('people and communication components', () => {
  it('renders announcements with image, meta, and actions', () => {
    const rendered = resolveComponent(announcement({
      title: 'Office move',
      body: ['We move on Monday.', 'Pack your desks by Friday.'],
      author: 'Workplace team',
      audience: 'HQ staff',
      postedAt: 'Oct 30',
      imageUrl: 'https://example.com/office.png',
      actions: [{ text: 'Read FAQ', url: 'https://example.com/faq' }]
    }));
    expect(rendered.blocks.map((block) => block.type)).toEqual(['header', 'section', 'image', 'context', 'actions']);
    expect(rendered.fallbackText).toContain('Office move');

    const minimal = resolveComponent(announcement({ title: 'Heads up', body: '' }));
    expect(minimal.blocks.map((block) => block.type)).toEqual(['header']);
    expect(createMessage([announcement({ title: 'Valid', body: 'Body' })]).blocks).toHaveLength(2);
  });

  it('renders event invites with RSVP, call, and calendar buttons', () => {
    const rendered = resolveComponent(eventInvite({
      title: 'All hands',
      startsAt: 'Nov 3, 10:00',
      endsAt: '11:00',
      location: 'Main hall',
      host: 'CEO office',
      description: 'Quarterly update.',
      eventId: 'q4-all-hands',
      videoUrl: 'https://example.com/call',
      calendarUrl: 'https://example.com/cal',
      actions: [{ text: 'Agenda', url: 'https://example.com/agenda' }]
    }));
    const buttons = actionsOf(rendered.blocks);
    expect(buttons.map((button) => button.action_id)).toEqual([
      'q4_all_hands_rsvp_yes',
      'q4_all_hands_rsvp_maybe',
      'q4_all_hands_rsvp_no',
      'q4_all_hands_join_call',
      'q4_all_hands_add_to_calendar',
      'action_agenda'
    ]);
    expect(rendered.fallbackText).toBe('All hands • Nov 3, 10:00 – 11:00 • Main hall');

    const noRsvp = resolveComponent(eventInvite({ title: 'Webinar', startsAt: 'Tomorrow', rsvp: false }));
    expect(noRsvp.blocks.some((block) => block.type === 'actions')).toBe(false);
  });

  it('renders welcome messages with fields, resources, and avatar', () => {
    const rendered = resolveComponent(welcomeMessage({
      name: 'Sam Rivera',
      role: 'Product Designer',
      team: 'Growth',
      startDate: 'Nov 3',
      manager: 'Jordan Lee',
      buddy: 'Priya N.',
      bio: 'Sam joins from a design agency.',
      avatarUrl: 'https://example.com/sam.png',
      resources: [{ label: 'Handbook', url: 'https://example.com/handbook' }],
      actions: [{ text: 'Say hi', value: 'hi' }]
    }));
    expect(rendered.blocks.map((block) => block.type)).toEqual(['header', 'section', 'section', 'section', 'actions']);
    expect(JSON.stringify(rendered.blocks)).toContain('<https://example.com/handbook|Handbook>');

    const minimal = resolveComponent(welcomeMessage({ name: 'Alex' }));
    expect(minimal.blocks).toHaveLength(2);
    expect(minimal.fallbackText).toBe('Welcome Alex');
  });

  it('renders kudos with quote, value, image, and actions', () => {
    const rendered = resolveComponent(kudos({
      recipient: 'Dana',
      from: 'Chris',
      message: 'Shipped the migration early.\nZero downtime!',
      value: 'Ownership',
      imageUrl: 'https://example.com/party.gif',
      actions: [{ text: 'Add kudos', value: 'add' }]
    }));
    expect(rendered.blocks.map((block) => block.type)).toEqual(['header', 'section', 'image', 'context', 'actions']);
    expect(JSON.stringify(rendered.blocks[1])).toContain('>Zero downtime!');
    expect(resolveComponent(kudos({ recipient: 'A', from: 'B', message: 'Thanks' })).blocks).toHaveLength(2);
  });

  it('renders every celebration occasion with defaults and overrides', () => {
    const titles = [
      celebration({ name: 'Kim', occasion: 'birthday' }),
      celebration({ name: 'Kim', occasion: 'work_anniversary', years: 5 }),
      celebration({ name: 'Kim', occasion: 'work_anniversary', years: 1 }),
      celebration({ name: 'Kim', occasion: 'work_anniversary' }),
      celebration({ name: 'Kim', occasion: 'promotion', newRole: 'Staff Engineer' }),
      celebration({ name: 'Kim', occasion: 'promotion' }),
      celebration({ name: 'Kim', occasion: 'milestone' })
    ].map((component) => resolveComponent(component));

    expect(titles.map((rendered) => rendered.fallbackText)).toEqual([
      '🎂 Happy birthday, Kim!',
      '🎉 Happy 5-year anniversary, Kim!',
      '🎉 Happy 1-year anniversary, Kim!',
      '🎉 Happy work anniversary, Kim!',
      '🚀 Congratulations, Kim!',
      '🚀 Congratulations, Kim!',
      '🏆 Kim reached a milestone!'
    ]);
    expect(JSON.stringify(titles[2]?.blocks)).toContain('1 amazing year ');
    expect(JSON.stringify(titles[4]?.blocks)).toContain('Staff Engineer');

    const custom = resolveComponent(celebration({
      name: 'Team',
      occasion: 'milestone',
      title: '1M users!',
      message: 'We did it.',
      imageUrl: 'https://example.com/confetti.png',
      actions: [{ text: 'Celebrate', value: 'yay' }]
    }));
    expect(custom.blocks.map((block) => block.type)).toEqual(['header', 'section', 'image', 'actions']);
  });

  it('renders polls with results, voting buttons, and limits', () => {
    const rendered = resolveComponent(poll({
      question: 'Where should we hold the offsite?',
      pollId: 'offsite',
      showResults: true,
      anonymous: true,
      closesAt: 'Friday',
      maxOptions: 2,
      options: [
        { label: 'Lisbon', votes: 6 },
        { label: 'Denver', votes: 1, value: 'den' },
        { label: 'Remote', votes: 3 }
      ]
    }));
    expect(rendered.blocks).toHaveLength(4);
    const text = JSON.stringify(rendered.blocks);
    expect(text).toContain('86%');
    expect(text).toContain('1 vote)');
    expect(text).toContain('offsite_vote_2');
    expect(text).toContain('"value":"den"');
    expect(text).toContain('1 more option not shown');

    const noVotes = resolveComponent(poll({ question: 'Lunch?', allowVoting: false, showResults: true, options: [{ label: 'Pizza' }] }));
    expect(JSON.stringify(noVotes.blocks)).toContain('0% (0 votes)');
    expect(JSON.stringify(noVotes.blocks)).not.toContain('accessory');

    const plain = resolveComponent(poll({ question: 'Pick one', options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }], maxOptions: 1 }));
    expect(JSON.stringify(plain.blocks)).toContain('2 more options not shown');

    const quiet = resolveComponent(poll({ question: 'Quiet', options: [{ label: 'Only' }] }));
    expect(quiet.blocks.some((block) => block.type === 'context')).toBe(false);
  });

  it('renders survey requests with metadata and primary action', () => {
    const rendered = resolveComponent(surveyRequest({
      title: 'Engagement survey',
      surveyUrl: 'https://example.com/survey',
      description: 'Tell us how we are doing.',
      dueDate: 'Nov 10',
      estimatedMinutes: 5,
      questionCount: 12,
      anonymous: true,
      actions: [{ text: 'Remind me later', value: 'later' }]
    }));
    expect(rendered.blocks.map((block) => block.type)).toEqual(['header', 'section', 'context', 'actions']);
    expect(JSON.stringify(rendered.blocks)).toContain('12 questions');

    const single = resolveComponent(surveyRequest({ title: 'Pulse', surveyUrl: 'https://example.com/pulse', questionCount: 1 }));
    expect(JSON.stringify(single.blocks)).toContain('1 question');
    expect(resolveComponent(surveyRequest({ title: 'Bare', surveyUrl: 'https://example.com' })).blocks).toHaveLength(2);
  });

  it('renders rating requests for stars, NPS, and thumbs scales', () => {
    const stars = resolveComponent(ratingRequest({ question: 'How was onboarding?', description: 'One click.' }));
    expect(actionsOf(stars.blocks)).toHaveLength(5);
    expect(JSON.stringify(stars.blocks)).toContain('1 = Poor');

    const nps = resolveComponent(ratingRequest({ question: 'Recommend us?', scale: 'nps', requestId: 'nps-q4', lowLabel: 'Never', highLabel: 'Always' }));
    expect(actionsOf(nps.blocks).map((button) => button.action_id)).toContain('nps_q4_rate_10');
    expect(JSON.stringify(nps.blocks)).toContain('0 = Never · 10 = Always');

    const npsDefaults = resolveComponent(ratingRequest({ question: 'Recommend us?', scale: 'nps' }));
    expect(JSON.stringify(npsDefaults.blocks)).toContain('Not at all likely');

    const thumbs = resolveComponent(ratingRequest({ question: 'Was this helpful?', scale: 'thumbs' }));
    expect(thumbs.blocks.map((block) => block.type)).toEqual(['section', 'actions']);
    expect(createMessage([ratingRequest({ question: 'Valid?', scale: 'nps' })]).blocks).toHaveLength(3);
  });

  it('renders reminders including overdue, snooze, and links', () => {
    const rendered = resolveComponent(reminder({
      title: 'Submit timesheet',
      details: 'Payroll closes tonight.',
      dueAt: 'Today 17:00',
      assignee: 'You',
      overdue: true,
      url: 'https://example.com/timesheet',
      reminderId: 'ts-1',
      actions: [{ text: 'Help', url: 'https://example.com/help' }]
    }));
    expect(rendered.fallbackText).toBe('Overdue: Submit timesheet • Due Today 17:00');
    expect(actionsOf(rendered.blocks).map((button) => button.action_id)).toEqual(['ts_1_done', 'ts_1_snooze', 'ts_1_open', 'action_help']);

    const simple = resolveComponent(reminder({ title: 'Stretch', snooze: false }));
    expect(actionsOf(simple.blocks)).toHaveLength(1);
    expect(simple.fallbackText).toBe('Reminder: Stretch');
  });

  it('renders policy acknowledgements before and after acknowledgement', () => {
    const pending = resolveComponent(policyAcknowledgement({
      policyName: 'Code of conduct',
      summary: 'Updated for 2027.',
      documentUrl: 'https://example.com/coc',
      effectiveDate: 'Jan 1',
      dueDate: 'Dec 15',
      owner: 'People team',
      policyId: 'coc-2027'
    }));
    const buttons = actionsOf(pending.blocks);
    expect(buttons[0]?.action_id).toBe('coc_2027_acknowledge');
    expect(buttons[0]?.confirm).toBeDefined();
    expect(pending.fallbackText).toBe('Please acknowledge: Code of conduct • Due Dec 15');

    const done = resolveComponent(policyAcknowledgement({
      policyName: 'Security policy',
      summary: 'Read it.',
      documentUrl: 'https://example.com/sec',
      acknowledged: true,
      acknowledgedAt: 'Oct 2'
    }));
    expect(actionsOf(done.blocks)).toHaveLength(1);
    expect(done.blocks.at(-1)?.type).toBe('context');
    expect(done.fallbackText).toBe('Acknowledged: Security policy');
  });

  it('renders user profiles with contact fields and actions', () => {
    const rendered = resolveComponent(userProfile({
      name: 'Morgan Diaz',
      pronouns: 'they/them',
      title: 'Engineering Manager',
      status: 'In a meeting',
      department: 'Platform',
      manager: 'Taylor Kim',
      location: 'Austin',
      timezone: 'CT',
      email: 'morgan@example.com',
      phone: '+1 555 0100',
      avatarUrl: 'https://example.com/morgan.png',
      profileUrl: 'https://example.com/people/morgan',
      actions: [{ text: 'Message', value: 'dm' }]
    }));
    expect(rendered.blocks.map((block) => block.type)).toEqual(['section', 'section', 'actions']);
    expect(JSON.stringify(rendered.blocks)).toContain('mailto:morgan@example.com');
    expect(actionsOf(rendered.blocks)[0]?.action_id).toBe('view_profile');

    expect(resolveComponent(userProfile({ name: 'Solo' })).blocks).toHaveLength(1);
  });

  it('renders training assignments with progress and start/continue states', () => {
    const notStarted = resolveComponent(trainingAssignment({
      course: 'Security awareness',
      courseUrl: 'https://example.com/course',
      description: 'Annual training.',
      dueDate: 'Nov 30',
      duration: '20 min',
      required: true,
      assignedBy: 'IT',
      actions: [{ text: 'Request extension', value: 'extend' }]
    }));
    expect(actionsOf(notStarted.blocks)[0]?.text?.text).toBe('Start course');

    const inProgress = resolveComponent(trainingAssignment({ course: 'Privacy 101', courseUrl: 'https://example.com/p', progress: 140 }));
    expect(JSON.stringify(inProgress.blocks)).toContain('100% complete');
    expect(actionsOf(inProgress.blocks)[0]?.text?.text).toBe('Continue course');

    const zero = resolveComponent(trainingAssignment({ course: 'Ethics', courseUrl: 'https://example.com/e', progress: 0 }));
    expect(actionsOf(zero.blocks)[0]?.text?.text).toBe('Start course');
    expect(zero.fallbackText).toBe('Training assigned: Ethics');
  });
});
