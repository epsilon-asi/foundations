import type { Meta, StoryObj } from '@storybook/react-vite';

import { renderNothing, SAMPLE_AVATAR, slackPreview } from '../support';

/**
 * Interactive block elements in messages — buttons, menus, overflow, pickers,
 * feedback / icon / workflow buttons and image elements — inside `section`,
 * `actions` and `context_actions` blocks.
 */
const meta = {
  title: 'Catalog/Interactive elements',
  render: renderNothing
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Buttons: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'actions',
        block_id: 'button_styles',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Default' },
            action_id: 'button_default',
            value: 'default'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Primary' },
            style: 'primary',
            action_id: 'button_primary',
            value: 'primary'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Danger' },
            style: 'danger',
            action_id: 'button_danger',
            value: 'danger'
          }
        ]
      },
      {
        type: 'actions',
        block_id: 'button_options',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open docs :books:', emoji: true },
            action_id: 'button_link',
            url: 'https://docs.example.com/getting-started'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '⋯ More' },
            action_id: 'button_a11y',
            value: 'more_options',
            accessibility_label: 'Show more options for this request'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Delete project' },
            style: 'danger',
            action_id: 'button_confirm',
            value: 'project_9',
            confirm: {
              title: { type: 'plain_text', text: 'Delete this project?' },
              text: { type: 'mrkdwn', text: 'This removes *all 42 tasks* and cannot be undone.' },
              confirm: { type: 'plain_text', text: 'Delete' },
              deny: { type: 'plain_text', text: 'Keep it' },
              style: 'danger'
            }
          }
        ]
      }
    ])
  }
};

export const ButtonAccessory: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Pull request #318* is ready for review.' },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'Review' },
          style: 'primary',
          action_id: 'review_pr',
          value: 'pr_318'
        }
      }
    ])
  }
};

export const OverflowMenu: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Invoice INV-5501*\nDue in 7 days' },
        accessory: {
          type: 'overflow',
          action_id: 'invoice_overflow',
          options: [
            { text: { type: 'plain_text', text: 'Mark as paid' }, value: 'mark_paid' },
            { text: { type: 'plain_text', text: 'Send reminder' }, value: 'remind' },
            {
              text: { type: 'plain_text', text: 'Open in browser' },
              value: 'open',
              url: 'https://billing.example.com/invoices/INV-5501'
            },
            { text: { type: 'plain_text', text: 'Void invoice' }, value: 'void' }
          ],
          confirm: {
            title: { type: 'plain_text', text: 'Are you sure?' },
            text: { type: 'plain_text', text: 'This updates the invoice for everyone.' },
            confirm: { type: 'plain_text', text: 'Continue' },
            deny: { type: 'plain_text', text: 'Cancel' }
          }
        }
      }
    ])
  }
};

export const SelectStatic: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Set the priority for *OPS-1024*' },
        accessory: {
          type: 'static_select',
          action_id: 'priority_select',
          placeholder: { type: 'plain_text', text: 'Choose priority' },
          initial_option: { text: { type: 'plain_text', text: 'Medium' }, value: 'medium' },
          options: [
            { text: { type: 'plain_text', text: 'High' }, value: 'high' },
            { text: { type: 'plain_text', text: 'Medium' }, value: 'medium' },
            { text: { type: 'plain_text', text: 'Low' }, value: 'low' }
          ]
        }
      }
    ])
  }
};

export const SelectStaticOptionGroups: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'actions',
        elements: [
          {
            type: 'static_select',
            action_id: 'office_select',
            placeholder: { type: 'plain_text', text: 'Choose an office' },
            option_groups: [
              {
                label: { type: 'plain_text', text: 'Americas' },
                options: [
                  { text: { type: 'plain_text', text: 'Toronto' }, value: 'yyz' },
                  { text: { type: 'plain_text', text: 'São Paulo' }, value: 'gru' }
                ]
              },
              {
                label: { type: 'plain_text', text: 'Europe' },
                options: [
                  { text: { type: 'plain_text', text: 'Lisbon' }, value: 'lis' },
                  { text: { type: 'plain_text', text: 'Berlin' }, value: 'ber' }
                ]
              }
            ]
          }
        ]
      }
    ])
  }
};

export const SelectExternal: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Link a customer account' },
        accessory: {
          type: 'external_select',
          action_id: 'account_lookup',
          placeholder: { type: 'plain_text', text: 'Search accounts' },
          min_query_length: 3,
          initial_option: { text: { type: 'plain_text', text: 'Example Co (EX-001)' }, value: 'acct_001' }
        }
      }
    ])
  }
};

export const SelectUsers: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Assign a reviewer' },
        accessory: {
          type: 'users_select',
          action_id: 'reviewer_select',
          placeholder: { type: 'plain_text', text: 'Select a person' },
          initial_user: 'U0123ABCD'
        }
      }
    ])
  }
};

