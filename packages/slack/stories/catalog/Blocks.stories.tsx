import type { Meta, StoryObj } from '@storybook/react-vite';

import { renderNothing, SAMPLE_AVATAR, SAMPLE_IMAGE, slackPreview, unvalidated } from '../support';

/**
 * Block catalog — one story per block type in Slack's Block Kit reference
 * (https://docs.slack.dev/reference/block-kit/blocks), all 22 of them. Each
 * story sits on a surface Slack allows that block on.
 */
const meta = {
  title: 'Catalog/Blocks',
  render: renderNothing
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Actions: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Expense report #2041* is waiting for your review.' }
      },
      {
        type: 'actions',
        block_id: 'expense_actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Approve' },
            style: 'primary',
            action_id: 'approve_expense',
            value: 'expense_2041'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Reject' },
            style: 'danger',
            action_id: 'reject_expense',
            value: 'expense_2041'
          },
          {
            type: 'static_select',
            action_id: 'expense_category',
            placeholder: { type: 'plain_text', text: 'Recategorise' },
            options: [
              { text: { type: 'plain_text', text: 'Travel' }, value: 'travel' },
              { text: { type: 'plain_text', text: 'Meals' }, value: 'meals' },
              { text: { type: 'plain_text', text: 'Software' }, value: 'software' }
            ]
          },
          {
            type: 'datepicker',
            action_id: 'expense_due',
            initial_date: '2026-11-14',
            placeholder: { type: 'plain_text', text: 'Pay by' }
          },
          {
            type: 'overflow',
            action_id: 'expense_more',
            options: [
              { text: { type: 'plain_text', text: 'View receipt' }, value: 'receipt' },
              { text: { type: 'plain_text', text: 'Reassign' }, value: 'reassign' }
            ]
          }
        ]
      }
    ])
  }
};

// Slack only supports `alert` in modals (and Home tabs).
export const Alert: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        { type: 'alert', text: { type: 'plain_text', text: 'Drafts are saved automatically.' } },
        {
          type: 'alert',
          level: 'default',
          text: { type: 'mrkdwn', text: '`level: default` — the same as omitting it.' }
        },
        {
          type: 'alert',
          level: 'info',
          text: { type: 'mrkdwn', text: 'Your workspace renews on *Dec 1*.', verbatim: false }
        },
        {
          type: 'alert',
          level: 'success',
          text: { type: 'mrkdwn', text: 'Release *v4.2.0* deployed to production.' }
        },
        {
          type: 'alert',
          level: 'warning',
          text: { type: 'mrkdwn', text: 'Storage is at *92%* of the plan limit.' }
        },
        {
          type: 'alert',
          level: 'error',
          text: { type: 'mrkdwn', text: 'Sync failed: the upstream API returned `503`.' }
        }
      ],
      { surface: 'modal' }
    )
  }
};

export const Card: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'card',
        block_id: 'onboarding_card',
        icon: { type: 'image', image_url: SAMPLE_AVATAR, alt_text: 'Team icon' },
        title: { type: 'mrkdwn', text: 'New-hire onboarding', verbatim: false },
        subtitle: { type: 'mrkdwn', text: 'People Operations', verbatim: false },
        hero_image: { type: 'image', image_url: SAMPLE_IMAGE, alt_text: 'Office lobby' },
        body: {
          type: 'mrkdwn',
          text: 'Complete your *first-week checklist* before Friday.',
          verbatim: false
        },
        subtext: { type: 'plain_text', text: '4 of 9 steps complete' },
        actions: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Skip for now' },
            style: 'danger',
            action_id: 'onboarding_skip'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Details' },
            action_id: 'onboarding_details'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Continue' },
            style: 'primary',
            action_id: 'onboarding_continue'
          }
        ]
      }
    ]))
  }
};

