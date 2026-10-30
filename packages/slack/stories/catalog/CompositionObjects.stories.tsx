import type { Meta, StoryObj } from '@storybook/react-vite';

import { renderNothing, slackPreview, unvalidated } from '../support';

/**
 * Composition objects — the shared JSON shapes used inside blocks and
 * elements: text, option, option group, confirmation dialog, conversation
 * filter, dispatch action config, workflow / trigger, Slack file and Slack icon.
 */
const meta = {
  title: 'Catalog/Composition objects',
  render: renderNothing
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextObjectPlainText: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'plain_text', text: 'plain_text with emoji: true :sparkles: *not bold*', emoji: true }
      },
      {
        type: 'section',
        text: { type: 'plain_text', text: 'plain_text with emoji: false :sparkles:', emoji: false }
      }
    ])
  }
};

export const TextObjectMrkdwn: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*mrkdwn* (verbatim: false) auto-links https://example.com, #general and @here.',
          verbatim: false
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*mrkdwn* (verbatim: true) leaves https://example.com and #general as typed.',
          verbatim: true
        }
      }
    ])
  }
};

export const ConfirmationDialog: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Each control below opens a confirmation dialog first.' }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Publish' },
            style: 'primary',
            action_id: 'confirm_primary',
            confirm: {
              title: { type: 'plain_text', text: 'Publish the post?' },
              text: { type: 'mrkdwn', text: 'It will be visible to *everyone* in the workspace.' },
              confirm: { type: 'plain_text', text: 'Publish' },
              deny: { type: 'plain_text', text: 'Not yet' },
              style: 'primary'
            }
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Archive' },
            style: 'danger',
            action_id: 'confirm_danger',
            confirm: {
              title: { type: 'plain_text', text: 'Archive this channel?' },
              text: { type: 'plain_text', text: 'Members will lose access to new messages.' },
              confirm: { type: 'plain_text', text: 'Archive' },
              deny: { type: 'plain_text', text: 'Cancel' },
              style: 'danger'
            }
          },
          {
            type: 'static_select',
            action_id: 'confirm_select',
            placeholder: { type: 'plain_text', text: 'Change owner' },
            options: [
              { text: { type: 'plain_text', text: 'Platform' }, value: 'platform' },
              { text: { type: 'plain_text', text: 'Payments' }, value: 'payments' }
            ],
            confirm: {
              title: { type: 'plain_text', text: 'Change owner?' },
              text: { type: 'plain_text', text: 'The new owner will be notified.' },
              confirm: { type: 'plain_text', text: 'Change' },
              deny: { type: 'plain_text', text: 'Keep current' }
            }
          }
        ]
      }
    ])
  }
};

export const ConversationFilter: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '`include: [public, private]`, excluding shared channels and bots' },
        accessory: {
          type: 'conversations_select',
          action_id: 'filtered_conversation',
          placeholder: { type: 'plain_text', text: 'Select a channel' },
          filter: {
            include: ['public', 'private'],
            exclude_external_shared_channels: true,
            exclude_bot_users: true
          }
        }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '`include: [im, mpim]` — direct messages only' },
        accessory: {
          type: 'multi_conversations_select',
          action_id: 'filtered_dms',
          placeholder: { type: 'plain_text', text: 'Select DMs' },
          filter: { include: ['im', 'mpim'] }
        }
      }
    ])
  }
};