export const SelectConversations: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Where should alerts go?' },
        accessory: {
          type: 'conversations_select',
          action_id: 'alert_destination',
          placeholder: { type: 'plain_text', text: 'Select a conversation' },
          default_to_current_conversation: true,
          filter: { include: ['public', 'private'], exclude_external_shared_channels: true, exclude_bot_users: true }
        }
      }
    ])
  }
};

export const SelectChannels: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Pick a public channel for the digest' },
        accessory: {
          type: 'channels_select',
          action_id: 'digest_channel',
          placeholder: { type: 'plain_text', text: 'Select a channel' },
          initial_channel: 'C0123ABCD'
        }
      }
    ])
  }
};

export const MultiSelectStatic: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Tag this request' },
        accessory: {
          type: 'multi_static_select',
          action_id: 'request_tags',
          placeholder: { type: 'plain_text', text: 'Select tags' },
          max_selected_items: 3,
          initial_options: [{ text: { type: 'plain_text', text: 'Billing' }, value: 'billing' }],
          options: [
            { text: { type: 'plain_text', text: 'Billing' }, value: 'billing' },
            { text: { type: 'plain_text', text: 'Access' }, value: 'access' },
            { text: { type: 'plain_text', text: 'Hardware' }, value: 'hardware' },
            { text: { type: 'plain_text', text: 'Other' }, value: 'other' }
          ]
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'multi_static_select',
            action_id: 'grouped_tags',
            placeholder: { type: 'plain_text', text: 'Grouped options' },
            option_groups: [
              {
                label: { type: 'plain_text', text: 'Frontend' },
                options: [
                  { text: { type: 'plain_text', text: 'Web' }, value: 'web' },
                  { text: { type: 'plain_text', text: 'Mobile' }, value: 'mobile' }
                ]
              },
              {
                label: { type: 'plain_text', text: 'Backend' },
                options: [
                  { text: { type: 'plain_text', text: 'API' }, value: 'api' },
                  { text: { type: 'plain_text', text: 'Jobs' }, value: 'jobs' }
                ]
              }
            ]
          }
        ]
      }
    ])
  }
};

export const MultiSelectExternal: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Link related tickets' },
        accessory: {
          type: 'multi_external_select',
          action_id: 'related_tickets',
          placeholder: { type: 'plain_text', text: 'Search tickets' },
          min_query_length: 2,
          max_selected_items: 5,
          initial_options: [{ text: { type: 'plain_text', text: 'OPS-1024' }, value: 'OPS-1024' }]
        }
      }
    ])
  }
};

export const MultiSelectUsers: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Invite attendees' },
        accessory: {
          type: 'multi_users_select',
          action_id: 'attendees',
          placeholder: { type: 'plain_text', text: 'Select people' },
          initial_users: ['U0123ABCD', 'U0456EFGH'],
          max_selected_items: 10
        }
      }
    ])
  }
};

export const MultiSelectConversations: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Share the announcement in…' },
        accessory: {
          type: 'multi_conversations_select',
          action_id: 'share_targets',
          placeholder: { type: 'plain_text', text: 'Select conversations' },
          initial_conversations: ['C0123ABCD'],
          max_selected_items: 4,
          filter: { include: ['public', 'mpim'], exclude_bot_users: true }
        }
      }
    ])
  }
};

export const MultiSelectChannels: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Subscribe channels to release notes' },
        accessory: {
          type: 'multi_channels_select',
          action_id: 'release_channels',
          placeholder: { type: 'plain_text', text: 'Select channels' },
          initial_channels: ['C0123ABCD', 'C0456EFGH'],
          max_selected_items: 5
        }
      }
    ])
  }
};

export const Checkboxes: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Launch checklist*' },
        accessory: {
          type: 'checkboxes',
          action_id: 'launch_checklist',
          initial_options: [
            { text: { type: 'mrkdwn', text: '*Docs* updated' }, value: 'docs' }
          ],
          options: [
            { text: { type: 'mrkdwn', text: '*Docs* updated' }, value: 'docs' },
            {
              text: { type: 'mrkdwn', text: '*QA* sign-off' },
              value: 'qa',
              description: { type: 'mrkdwn', text: 'Regression suite green on `main`' }
            },
            { text: { type: 'plain_text', text: 'Changelog posted' }, value: 'changelog' }
          ]
        }
      }
    ])
  }
};

export const RadioButtons: Story = {
  parameters: {
    slackBlocks: slackPreview([
      { type: 'section', text: { type: 'mrkdwn', text: '*How was today’s stand-up?*' } },
      {
        type: 'actions',
        elements: [
          {
            type: 'radio_buttons',
            action_id: 'standup_rating',
            initial_option: { text: { type: 'plain_text', text: 'Useful' }, value: 'useful' },
            options: [
              { text: { type: 'plain_text', text: 'Useful' }, value: 'useful' },
              {
                text: { type: 'plain_text', text: 'Too long' },
                value: 'too_long',
                description: { type: 'plain_text', text: 'Over 15 minutes' }
              },
              { text: { type: 'mrkdwn', text: '_Skip_' }, value: 'skip' }
            ]
          }
        ]
      }
    ])
  }
};