// Slack allows `carousel` in messages and Home tabs, not modals.
export const Carousel: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'carousel',
        elements: [
          {
            type: 'card',
            block_id: 'carousel_card_1',
            icon: { type: 'image', image_url: SAMPLE_AVATAR, alt_text: 'Icon' },
            title: { type: 'mrkdwn', text: 'Design review', verbatim: false },
            subtitle: { type: 'mrkdwn', text: 'Tuesday · 10:00', verbatim: false },
            hero_image: { type: 'image', image_url: SAMPLE_IMAGE, alt_text: 'Design board' },
            body: { type: 'mrkdwn', text: 'Walkthrough of the new settings flow.', verbatim: false },
            actions: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'RSVP' },
                action_id: 'rsvp_design_review'
              }
            ]
          },
          {
            type: 'card',
            block_id: 'carousel_card_2',
            icon: { type: 'image', image_url: SAMPLE_AVATAR, alt_text: 'Icon' },
            title: { type: 'mrkdwn', text: 'Quarterly planning', verbatim: false },
            subtitle: { type: 'mrkdwn', text: 'Wednesday · 14:00', verbatim: false },
            hero_image: { type: 'image', image_url: SAMPLE_IMAGE, alt_text: 'Planning wall' },
            body: { type: 'mrkdwn', text: 'Bring your top three priorities.', verbatim: false },
            actions: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'RSVP' },
                action_id: 'rsvp_planning'
              }
            ]
          },
          {
            type: 'card',
            block_id: 'carousel_card_3',
            icon: { type: 'image', image_url: SAMPLE_AVATAR, alt_text: 'Icon' },
            title: { type: 'mrkdwn', text: 'Team lunch', verbatim: false },
            subtitle: { type: 'mrkdwn', text: 'Friday · 12:30', verbatim: false },
            hero_image: { type: 'image', image_url: SAMPLE_IMAGE, alt_text: 'Lunch table' },
            body: { type: 'mrkdwn', text: 'Dietary preferences in the thread.', verbatim: false },
            actions: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'RSVP' },
                action_id: 'rsvp_lunch'
              }
            ]
          }
        ]
      }
    ])
  }
};

// Slack allows `container` in messages and Home tabs, not modals.
export const Container: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'container',
        block_id: 'bulk_update',
        title: { type: 'plain_text', text: 'Bulk update: 2 tickets selected' },
        subtitle: { type: 'plain_text', text: 'Review changes before confirming' },
        icon: { type: 'image', image_url: SAMPLE_AVATAR, alt_text: 'Tracker icon' },
        is_collapsible: true,
        child_blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*OPS-1024*\nStatus: Open → Closed\nAssignee: <@U0123ABCD>' }
          },
          { type: 'divider' },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*OPS-1025*\nStatus: In progress → Closed\nAssignee: <@U0456EFGH>' }
          },
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: ':white_check_mark: 2 tickets will be updated' }]
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Confirm all' },
                style: 'primary',
                action_id: 'bulk_confirm'
              },
              { type: 'button', text: { type: 'plain_text', text: 'Cancel' }, action_id: 'bulk_cancel' }
            ]
          }
        ]
      }
    ]))
  }
};

export const ContainerVariants: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'container',
        title: { type: 'plain_text', text: 'Collapsed by default' },
        is_collapsible: true,
        default_collapsed: true,
        child_blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Hidden until expanded.' } }]
      },
      {
        type: 'container',
        title: { type: 'plain_text', text: 'Static with header divider' },
        subtitle: { type: 'mrkdwn', text: '_Not collapsible_, `has_header_divider: true`' },
        has_header_divider: true,
        width: 'wide',
        child_blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Width set to `wide`.' } }]
      },
      {
        type: 'container',
        rich_text_title: {
          type: 'rich_text',
          elements: [
            {
              type: 'rich_text_section',
              elements: [
                { type: 'text', text: 'Rich text title ' },
                { type: 'text', text: 'with styling', style: { bold: true } }
              ]
            }
          ]
        },
        width: 'full',
        child_blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: '`rich_text_title` takes precedence over `title`; width `full`.' } }
        ]
      },
      {
        type: 'container',
        title: { type: 'plain_text', text: 'Narrow' },
        width: 'narrow',
        child_blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Width set to `narrow`.' } }]
      }
    ]))
  }
};

export const Context: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'context',
        elements: [
          { type: 'image', image_url: SAMPLE_AVATAR, alt_text: 'Avatar' },
          { type: 'mrkdwn', text: '*<@U0123ABCD>* posted in <#C0123ABCD> · 2 min ago' }
        ]
      },
      {
        type: 'context',
        elements: [
          { type: 'plain_text', text: 'Last synced 09:41 UTC', emoji: true },
          { type: 'mrkdwn', text: '<https://status.example.com|Status page>' }
        ]
      }
    ])
  }
};

