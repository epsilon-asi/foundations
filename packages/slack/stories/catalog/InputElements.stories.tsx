import type { Meta, StoryObj } from '@storybook/react-vite';

import { renderNothing, slackPreview } from '../support';

/**
 * Every element that works inside an `input` block, rendered on the modal
 * surface where Slack collects input.
 */
const meta = {
  title: 'Catalog/Input elements',
  render: renderNothing
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlainTextInput: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'ticket_title',
          label: { type: 'plain_text', text: 'Title' },
          hint: { type: 'plain_text', text: 'Between 5 and 80 characters.' },
          element: {
            type: 'plain_text_input',
            action_id: 'ticket_title_input',
            placeholder: { type: 'plain_text', text: 'Short summary' },
            min_length: 5,
            max_length: 80,
            focus_on_load: true
          }
        },
        {
          type: 'input',
          block_id: 'ticket_reference',
          optional: true,
          label: { type: 'plain_text', text: 'Reference' },
          element: {
            type: 'plain_text_input',
            action_id: 'ticket_reference_input',
            initial_value: 'REF-0001'
          }
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const PlainTextInputMultiline: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'ticket_description',
          label: { type: 'plain_text', text: 'Description' },
          element: {
            type: 'plain_text_input',
            action_id: 'ticket_description_input',
            multiline: true,
            max_length: 3000,
            placeholder: { type: 'plain_text', text: 'What happened, and what did you expect?' }
          }
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const PlainTextInputDispatchAction: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'live_search',
          dispatch_action: true,
          label: { type: 'plain_text', text: 'Search the knowledge base' },
          hint: { type: 'plain_text', text: 'Results update as you type.' },
          element: {
            type: 'plain_text_input',
            action_id: 'live_search_input',
            dispatch_action_config: { trigger_actions_on: ['on_character_entered'] }
          }
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const EmailInput: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'contact_email',
          label: { type: 'plain_text', text: 'Contact email' },
          element: {
            type: 'email_text_input',
            action_id: 'contact_email_input',
            placeholder: { type: 'plain_text', text: 'name@example.com' }
          }
        },
        {
          type: 'input',
          block_id: 'billing_email',
          optional: true,
          label: { type: 'plain_text', text: 'Billing email' },
          element: {
            type: 'email_text_input',
            action_id: 'billing_email_input',
            initial_value: 'billing@example.com'
          }
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const UrlInput: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'repo_url',
          label: { type: 'plain_text', text: 'Repository URL' },
          element: {
            type: 'url_text_input',
            action_id: 'repo_url_input',
            placeholder: { type: 'plain_text', text: 'https://git.example.com/team/repo' }
          }
        },
        {
          type: 'input',
          block_id: 'docs_url',
          optional: true,
          label: { type: 'plain_text', text: 'Docs URL' },
          element: {
            type: 'url_text_input',
            action_id: 'docs_url_input',
            initial_value: 'https://docs.example.com'
          }
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const NumberInput: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'seat_count',
          label: { type: 'plain_text', text: 'Seats' },
          hint: { type: 'plain_text', text: 'Whole numbers between 1 and 500.' },
          element: {
            type: 'number_input',
            action_id: 'seat_count_input',
            is_decimal_allowed: false,
            min_value: '1',
            max_value: '500',
            initial_value: '25'
          }
        },
        {
          type: 'input',
          block_id: 'discount',
          label: { type: 'plain_text', text: 'Discount (%)' },
          element: {
            type: 'number_input',
            action_id: 'discount_input',
            is_decimal_allowed: true,
            min_value: '0',
            max_value: '100',
            placeholder: { type: 'plain_text', text: '12.5' }
          }
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const FileInput: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'receipts',
          label: { type: 'plain_text', text: 'Receipts' },
          hint: { type: 'plain_text', text: 'Up to 3 images or PDFs.' },
          element: {
            type: 'file_input',
            action_id: 'receipts_input',
            filetypes: ['png', 'jpg', 'pdf'],
            max_files: 3
          }
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const RichTextInput: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'announcement_body',
          label: { type: 'plain_text', text: 'Announcement' },
          element: {
            type: 'rich_text_input',
            action_id: 'announcement_body_input',
            placeholder: { type: 'plain_text', text: 'Write something…' },
            min_lines: 3,
            max_lines: 10,
            initial_value: {
              type: 'rich_text',
              elements: [
                {
                  type: 'rich_text_section',
                  elements: [
                    { type: 'text', text: 'Hello team, ' },
                    { type: 'text', text: 'the office is closed Monday.', style: { bold: true } }
                  ]
                }
              ]
            }
          }
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const Checkboxes: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'notifications',
          label: { type: 'plain_text', text: 'Notify me about' },
          element: {
            type: 'checkboxes',
            action_id: 'notifications_input',
            initial_options: [{ text: { type: 'plain_text', text: 'Mentions' }, value: 'mentions' }],
            options: [
              { text: { type: 'plain_text', text: 'Mentions' }, value: 'mentions' },
              {
                text: { type: 'plain_text', text: 'Status changes' },
                value: 'status',
                description: { type: 'plain_text', text: 'When a ticket moves column' }
              },
              { text: { type: 'mrkdwn', text: '*Weekly* digest' }, value: 'digest' }
            ]
          }
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const RadioButtons: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'visibility',
          label: { type: 'plain_text', text: 'Visibility' },
          element: {
            type: 'radio_buttons',
            action_id: 'visibility_input',
            initial_option: { text: { type: 'plain_text', text: 'Team' }, value: 'team' },
            options: [
              { text: { type: 'plain_text', text: 'Only me' }, value: 'private' },
              { text: { type: 'plain_text', text: 'Team' }, value: 'team' },
              {
                text: { type: 'plain_text', text: 'Everyone' },
                value: 'org',
                description: { type: 'plain_text', text: 'Visible to the whole organisation' }
              }
            ]
          }
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const DatePicker: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'start_date',
          label: { type: 'plain_text', text: 'Start date' },
          element: {
            type: 'datepicker',
            action_id: 'start_date_input',
            initial_date: '2026-12-01',
            placeholder: { type: 'plain_text', text: 'Select a date' }
          }
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const TimePicker: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'meeting_time',
          label: { type: 'plain_text', text: 'Meeting time' },
          element: {
            type: 'timepicker',
            action_id: 'meeting_time_input',
            initial_time: '09:30',
            timezone: 'Europe/Lisbon',
            placeholder: { type: 'plain_text', text: 'Select a time' }
          }
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const DatetimePicker: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'maintenance_window',
          label: { type: 'plain_text', text: 'Maintenance window starts' },
          element: {
            type: 'datetimepicker',
            action_id: 'maintenance_window_input',
            initial_date_time: 1795186800
          }
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const SelectMenus: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'severity',
          label: { type: 'plain_text', text: 'Severity (static_select)' },
          element: {
            type: 'static_select',
            action_id: 'severity_input',
            placeholder: { type: 'plain_text', text: 'Choose severity' },
            options: [
              {
                text: { type: 'plain_text', text: 'SEV1' },
                value: 'sev1',
                description: { type: 'plain_text', text: 'Customer-facing outage' }
              },
              { text: { type: 'plain_text', text: 'SEV2' }, value: 'sev2' },
              { text: { type: 'plain_text', text: 'SEV3' }, value: 'sev3' }
            ]
          }
        },
        {
          type: 'input',
          block_id: 'region',
          label: { type: 'plain_text', text: 'Region (option_groups)' },
          element: {
            type: 'static_select',
            action_id: 'region_input',
            initial_option: { text: { type: 'plain_text', text: 'eu-west' }, value: 'eu-west' },
            option_groups: [
              {
                label: { type: 'plain_text', text: 'Americas' },
                options: [
                  { text: { type: 'plain_text', text: 'us-east' }, value: 'us-east' },
                  { text: { type: 'plain_text', text: 'us-west' }, value: 'us-west' }
                ]
              },
              {
                label: { type: 'plain_text', text: 'Europe' },
                options: [{ text: { type: 'plain_text', text: 'eu-west' }, value: 'eu-west' }]
              }
            ]
          }
        },
        {
          type: 'input',
          block_id: 'service',
          label: { type: 'plain_text', text: 'Service (external_select)' },
          element: {
            type: 'external_select',
            action_id: 'service_input',
            min_query_length: 2,
            placeholder: { type: 'plain_text', text: 'Search services' }
          }
        },
        {
          type: 'input',
          block_id: 'incident_lead',
          label: { type: 'plain_text', text: 'Incident lead (users_select)' },
          element: { type: 'users_select', action_id: 'incident_lead_input', initial_user: 'U0123ABCD' }
        },
        {
          type: 'input',
          block_id: 'war_room',
          label: { type: 'plain_text', text: 'War room (conversations_select)' },
          element: {
            type: 'conversations_select',
            action_id: 'war_room_input',
            response_url_enabled: true,
            filter: { include: ['private'], exclude_bot_users: true }
          }
        },
        {
          type: 'input',
          block_id: 'status_channel',
          label: { type: 'plain_text', text: 'Status channel (channels_select)' },
          element: {
            type: 'channels_select',
            action_id: 'status_channel_input',
            initial_channel: 'C0123ABCD',
            response_url_enabled: true
          }
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const MultiSelectMenus: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'labels',
          label: { type: 'plain_text', text: 'Labels (multi_static_select)' },
          element: {
            type: 'multi_static_select',
            action_id: 'labels_input',
            max_selected_items: 3,
            options: [
              { text: { type: 'plain_text', text: 'bug' }, value: 'bug' },
              { text: { type: 'plain_text', text: 'feature' }, value: 'feature' },
              { text: { type: 'plain_text', text: 'chore' }, value: 'chore' }
            ]
          }
        },
        {
          type: 'input',
          block_id: 'customers',
          optional: true,
          label: { type: 'plain_text', text: 'Affected customers (multi_external_select)' },
          element: { type: 'multi_external_select', action_id: 'customers_input', min_query_length: 3 }
        },
        {
          type: 'input',
          block_id: 'responders',
          label: { type: 'plain_text', text: 'Responders (multi_users_select)' },
          element: {
            type: 'multi_users_select',
            action_id: 'responders_input',
            initial_users: ['U0123ABCD']
          }
        },
        {
          type: 'input',
          block_id: 'notify_conversations',
          label: { type: 'plain_text', text: 'Notify (multi_conversations_select)' },
          element: {
            type: 'multi_conversations_select',
            action_id: 'notify_conversations_input',
            default_to_current_conversation: true,
            filter: { include: ['public', 'private', 'im'], exclude_external_shared_channels: true }
          }
        },
        {
          type: 'input',
          block_id: 'crosspost_channels',
          label: { type: 'plain_text', text: 'Cross-post (multi_channels_select)' },
          element: {
            type: 'multi_channels_select',
            action_id: 'crosspost_channels_input',
            initial_channels: ['C0123ABCD'],
            max_selected_items: 3
          }
        }
      ],
      { surface: 'modal' }
    )
  }
};
