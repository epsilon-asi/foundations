import type { Meta, StoryObj } from '@storybook/react-vite';

import { message } from '../src';
import { renderNothing, SAMPLE_AVATAR, SAMPLE_IMAGE, slackPreview } from './support';

/**
 * People, HR, and internal-communication components from `@epsilon-asi/slack`.
 */
const meta = {
  title: 'Package/People & Communication',
  render: renderNothing
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Announcement: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .announcement({
          title: 'New office opens Monday',
          body: ['Our new downtown office opens on *Monday, Nov 3*.', 'Badges are ready at the front desk from 8:00.'],
          author: 'Workplace team',
          audience: 'All HQ staff',
          postedAt: 'Oct 30',
          imageUrl: SAMPLE_IMAGE,
          imageAltText: 'Photo of the new office lobby',
          actions: [
            { text: 'Read the FAQ', url: 'https://example.com/office-faq' },
            { text: 'Book a desk', url: 'https://example.com/desks', style: 'primary' }
          ]
        })
        .build()
    )
  }
};

export const EventInvite: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .event({
          title: 'Q4 all hands',
          startsAt: 'Mon, Nov 3 · 10:00',
          endsAt: '11:00 ET',
          location: 'Main hall + video',
          host: 'Leadership team',
          description: 'Quarterly results, Q1 priorities, and live Q&A.',
          eventId: 'q4-all-hands',
          videoUrl: 'https://example.com/meet/all-hands',
          calendarUrl: 'https://example.com/calendar/all-hands'
        })
        .build()
    )
  }
};

export const WelcomeNewHire: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .welcome({
          name: 'Sam Rivera',
          role: 'Product Designer',
          team: 'Growth',
          startDate: 'Nov 3',
          manager: 'Jordan Lee',
          buddy: 'Priya Natarajan',
          bio: 'Sam joins us from a design studio and loves bouldering and film photography.',
          avatarUrl: SAMPLE_AVATAR,
          resources: [
            { label: 'Employee handbook', url: 'https://example.com/handbook' },
            { label: 'First-week checklist', url: 'https://example.com/onboarding' }
          ],
          actions: [{ text: '👋 Say hello', value: 'say_hello', actionId: 'welcome_say_hello' }]
        })
        .build()
    )
  }
};

export const Kudos: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .kudos({
          recipient: 'Dana Okafor',
          from: 'Chris Morgan',
          message: 'Dana stayed late to finish the billing migration, and we shipped with zero downtime.',
          value: 'Customer obsession',
          actions: [{ text: 'Add your kudos', value: 'add_kudos', actionId: 'kudos_add' }]
        })
        .build()
    )
  }
};

export const Celebrations: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .celebration({ name: 'Kim', occasion: 'birthday' })
        .divider()
        .celebration({ name: 'Luis', occasion: 'work_anniversary', years: 5 })
        .divider()
        .celebration({
          name: 'Aisha',
          occasion: 'promotion',
          newRole: 'Staff Engineer',
          actions: [{ text: '🎉 Congratulate', value: 'congrats', actionId: 'celebrate_aisha' }]
        })
        .build()
    )
  }
};

export const PollVoting: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .poll({
          question: 'Where should we hold the 2027 offsite?',
          pollId: 'offsite-2027',
          anonymous: true,
          closesAt: 'Friday 17:00',
          options: [{ label: '🏖️ Lisbon' }, { label: '🏔️ Denver' }, { label: '🏠 Fully remote' }]
        })
        .build()
    )
  }
};

export const PollResults: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .poll({
          question: 'Where should we hold the 2027 offsite?',
          pollId: 'offsite-2027-results',
          showResults: true,
          allowVoting: false,
          options: [
            { label: '🏖️ Lisbon', votes: 42 },
            { label: '🏔️ Denver', votes: 17 },
            { label: '🏠 Fully remote', votes: 9 }
          ]
        })
        .build()
    )
  }
};

export const SurveyRequest: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .survey({
          title: 'Annual engagement survey',
          surveyUrl: 'https://example.com/survey/engagement',
          description: 'Help shape next year. Your answers are anonymous and reported only in aggregate.',
          questionCount: 24,
          estimatedMinutes: 8,
          dueDate: 'Nov 14',
          anonymous: true,
          actions: [{ text: 'Remind me tomorrow', value: 'remind', actionId: 'survey_remind' }]
        })
        .build()
    )
  }
};

export const RatingStars: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message().rating({ question: 'How was your onboarding experience?', description: 'One click, takes a second.', requestId: 'onboarding' }).build()
    )
  }
};

export const RatingNps: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message().rating({ question: 'How likely are you to recommend working here to a friend?', scale: 'nps', requestId: 'enps-q4' }).build()
    )
  }
};

export const RatingThumbs: Story = {
  parameters: {
    slackBlocks: slackPreview(message().rating({ question: 'Did this answer your question?', scale: 'thumbs', requestId: 'helpdesk' }).build())
  }
};

export const Reminder: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .reminder({
          title: 'Submit your timesheet',
          details: 'Payroll closes at 17:00 today.',
          dueAt: 'Today 17:00',
          assignee: 'You',
          url: 'https://example.com/timesheets',
          reminderId: 'timesheet-w44'
        })
        .build()
    )
  }
};

export const ReminderOverdue: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .reminder({ title: 'Complete performance self-review', dueAt: 'Oct 28', overdue: true, snooze: false, url: 'https://example.com/reviews' })
        .build()
    )
  }
};

export const PolicyAcknowledgement: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .policy({
          policyName: 'Updated Code of Conduct',
          summary: 'We refreshed our code of conduct with clearer reporting channels and a new remote-work section.',
          documentUrl: 'https://example.com/policies/code-of-conduct',
          effectiveDate: 'Jan 1, 2027',
          dueDate: 'Dec 15',
          owner: 'People team',
          policyId: 'coc-2027'
        })
        .build()
    )
  }
};

export const PolicyAcknowledged: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .policy({
          policyName: 'Acceptable use policy',
          summary: 'Thanks for reviewing the acceptable use policy.',
          documentUrl: 'https://example.com/policies/aup',
          acknowledged: true,
          acknowledgedAt: 'Oct 30, 09:14'
        })
        .build()
    )
  }
};

export const UserProfile: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .profile({
          name: 'Morgan Diaz',
          pronouns: 'they/them',
          title: 'Engineering Manager, Platform',
          status: '🗓️ In meetings until 14:00',
          department: 'Engineering',
          manager: 'Taylor Kim',
          location: 'Austin, TX',
          timezone: 'Central (UTC−6)',
          email: 'morgan@example.com',
          phone: '+1 555 0100',
          avatarUrl: SAMPLE_AVATAR,
          profileUrl: 'https://example.com/people/morgan'
        })
        .build()
    )
  }
};

export const TrainingAssignment: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .training({
          course: 'Security awareness 2026',
          courseUrl: 'https://example.com/learning/security-2026',
          description: 'Annual training on phishing, passwords, and handling customer data.',
          dueDate: 'Nov 30',
          duration: '25 min',
          required: true,
          assignedBy: 'IT Security',
          progress: 40
        })
        .build()
    )
  }
};