// `context_actions` is message-only and holds feedback buttons and icon buttons.
export const ContextActions: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Here is a summary of the last 20 messages in <#C0123ABCD>. Was it useful?'
        }
      },
      {
        type: 'context_actions',
        block_id: 'summary_feedback',
        elements: [
          {
            type: 'feedback_buttons',
            action_id: 'summary_feedback_buttons',
            positive_button: {
              text: { type: 'plain_text', text: 'Good response' },
              value: 'positive_feedback',
              accessibility_label: 'Mark this summary as helpful'
            },
            negative_button: {
              text: { type: 'plain_text', text: 'Bad response' },
              value: 'negative_feedback',
              accessibility_label: 'Mark this summary as unhelpful'
            }
          },
          {
            type: 'icon_button',
            icon: 'trash',
            text: { type: 'plain_text', text: 'Delete' },
            action_id: 'delete_summary',
            value: 'summary_42'
          }
        ]
      }
    ])
  }
};

export const DataTable: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'data_table',
        block_id: 'open_tickets',
        caption: 'Open tickets by owner',
        page_size: 4,
        row_header_column_index: 0,
        rows: [
          [
            { type: 'raw_text', text: 'Ticket' },
            { type: 'raw_text', text: 'Priority' },
            { type: 'raw_text', text: 'Age (days)' },
            { type: 'raw_text', text: 'Action' }
          ],
          [
            { type: 'raw_text', text: 'OPS-1024' },
            {
              type: 'rich_text',
              elements: [
                { type: 'rich_text_section', elements: [{ type: 'text', text: 'High', style: { bold: true } }] }
              ]
            },
            { type: 'raw_number', value: 12, text: '12' },
            {
              type: 'action_cell',
              element: {
                type: 'button',
                text: { type: 'plain_text', text: 'Mark done' },
                action_id: 'mark_done_1024',
                value: 'OPS-1024'
              },
              fallback: { type: 'raw_text', text: 'Open' }
            }
          ],
          [
            { type: 'raw_text', text: 'OPS-1031' },
            { type: 'raw_text', text: 'Medium' },
            { type: 'raw_number', value: 5, text: '5' },
            {
              type: 'action_cell',
              element: {
                type: 'button',
                text: { type: 'plain_text', text: 'Mark done' },
                action_id: 'mark_done_1031',
                value: 'OPS-1031'
              },
              fallback: { type: 'raw_text', text: 'Open' }
            }
          ],
          [
            { type: 'raw_text', text: 'OPS-1040' },
            {
              type: 'rich_text',
              elements: [
                { type: 'rich_text_section', elements: [{ type: 'text', text: 'Low', style: { italic: true } }] }
              ]
            },
            { type: 'raw_number', value: 1, text: '1' },
            { type: 'raw_text', text: '—' }
          ],
          [
            { type: 'raw_text', text: 'OPS-1043' },
            { type: 'raw_text', text: 'Medium' },
            { type: 'raw_number', value: 2, text: '2' },
            { type: 'raw_text', text: '—' }
          ],
          [
            { type: 'raw_text', text: 'OPS-1049' },
            { type: 'raw_text', text: 'High' },
            { type: 'raw_number', value: 0.5, text: '0.5' },
            { type: 'raw_text', text: '—' }
          ]
        ]
      }
    ]))
  }
};

export const DataVisualizationPie: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'data_visualization',
        block_id: 'tickets_by_channel',
        title: 'Support tickets by channel',
        chart: {
          type: 'pie',
          segments: [
            { label: 'Email', value: 45 },
            { label: 'Chat', value: 28 },
            { label: 'Phone', value: 18 },
            { label: 'Web form', value: 9 }
          ]
        }
      }
    ]))
  }
};

export const DataVisualizationBar: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'data_visualization',
        title: 'Deploys per team',
        chart: {
          type: 'bar',
          series: [
            {
              name: 'This sprint',
              data: [
                { label: 'Platform', value: 14 },
                { label: 'Payments', value: 9 },
                { label: 'Mobile', value: 6 },
                { label: 'Data', value: 11 }
              ]
            },
            {
              name: 'Last sprint',
              data: [
                { label: 'Platform', value: 10 },
                { label: 'Payments', value: 12 },
                { label: 'Mobile', value: 4 },
                { label: 'Data', value: 8 }
              ]
            }
          ],
          axis_config: {
            categories: ['Platform', 'Payments', 'Mobile', 'Data'],
            x_label: 'Team',
            y_label: 'Deploys'
          }
        }
      }
    ]))
  }
};

