import type { Meta, StoryObj } from '@storybook/react-vite';

import { renderNothing, SAMPLE_AVATAR, SAMPLE_IMAGE, slackPreview, type PreviewBlocks } from './support';

/**
 * Full compositions on each Slack surface: a message, a modal form and an
 * App Home tab, plus an args-driven story wired to Storybook Controls.
 */
const meta = {
  title: 'Block Kit/Surfaces',
  render: renderNothing
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const MessageAnnouncement: Story = {
  parameters: {
    slackBlocks: slackPreview([
      { type: 'header', text: { type: 'plain_text', text: '🎉 Q4 planning kickoff', emoji: true } },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Join us *Monday at 10:00* in the main room. We will review Q3 results and agree on Q4 priorities.'
        },
        accessory: { type: 'image', image_url: SAMPLE_AVATAR, alt_text: 'Planning' }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'RSVP', emoji: true },
            style: 'primary',
            action_id: 'rsvp_yes'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Can’t make it', emoji: true },
            action_id: 'rsvp_no'
          }
        ]
      },
      { type: 'context', elements: [{ type: 'mrkdwn', text: 'Posted by *People Ops* · 42 going' }] }
    ])
  }
};

export const MessageDarkTheme: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        { type: 'section', text: { type: 'mrkdwn', text: ':moon: The same message, pinned to the *dark* theme.' } },
        { type: 'divider' },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: '*Build*\n#4821' },
            { type: 'mrkdwn', text: '*Duration*\n6m 12s' }
          ]
        }
      ],
      { theme: 'dark' }
    )
  }
};

export const ModalCreateTicket: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: 'File a ticket for the *Platform* team. We reply within one business day.' }
        },
        { type: 'divider' },
        {
          type: 'input',
          block_id: 'summary',
          label: { type: 'plain_text', text: 'Summary' },
          element: { type: 'plain_text_input', action_id: 'summary_input' }
        },
        {
          type: 'input',
          block_id: 'details',
          label: { type: 'plain_text', text: 'Details' },
          element: { type: 'plain_text_input', action_id: 'details_input', multiline: true }
        },
        {
          type: 'input',
          block_id: 'priority',
          label: { type: 'plain_text', text: 'Priority' },
          element: {
            type: 'radio_buttons',
            action_id: 'priority_radio',
            options: [
              { text: { type: 'plain_text', text: 'Low' }, value: 'low' },
              { text: { type: 'plain_text', text: 'Normal' }, value: 'normal' },
              { text: { type: 'plain_text', text: 'Urgent' }, value: 'urgent' }
            ]
          }
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: 'Tickets are visible to everyone in the workspace.' }]
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const AppHomeDashboard: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        { type: 'header', text: { type: 'plain_text', text: '👋 Welcome back, Ada', emoji: true } },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: 'Here is what needs your attention today.' },
          accessory: {
            type: 'button',
            text: { type: 'plain_text', text: 'New request', emoji: true },
            style: 'primary',
            action_id: 'new_request'
          }
        },
        { type: 'divider' },
        { type: 'header', text: { type: 'plain_text', text: 'Pending approvals', emoji: true } },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*Laptop refresh* — requested by Grace Hopper\n_Submitted 2 days ago_' },
          accessory: {
            type: 'button',
            text: { type: 'plain_text', text: 'Review', emoji: true },
            action_id: 'review_laptop'
          }
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*Conference travel* — requested by Alan Turing\n_Submitted today_' },
          accessory: {
            type: 'button',
            text: { type: 'plain_text', text: 'Review', emoji: true },
            action_id: 'review_travel'
          }
        },
        { type: 'divider' },
        { type: 'header', text: { type: 'plain_text', text: 'This week', emoji: true } },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: '*Requests opened*\n18' },
            { type: 'mrkdwn', text: '*Requests closed*\n23' },
            { type: 'mrkdwn', text: '*Median time to close*\n5h 40m' },
            { type: 'mrkdwn', text: '*SLA breaches*\n0' }
          ]
        },
        { type: 'image', image_url: SAMPLE_IMAGE, alt_text: 'Weekly request volume' },
        {
          type: 'actions',
          elements: [
            {
              type: 'static_select',
              action_id: 'home_filter',
              placeholder: { type: 'plain_text', text: 'Filter by team' },
              options: [
                { text: { type: 'plain_text', text: 'All teams' }, value: 'all' },
                { text: { type: 'plain_text', text: 'Platform' }, value: 'platform' },
                { text: { type: 'plain_text', text: 'Payments' }, value: 'payments' }
              ]
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Settings', emoji: true },
              action_id: 'open_settings'
            }
          ]
        }
      ],
      { surface: 'home' }
    )
  }
};

interface DeployArgs {
  title: string;
  body: string;
  buttonLabel: string;
  danger: boolean;
}

/** Edit the Controls panel to change the rendered blocks live. */
export const ArgsDriven: StoryObj<DeployArgs> = {
  render: renderNothing,
  args: {
    title: 'Deploy ready',
    body: '_All checks green._ Ship `v2.7.0` to production?',
    buttonLabel: 'Deploy',
    danger: false
  },
  parameters: {
    slackBlocks: (args: Record<string, unknown>): PreviewBlocks => {
      const { title, body, buttonLabel, danger } = args as unknown as DeployArgs;
      return [
        { type: 'header', text: { type: 'plain_text', text: title, emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: body } },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: buttonLabel, emoji: true },
              style: danger ? 'danger' : 'primary',
              action_id: 'deploy'
            }
          ]
        }
      ];
    }
  }
};