export const DateAndTimePickers: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Datepicker* as a section accessory' },
        accessory: {
          type: 'datepicker',
          action_id: 'review_date',
          initial_date: '2026-11-20',
          placeholder: { type: 'plain_text', text: 'Select a date' }
        }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Timepicker* with a timezone hint' },
        accessory: {
          type: 'timepicker',
          action_id: 'review_time',
          initial_time: '14:30',
          timezone: 'America/Chicago',
          placeholder: { type: 'plain_text', text: 'Select a time' }
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'datetimepicker',
            action_id: 'review_datetime',
            initial_date_time: 1795186800
          },
          {
            type: 'datepicker',
            action_id: 'confirmed_date',
            placeholder: { type: 'plain_text', text: 'With confirm' },
            confirm: {
              title: { type: 'plain_text', text: 'Reschedule?' },
              text: { type: 'plain_text', text: 'Attendees will be notified.' },
              confirm: { type: 'plain_text', text: 'Reschedule' },
              deny: { type: 'plain_text', text: 'Cancel' },
              style: 'primary'
            }
          }
        ]
      }
    ])
  }
};

// `feedback_buttons` only works inside `context_actions` (messages only).
export const FeedbackButtons: Story = {
  parameters: {
    slackBlocks: slackPreview([
      { type: 'section', text: { type: 'mrkdwn', text: 'I drafted a reply to the customer. How did I do?' } },
      {
        type: 'context_actions',
        elements: [
          {
            type: 'feedback_buttons',
            action_id: 'draft_feedback',
            positive_button: {
              text: { type: 'plain_text', text: '👍' },
              value: 'positive_feedback',
              accessibility_label: 'Mark this draft as good'
            },
            negative_button: {
              text: { type: 'plain_text', text: '👎' },
              value: 'negative_feedback',
              accessibility_label: 'Mark this draft as bad'
            }
          }
        ]
      }
    ])
  }
};

// `icon_button` only works inside `context_actions`; `trash` is the only icon.
export const IconButton: Story = {
  parameters: {
    slackBlocks: slackPreview([
      { type: 'section', text: { type: 'mrkdwn', text: 'Reminder: submit timesheets by Friday.' } },
      {
        type: 'context_actions',
        elements: [
          {
            type: 'icon_button',
            icon: 'trash',
            text: { type: 'plain_text', text: 'Delete' },
            action_id: 'delete_reminder',
            value: 'reminder_12',
            accessibility_label: 'Delete this reminder',
            visible_to_user_ids: ['U0123ABCD'],
            confirm: {
              title: { type: 'plain_text', text: 'Delete reminder?' },
              text: { type: 'plain_text', text: 'It will be removed for everyone.' },
              confirm: { type: 'plain_text', text: 'Delete' },
              deny: { type: 'plain_text', text: 'Cancel' },
              style: 'danger'
            }
          }
        ]
      }
    ])
  }
};

export const WorkflowButton: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Need equipment? Start the *hardware request* workflow.' },
        accessory: {
          type: 'workflow_button',
          text: { type: 'plain_text', text: 'Run workflow' },
          action_id: 'hardware_request_workflow',
          workflow: {
            trigger: {
              url: 'https://slack.com/shortcuts/Ft0123ABCD/0123456789abcdef',
              customizable_input_parameters: [
                { name: 'request_type', value: 'laptop' },
                { name: 'cost_center', value: 'CC-210' }
              ]
            }
          }
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'workflow_button',
            text: { type: 'plain_text', text: 'Request access' },
            style: 'primary',
            action_id: 'access_request_workflow',
            accessibility_label: 'Start the access request workflow',
            workflow: { trigger: { url: 'https://slack.com/shortcuts/Ft0456EFGH/fedcba9876543210' } }
          },
          {
            type: 'workflow_button',
            text: { type: 'plain_text', text: 'Report incident' },
            style: 'danger',
            action_id: 'incident_workflow',
            workflow: { trigger: { url: 'https://slack.com/shortcuts/Ft0789IJKL/00112233445566778' } }
          }
        ]
      }
    ])
  }
};

export const ImageElement: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Image element* as a section accessory.' },
        accessory: { type: 'image', image_url: SAMPLE_AVATAR, alt_text: 'Profile photo' }
      },
      {
        type: 'context',
        elements: [
          { type: 'image', image_url: SAMPLE_AVATAR, alt_text: 'Reviewer one' },
          { type: 'image', image_url: SAMPLE_AVATAR, alt_text: 'Reviewer two' },
          { type: 'mrkdwn', text: 'Image elements inside a *context* block.' }
        ]
      }
    ])
  }
};