export const DataVisualizationArea: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'data_visualization',
        title: 'Daily active users',
        chart: {
          type: 'area',
          series: [
            {
              name: 'Free tier',
              data: [
                { label: 'Mon', value: 12000 },
                { label: 'Tue', value: 13500 },
                { label: 'Wed', value: 15200 },
                { label: 'Thu', value: 14800 },
                { label: 'Fri', value: 16400 }
              ]
            },
            {
              name: 'Paid tier',
              data: [
                { label: 'Mon', value: 4500 },
                { label: 'Tue', value: 4800 },
                { label: 'Wed', value: 5100 },
                { label: 'Thu', value: 5600 },
                { label: 'Fri', value: 6200 }
              ]
            }
          ],
          axis_config: { categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], x_label: 'Day', y_label: 'Users' }
        }
      }
    ]))
  }
};

export const DataVisualizationLine: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'data_visualization',
        title: 'API latency (p95)',
        chart: {
          type: 'line',
          series: [
            {
              name: 'us-east',
              data: [
                { label: 'Week 1', value: 210 },
                { label: 'Week 2', value: 195 },
                { label: 'Week 3', value: 240 },
                { label: 'Week 4', value: 180 },
                { label: 'Week 5', value: 172 }
              ]
            },
            {
              name: 'eu-west',
              data: [
                { label: 'Week 1', value: 260 },
                { label: 'Week 2', value: 250 },
                { label: 'Week 3', value: 231 },
                { label: 'Week 4', value: 228 },
                { label: 'Week 5', value: 205 }
              ]
            }
          ],
          axis_config: {
            categories: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
            x_label: 'Week',
            y_label: 'Latency (ms)'
          }
        }
      }
    ]))
  }
};

export const Divider: Story = {
  parameters: {
    slackBlocks: slackPreview([
      { type: 'section', text: { type: 'mrkdwn', text: 'Above the divider.' } },
      { type: 'divider', block_id: 'divider_1' },
      { type: 'section', text: { type: 'mrkdwn', text: 'Below the divider.' } }
    ])
  }
};

// Apps can't send `file` blocks — Slack only includes them when you retrieve a
// message that shares a remote file, so validation flags it and the preview
// has no file metadata to draw.
export const File: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'A `file` block as it appears in a *retrieved* message:' }
      },
      { type: 'file', external_id: 'EXT-QUARTERLY-REPORT', source: 'remote' }
    ])
  }
};

export const Header: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      { type: 'header', text: { type: 'plain_text', text: 'Weekly status :rocket:', emoji: true } },
      { type: 'header', level: 1, text: { type: 'plain_text', text: 'Level 1 heading' } },
      { type: 'header', level: 2, text: { type: 'plain_text', text: 'Level 2 heading' } },
      { type: 'header', level: 3, text: { type: 'plain_text', text: 'Level 3 heading' } },
      { type: 'header', level: 4, text: { type: 'plain_text', text: 'Level 4 heading' } }
    ]))
  }
};

export const Image: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'image',
        block_id: 'chart_image',
        title: { type: 'plain_text', text: 'Office floor plan' },
        image_url: SAMPLE_IMAGE,
        alt_text: 'Floor plan of the third floor'
      },
      { type: 'image', image_url: SAMPLE_IMAGE, alt_text: 'Untitled image' }
    ])
  }
};

export const Input: Story = {
  parameters: {
    slackBlocks: slackPreview(
      [
        {
          type: 'input',
          block_id: 'project_name',
          label: { type: 'plain_text', text: 'Project name' },
          hint: { type: 'plain_text', text: 'Shown in the project directory.' },
          element: {
            type: 'plain_text_input',
            action_id: 'project_name_input',
            placeholder: { type: 'plain_text', text: 'e.g. Billing revamp' }
          }
        },
        {
          type: 'input',
          block_id: 'project_owner',
          optional: true,
          label: { type: 'plain_text', text: 'Owner' },
          element: { type: 'users_select', action_id: 'project_owner_select' }
        },
        {
          type: 'input',
          block_id: 'project_search',
          dispatch_action: true,
          label: { type: 'plain_text', text: 'Search similar projects' },
          element: { type: 'plain_text_input', action_id: 'project_search_input' }
        }
      ],
      { surface: 'modal' }
    )
  }
};