export const DispatchActionConfiguration: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'dispatch_enter',
          dispatch_action: true,
          label: { type: 'plain_text', text: 'Dispatch on Enter' },
          element: {
            type: 'plain_text_input',
            action_id: 'dispatch_enter_input',
            dispatch_action_config: { trigger_actions_on: ['on_enter_pressed'] }
          }
        },
        {
          type: 'input',
          block_id: 'dispatch_character',
          dispatch_action: true,
          label: { type: 'plain_text', text: 'Dispatch on every character' },
          element: {
            type: 'plain_text_input',
            action_id: 'dispatch_character_input',
            multiline: true,
            dispatch_action_config: { trigger_actions_on: ['on_enter_pressed', 'on_character_entered'] }
          }
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const OptionObject: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Options with `text`, `value` and `description` (mrkdwn allowed in radios / checkboxes)' },
        accessory: {
          type: 'radio_buttons',
          action_id: 'plan_option',
          options: [
            {
              text: { type: 'mrkdwn', text: '*Starter*' },
              value: 'starter',
              description: { type: 'mrkdwn', text: 'Up to _10_ seats' }
            },
            {
              text: { type: 'mrkdwn', text: '*Business*' },
              value: 'business',
              description: { type: 'plain_text', text: 'Unlimited seats' }
            }
          ]
        }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Overflow options may also carry a `url`' },
        accessory: {
          type: 'overflow',
          action_id: 'option_url_overflow',
          options: [
            { text: { type: 'plain_text', text: 'Edit' }, value: 'edit' },
            {
              text: { type: 'plain_text', text: 'View pricing' },
              value: 'pricing',
              url: 'https://www.example.com/pricing'
            }
          ]
        }
      }
    ])
  }
};

export const OptionGroup: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Option groups label sets of options in select menus.' },
        accessory: {
          type: 'static_select',
          action_id: 'timezone_select',
          placeholder: { type: 'plain_text', text: 'Choose a time zone' },
          option_groups: [
            {
              label: { type: 'plain_text', text: 'North America' },
              options: [
                { text: { type: 'plain_text', text: 'America/New_York' }, value: 'America/New_York' },
                { text: { type: 'plain_text', text: 'America/Chicago' }, value: 'America/Chicago' }
              ]
            },
            {
              label: { type: 'plain_text', text: 'Europe' },
              options: [
                { text: { type: 'plain_text', text: 'Europe/Lisbon' }, value: 'Europe/Lisbon' },
                { text: { type: 'plain_text', text: 'Europe/Berlin' }, value: 'Europe/Berlin' }
              ]
            }
          ]
        }
      }
    ])
  }
};

// A `workflow` object wraps a `trigger` object (link trigger URL plus optional
// customizable input parameters); both are only used by `workflow_button`.
export const WorkflowAndTrigger: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Kick off the *weekly report* with this week’s values pre-filled.' },
        accessory: {
          type: 'workflow_button',
          text: { type: 'plain_text', text: 'Run weekly report' },
          action_id: 'weekly_report_workflow',
          workflow: {
            trigger: {
              url: 'https://slack.com/shortcuts/Ft0123ABCD/0123456789abcdef',
              customizable_input_parameters: [
                { name: 'week', value: '2026-W45' },
                { name: 'team', value: 'platform' }
              ]
            }
          }
        }
      }
    ])
  }
};

// `slack_file` references a file uploaded to Slack by `url` or `id`. The
// preview can't fetch private Slack files, so expect broken images here.
export const SlackFileObject: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'image',
        title: { type: 'plain_text', text: 'slack_file by url' },
        slack_file: { url: 'https://files.slack.com/files-pri/T0123ABCD-F0123ABCD/floor-plan.png' },
        alt_text: 'Office floor plan'
      },
      {
        type: 'image',
        title: { type: 'plain_text', text: 'slack_file by id' },
        slack_file: { id: 'F0456EFGH' },
        alt_text: 'Team photo'
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'An image *element* sourced from `slack_file`.' },
        accessory: { type: 'image', slack_file: { id: 'F0789IJKL' }, alt_text: 'Thumbnail' }
      }
    ])
  }
};

// `slack_icon` is only valid on `card` blocks, in place of `icon`.
export const SlackIconObject: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'card',
        slack_icon: { type: 'icon', name: 'rocket' },
        title: { type: 'plain_text', text: 'Release train' },
        subtitle: { type: 'plain_text', text: 'Departs Thursday' },
        body: { type: 'mrkdwn', text: 'Merge to `main` by Wednesday 18:00 to be included.' },
        actions: [
          { type: 'button', text: { type: 'plain_text', text: 'View checklist' }, action_id: 'release_checklist' }
        ]
      },
      {
        type: 'card',
        slack_icon: { type: 'icon', name: 'warning' },
        title: { type: 'plain_text', text: 'Certificate expiring' },
        body: { type: 'plain_text', text: 'api.example.com expires in 6 days.' }
      }
    ]))
  }
};
