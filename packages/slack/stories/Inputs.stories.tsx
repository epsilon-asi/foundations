import type { Meta, StoryObj } from '@storybook/react-vite';

import { renderNothing, slackPreview } from './support';

/**
 * Input blocks — rendered on the modal surface, where Slack allows them.
 */
const meta = {
  title: 'Block Kit/Inputs',
  render: renderNothing
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextInputs: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'title',
          label: { type: 'plain_text', text: 'Title' },
          element: {
            type: 'plain_text_input',
            action_id: 'title_input',
            placeholder: { type: 'plain_text', text: 'Short summary' }
          }
        },
        {
          type: 'input',
          block_id: 'description',
          label: { type: 'plain_text', text: 'Description' },
          hint: { type: 'plain_text', text: 'Markdown is supported.' },
          element: { type: 'plain_text_input', action_id: 'description_input', multiline: true }
        },
        {
          type: 'input',
          block_id: 'notes',
          optional: true,
          label: { type: 'plain_text', text: 'Internal notes' },
          element: { type: 'plain_text_input', action_id: 'notes_input' }
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const Selections: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'severity',
          label: { type: 'plain_text', text: 'Severity' },
          element: {
            type: 'static_select',
            action_id: 'severity_select',
            placeholder: { type: 'plain_text', text: 'Choose severity' },
            options: [
              { text: { type: 'plain_text', text: 'SEV-1' }, value: 'sev1' },
              { text: { type: 'plain_text', text: 'SEV-2' }, value: 'sev2' },
              { text: { type: 'plain_text', text: 'SEV-3' }, value: 'sev3' }
            ]
          }
        },
        {
          type: 'input',
          block_id: 'responders',
          label: { type: 'plain_text', text: 'Responders' },
          element: {
            type: 'multi_users_select',
            action_id: 'responders_select',
            placeholder: { type: 'plain_text', text: 'Add people' }
          }
        },
        {
          type: 'input',
          block_id: 'channel',
          label: { type: 'plain_text', text: 'Post updates to' },
          element: {
            type: 'conversations_select',
            action_id: 'channel_select',
            placeholder: { type: 'plain_text', text: 'Pick a channel' }
          }
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const ChoicesAndDates: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'notify',
          label: { type: 'plain_text', text: 'Notify' },
          element: {
            type: 'checkboxes',
            action_id: 'notify_checkboxes',
            options: [
              { text: { type: 'plain_text', text: 'Email' }, value: 'email' },
              { text: { type: 'plain_text', text: 'Slack DM' }, value: 'dm' },
              { text: { type: 'plain_text', text: 'Pager' }, value: 'pager' }
            ]
          }
        },
        {
          type: 'input',
          block_id: 'frequency',
          label: { type: 'plain_text', text: 'Digest frequency' },
          element: {
            type: 'radio_buttons',
            action_id: 'frequency_radio',
            options: [
              { text: { type: 'plain_text', text: 'Daily' }, value: 'daily' },
              { text: { type: 'plain_text', text: 'Weekly' }, value: 'weekly' }
            ]
          }
        },
        {
          type: 'input',
          block_id: 'start_date',
          label: { type: 'plain_text', text: 'Start date' },
          element: { type: 'datepicker', action_id: 'start_date_picker', initial_date: '2026-11-02' }
        },
        {
          type: 'input',
          block_id: 'start_time',
          label: { type: 'plain_text', text: 'Start time' },
          element: { type: 'timepicker', action_id: 'start_time_picker', initial_time: '09:30' }
        }
      ],
      { surface: 'modal' }
    )
  }
};