// The 0.1.1 renderer has no `layout` support yet, so this draws nothing in the
// preview — check the JSON in the panel / Block Kit Builder.
export const Layout: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'layout',
        block_id: 'deal_summary_layout',
        label: 'Renewal summary',
        is_label_visible: true,
        grid_lines: 'rows',
        rows: [
          {
            items: [
              { block: { type: 'section', text: { type: 'mrkdwn', text: '*Stage*\nNegotiation' } } },
              { block: { type: 'section', text: { type: 'mrkdwn', text: '*Amount*\n$125,000' } } },
              { block: { type: 'section', text: { type: 'mrkdwn', text: '*Close*\n2026-12-15' } } }
            ]
          },
          {
            items: [
              {
                width: 'wide',
                block: {
                  type: 'section',
                  text: { type: 'mrkdwn', text: '*Next steps*\nSchedule a sponsor meeting and finalise the agreement.' }
                }
              },
              {
                width: 'narrow',
                horizontal_alignment: 'center',
                block: { type: 'image', image_url: SAMPLE_AVATAR, alt_text: 'Account owner' }
              }
            ]
          },
          {
            items: [
              {
                width: 'narrow',
                horizontal_alignment: 'end',
                block: {
                  type: 'actions',
                  elements: [
                    {
                      type: 'button',
                      text: { type: 'plain_text', text: 'Open record' },
                      style: 'primary',
                      action_id: 'open_record'
                    },
                    {
                      type: 'button',
                      text: { type: 'plain_text', text: 'Mark lost' },
                      style: 'danger',
                      action_id: 'mark_lost'
                    }
                  ]
                }
              }
            ]
          }
        ],
        fallback: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Renewal summary*\nStage: Negotiation · Amount: $125,000 · Close: 2026-12-15'
            }
          }
        ]
      }
    ]))
  }
};

export const LayoutWithContainer: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'layout',
        label: 'Side-by-side containers',
        grid_lines: 'outer',
        rows: [
          {
            items: [
              {
                horizontal_alignment: 'start',
                block: {
                  type: 'container',
                  title: { type: 'plain_text', text: 'Blockers' },
                  child_blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Waiting on the security review.' } }]
                }
              },
              {
                block: {
                  type: 'container',
                  title: { type: 'plain_text', text: 'Highlights' },
                  child_blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Beta opened to 40 customers.' } }]
                }
              }
            ]
          }
        ]
      }
    ]))
  }
};

// `markdown` is message-only and renders standard markdown, not Slack mrkdwn.
export const Markdown: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'markdown',
        text: [
          '# Release notes',
          '',
          '**Bold**, _italic_, ~~strikethrough~~, `inline code` and [a link](https://example.com).',
          '',
          '- Unordered item',
          '- Another item',
          '',
          '1. Ordered item',
          '2. Second item',
          '',
          '- [x] Completed task',
          '- [ ] Open task',
          '',
          '> A block quote.',
          '',
          '| Service | Status |',
          '| ------- | ------ |',
          '| api     | OK     |',
          '',
          '```python',
          'print("hello")',
          '```',
          '',
          '---'
        ].join('\n')
      }
    ])
  }
};

// `plan` is message-only. Plan tasks are task-card objects without a `type`.
export const Plan: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'plan',
        block_id: 'quarterly_report_plan',
        title: 'Preparing the quarterly report',
        tasks: [
          {
            task_id: 'call_001',
            title: 'Fetched revenue figures',
            status: 'complete',
            output: {
              type: 'rich_text',
              elements: [
                { type: 'rich_text_section', elements: [{ type: 'text', text: 'Loaded 3 months of invoices.' }] }
              ]
            }
          },
          {
            task_id: 'call_002',
            title: 'Comparing with last quarter',
            status: 'in_progress',
            details: {
              type: 'rich_text',
              elements: [
                { type: 'rich_text_section', elements: [{ type: 'text', text: 'Computing growth by region…' }] }
              ]
            },
            sources: [{ type: 'url', url: 'https://reports.example.com/q2', text: 'Q2 report' }]
          },
          {
            task_id: 'call_003',
            title: 'Exporting charts',
            status: 'error',
            output: {
              type: 'rich_text',
              elements: [
                { type: 'rich_text_section', elements: [{ type: 'text', text: 'Chart service timed out.' }] }
              ]
            }
          }
        ]
      }
    ])
  }
};

export const RichText: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'rich_text',
        block_id: 'rich_text_overview',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'A ' },
              { type: 'text', text: 'rich_text', style: { code: true } },
              { type: 'text', text: ' block holds sections, lists, quotes and preformatted text. Ping ' },
              { type: 'user', user_id: 'U0123ABCD' },
              { type: 'text', text: ' in ' },
              { type: 'channel', channel_id: 'C0123ABCD' },
              { type: 'text', text: '.' }
            ]
          },
          {
            type: 'rich_text_list',
            style: 'bullet',
            elements: [
              { type: 'rich_text_section', elements: [{ type: 'text', text: 'First point' }] },
              { type: 'rich_text_section', elements: [{ type: 'text', text: 'Second point' }] }
            ]
          },
          {
            type: 'rich_text_quote',
            elements: [{ type: 'text', text: 'Ship small, ship often.' }]
          },
          {
            type: 'rich_text_preformatted',
            elements: [{ type: 'text', text: 'npm run build && npm test' }]
          }
        ]
      }
    ])
  }
};

