import type { Meta, StoryObj } from '@storybook/react-vite';

import { renderNothing, SAMPLE_AVATAR, SAMPLE_IMAGE, slackPreview } from './support';

/**
 * Raw Block Kit JSON, one story per common layout block. Use the toolbar to
 * flip theme and surface; the addon panel shows validation and interactions.
 */
const meta = {
  title: 'Block Kit/Layouts',
  render: renderNothing
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Section: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Sections* are the workhorse block: mrkdwn text with _italics_, ~strike~, `code`, and <https://api.slack.com/block-kit|links>.'
        }
      }
    ])
  }
};

export const SectionFields: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*New time-off request* from *Ada Lovelace*' },
        fields: [
          { type: 'mrkdwn', text: '*Type*\nVacation' },
          { type: 'mrkdwn', text: '*When*\nNov 3 – Nov 7' },
          { type: 'mrkdwn', text: '*Days*\n5' },
          { type: 'mrkdwn', text: '*Balance after*\n9 days' }
        ]
      }
    ])
  }
};

export const SectionAccessories: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Button accessory*\nOpen the related record.' },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'Open', emoji: true },
          action_id: 'open_record',
          value: 'record_42'
        }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Image accessory*\nThumbnails sit to the right of the text.' },
        accessory: { type: 'image', image_url: SAMPLE_AVATAR, alt_text: 'Avatar' }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Overflow menu*\nSecondary actions tucked behind ⋯.' },
        accessory: {
          type: 'overflow',
          action_id: 'record_overflow',
          options: [
            { text: { type: 'plain_text', text: 'Edit' }, value: 'edit' },
            { text: { type: 'plain_text', text: 'Duplicate' }, value: 'duplicate' },
            { text: { type: 'plain_text', text: 'Archive' }, value: 'archive' }
          ]
        }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Static select*\nPick a priority.' },
        accessory: {
          type: 'static_select',
          action_id: 'set_priority',
          placeholder: { type: 'plain_text', text: 'Priority' },
          options: [
            { text: { type: 'plain_text', text: 'High' }, value: 'high' },
            { text: { type: 'plain_text', text: 'Medium' }, value: 'medium' },
            { text: { type: 'plain_text', text: 'Low' }, value: 'low' }
          ]
        }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Date picker*\nReschedule the follow-up.' },
        accessory: {
          type: 'datepicker',
          action_id: 'reschedule',
          initial_date: '2026-11-04',
          placeholder: { type: 'plain_text', text: 'Select a date' }
        }
      }
    ])
  }
};

export const HeaderAndDivider: Story = {
  parameters: {
    slackBlocks: slackPreview([
      { type: 'header', text: { type: 'plain_text', text: '📣 Weekly release notes', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: '*Highlights*\n• Faster search\n• New billing page' } },
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: '*Fixes*\n• Login loop on Safari\n• Timezone drift in reports' } }
    ])
  }
};

export const Context: Story = {
  parameters: {
    slackBlocks: slackPreview([
      { type: 'section', text: { type: 'mrkdwn', text: 'Context blocks carry small, secondary metadata.' } },
      {
        type: 'context',
        elements: [
          { type: 'image', image_url: SAMPLE_AVATAR, alt_text: 'Grace Hopper' },
          { type: 'mrkdwn', text: '*Grace Hopper* posted this' },
          { type: 'mrkdwn', text: 'Last updated Oct 30, 2026' }
        ]
      }
    ])
  }
};

export const ActionsAndButtons: Story = {
  parameters: {
    slackBlocks: slackPreview([
      { type: 'section', text: { type: 'mrkdwn', text: 'Button styles inside an *actions* block:' } },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Approve', emoji: true },
            style: 'primary',
            action_id: 'approve',
            value: 'approve'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Reject', emoji: true },
            style: 'danger',
            action_id: 'reject',
            value: 'reject'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Details', emoji: true },
            action_id: 'details'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Docs ↗', emoji: true },
            url: 'https://api.slack.com/block-kit',
            action_id: 'docs_link'
          }
        ]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'static_select',
            action_id: 'assign_team',
            placeholder: { type: 'plain_text', text: 'Assign team' },
            options: [
              { text: { type: 'plain_text', text: 'Platform' }, value: 'platform' },
              { text: { type: 'plain_text', text: 'Payments' }, value: 'payments' }
            ]
          },
          {
            type: 'users_select',
            action_id: 'assign_user',
            placeholder: { type: 'plain_text', text: 'Assign person' }
          },
          {
            type: 'datepicker',
            action_id: 'due_date',
            placeholder: { type: 'plain_text', text: 'Due date' }
          }
        ]
      }
    ])
  }
};

export const Image: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'image',
        title: { type: 'plain_text', text: 'Traffic by hour' },
        image_url: SAMPLE_IMAGE,
        alt_text: 'Sample chart image'
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: 'Images can carry an optional title above them.' }]
      }
    ])
  }
};

export const RichText: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Rich text ', style: { bold: true } },
              { type: 'text', text: 'supports inline styles, ' },
              { type: 'text', text: 'code', style: { code: true } },
              { type: 'text', text: ' and ' },
              { type: 'link', url: 'https://api.slack.com/block-kit', text: 'links' },
              { type: 'text', text: '.' }
            ]
          },
          {
            type: 'rich_text_list',
            style: 'bullet',
            elements: [
              { type: 'rich_text_section', elements: [{ type: 'text', text: 'Bulleted lists' }] },
              { type: 'rich_text_section', elements: [{ type: 'text', text: 'Quotes and preformatted blocks' }] }
            ]
          },
          {
            type: 'rich_text_quote',
            elements: [{ type: 'text', text: 'Ship small, ship often.' }]
          },
          {
            type: 'rich_text_preformatted',
            elements: [{ type: 'text', text: 'npm run storybook' }]
          }
        ]
      }
    ])
  }
};
