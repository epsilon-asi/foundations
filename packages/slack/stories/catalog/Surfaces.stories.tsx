import type { Meta, StoryObj } from '@storybook/react-vite';

import { renderNothing, SAMPLE_AVATAR, SAMPLE_IMAGE, slackPreview, unvalidated } from '../support';

/**
 * Kitchen sinks — many block types composed on each surface (message, modal,
 * Home tab) to check they coexist. Each uses only blocks that surface allows.
 */
const meta = {
  title: 'Catalog/Surfaces',
  render: renderNothing
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const MessageKitchenSink: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      { type: 'header', text: { type: 'plain_text', text: 'Weekly operations digest', emoji: true } },
      {
        type: 'context',
        elements: [
          { type: 'image', image_url: SAMPLE_AVATAR, alt_text: 'Bot avatar' },
          { type: 'mrkdwn', text: 'Posted by *Ops bot* in <#C0123ABCD>' }
        ]
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*3 incidents* this week, all resolved within SLA.' },
        accessory: { type: 'image', image_url: SAMPLE_AVATAR, alt_text: 'Ops icon' }
      },
      {
        type: 'table',
        rows: [
          [
            { type: 'raw_text', text: 'Incident' },
            { type: 'raw_text', text: 'Duration' }
          ],
          [
            { type: 'raw_text', text: 'INC-88' },
            { type: 'raw_text', text: '14 min' }
          ],
          [
            { type: 'raw_text', text: 'INC-91' },
            { type: 'raw_text', text: '42 min' }
          ]
        ]
      },
      {
        type: 'data_visualization',
        title: 'Incidents per week',
        chart: {
          type: 'bar',
          series: [
            {
              name: 'Incidents',
              data: [
                { label: 'W42', value: 5 },
                { label: 'W43', value: 2 },
                { label: 'W44', value: 3 }
              ]
            }
          ],
          axis_config: { categories: ['W42', 'W43', 'W44'], x_label: 'Week', y_label: 'Count' }
        }
      },
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_list',
            style: 'bullet',
            elements: [
              {
                type: 'rich_text_section',
                elements: [
                  { type: 'text', text: 'Owner: ' },
                  { type: 'user', user_id: 'U0123ABCD' }
                ]
              },
              {
                type: 'rich_text_section',
                elements: [{ type: 'text', text: 'Postmortems due Friday', style: { bold: true } }]
              }
            ]
          }
        ]
      },
      { type: 'image', image_url: SAMPLE_IMAGE, alt_text: 'Uptime chart', title: { type: 'plain_text', text: 'Uptime' } },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open dashboard' },
            style: 'primary',
            action_id: 'open_dashboard',
            url: 'https://dashboards.example.com/ops'
          },
          { type: 'button', text: { type: 'plain_text', text: 'Snooze' }, action_id: 'snooze_digest' }
        ]
      },
      {
        type: 'context_actions',
        elements: [
          {
            type: 'feedback_buttons',
            action_id: 'digest_feedback',
            positive_button: { text: { type: 'plain_text', text: 'Helpful' }, value: 'up' },
            negative_button: { text: { type: 'plain_text', text: 'Not helpful' }, value: 'down' }
          }
        ]
      }
    ]))
  }
};

export const ModalKitchenSink: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'alert',
          level: 'info',
          text: { type: 'mrkdwn', text: 'Requests are reviewed within *one business day*.' }
        },
        { type: 'header', text: { type: 'plain_text', text: 'New access request' } },
        {
          type: 'input',
          block_id: 'system',
          label: { type: 'plain_text', text: 'System' },
          element: {
            type: 'static_select',
            action_id: 'system_input',
            options: [
              { text: { type: 'plain_text', text: 'Billing console' }, value: 'billing' },
              { text: { type: 'plain_text', text: 'Data warehouse' }, value: 'warehouse' }
            ]
          }
        },
        {
          type: 'input',
          block_id: 'approver',
          label: { type: 'plain_text', text: 'Approver' },
          element: { type: 'users_select', action_id: 'approver_input' }
        },
        {
          type: 'input',
          block_id: 'until',
          label: { type: 'plain_text', text: 'Access until' },
          element: { type: 'datepicker', action_id: 'until_input' }
        },
        {
          type: 'input',
          block_id: 'reason',
          label: { type: 'plain_text', text: 'Reason' },
          element: { type: 'plain_text_input', action_id: 'reason_input', multiline: true }
        },
        { type: 'divider' },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: 'See the <https://docs.example.com/access|access policy>.' }]
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const HomeKitchenSink: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview(
      [
        { type: 'header', text: { type: 'plain_text', text: 'Good morning :wave:', emoji: true } },
        {
          type: 'alert',
          level: 'warning',
          text: { type: 'plain_text', text: '2 approvals are waiting on you.' }
        },
        {
          type: 'container',
          title: { type: 'plain_text', text: 'Your approvals' },
          is_collapsible: true,
          child_blocks: [
            {
              type: 'section',
              text: { type: 'mrkdwn', text: '*Expense #2041* — $312.40' },
              accessory: {
                type: 'button',
                text: { type: 'plain_text', text: 'Review' },
                action_id: 'review_2041'
              }
            },
            {
              type: 'section',
              text: { type: 'mrkdwn', text: '*Access request* — Data warehouse' },
              accessory: {
                type: 'button',
                text: { type: 'plain_text', text: 'Review' },
                action_id: 'review_access'
              }
            }
          ]
        },
        {
          type: 'carousel',
          elements: [
            {
              type: 'card',
              hero_image: { type: 'image', image_url: SAMPLE_IMAGE, alt_text: 'Guide cover' },
              title: { type: 'plain_text', text: 'Expense guide' },
              body: { type: 'plain_text', text: 'What you can claim and how.' }
            },
            {
              type: 'card',
              hero_image: { type: 'image', image_url: SAMPLE_IMAGE, alt_text: 'Guide cover' },
              title: { type: 'plain_text', text: 'Travel policy' },
              body: { type: 'plain_text', text: 'Booking, per diems and approvals.' }
            }
          ]
        },
        {
          type: 'data_table',
          caption: 'Recent requests',
          rows: [
            [
              { type: 'raw_text', text: 'Request' },
              { type: 'raw_text', text: 'Amount' }
            ],
            [
              { type: 'raw_text', text: 'Conference ticket' },
              { type: 'raw_number', value: 499, text: '$499' }
            ],
            [
              { type: 'raw_text', text: 'Monitor' },
              { type: 'raw_number', value: 229, text: '$229' }
            ]
          ]
        },
        {
          type: 'input',
          block_id: 'quick_note',
          label: { type: 'plain_text', text: 'Quick note' },
          element: { type: 'rich_text_input', action_id: 'quick_note_input' }
        }
      ],
      { surface: 'home' }
    ))
  }
};