export const Section: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'section',
        block_id: 'section_text',
        text: {
          type: 'mrkdwn',
          text: '*Section* text supports mrkdwn: _italic_, ~strike~, `code`, <https://example.com|links>, <@U0123ABCD> and <#C0123ABCD>.'
        }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Time-off request*' },
        fields: [
          { type: 'mrkdwn', text: '*Type*\nVacation' },
          { type: 'mrkdwn', text: '*When*\nDec 22 – Dec 31' },
          { type: 'plain_text', text: 'Days: 6' },
          { type: 'plain_text', text: 'Balance after: 9' }
        ]
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Sections can carry an *accessory* element on the right.' },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'Open' },
          action_id: 'open_request',
          value: 'request_77'
        }
      },
      {
        type: 'section',
        expand: true,
        text: {
          type: 'mrkdwn',
          text: '`expand: true` keeps long text fully expanded instead of collapsing it behind “See more”. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'
        }
      }
    ])
  }
};

export const Table: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'table',
        block_id: 'service_status',
        column_settings: [{ is_wrapped: true }, { align: 'center' }, { align: 'right' }],
        rows: [
          [
            { type: 'raw_text', text: 'Service' },
            { type: 'raw_text', text: 'Status' },
            { type: 'raw_text', text: 'P95 (ms)' }
          ],
          [
            {
              type: 'rich_text',
              elements: [
                {
                  type: 'rich_text_section',
                  elements: [{ type: 'link', url: 'https://status.example.com/api', text: 'api' }]
                }
              ]
            },
            { type: 'raw_text', text: 'OK' },
            { type: 'raw_number', value: 120, text: '120' }
          ],
          [
            { type: 'raw_text', text: 'web' },
            { type: 'raw_text', text: 'OK' },
            { type: 'raw_number', value: 210, text: '210' }
          ],
          [
            { type: 'raw_text', text: 'background worker' },
            { type: 'raw_text', text: 'Degraded' },
            { type: 'raw_number', value: 3100, text: '3,100' }
          ]
        ]
      }
    ]))
  }
};

// `task_card` is message-only.
export const TaskCard: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'task_card',
        block_id: 'timeline_task',
        task_id: 'task_1',
        title: 'Gathering incident timeline',
        status: 'in_progress',
        details: {
          type: 'rich_text',
          elements: [
            {
              type: 'rich_text_section',
              elements: [
                { type: 'text', text: 'Reading alerts from ' },
                { type: 'channel', channel_id: 'C0123ABCD' }
              ]
            }
          ]
        },
        output: {
          type: 'rich_text',
          elements: [
            { type: 'rich_text_section', elements: [{ type: 'text', text: 'Found 14 related alerts from 2 sources.' }] }
          ]
        },
        sources: [
          { type: 'url', url: 'https://status.example.com/', text: 'Status page' },
          { type: 'url', url: 'https://runbooks.example.com/incidents', text: 'Incident runbook' }
        ]
      },
      {
        type: 'task_card',
        task_id: 'task_2',
        title: 'Hidden title',
        hide_title: true,
        status: 'complete',
        details: {
          type: 'rich_text',
          elements: [
            {
              type: 'rich_text_section',
              elements: [{ type: 'text', text: '`hide_title: true` — details become the top element.' }]
            }
          ]
        }
      },
      {
        type: 'task_card',
        task_id: 'task_3',
        title: 'Posting the summary',
        status: 'error'
      }
    ]))
  }
};

export const Video: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'video',
        block_id: 'onboarding_video',
        title: { type: 'plain_text', text: 'Getting started with the dashboard', emoji: true },
        title_url: 'https://videos.example.com/watch/getting-started',
        description: { type: 'plain_text', text: 'A three-minute tour of the main views.', emoji: true },
        video_url: 'https://videos.example.com/embed/getting-started',
        thumbnail_url: SAMPLE_IMAGE,
        alt_text: 'Dashboard tour video',
        author_name: 'Product Education',
        provider_name: 'Example Video',
        provider_icon_url: SAMPLE_AVATAR
      }
    ])
  }
};
