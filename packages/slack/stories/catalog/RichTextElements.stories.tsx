import type { Meta, StoryObj } from '@storybook/react-vite';

import { renderNothing, SAMPLE_AVATAR, slackPreview, unvalidated } from '../support';

/**
 * Every rich text sub-element (section, list, quote, preformatted) and every
 * inline element that can sit inside one — text styles, links, emoji,
 * mentions, dates, colors, tags, citations and Slack object references.
 */
const meta = {
  title: 'Catalog/Rich text elements',
  render: renderNothing
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const RichTextSection: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [{ type: 'text', text: 'A basic rich_text_section holding a single text element.' }]
          },
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Sections can mix ' },
              { type: 'text', text: 'styled text', style: { bold: true } },
              { type: 'text', text: ', ' },
              { type: 'link', url: 'https://example.com', text: 'links' },
              { type: 'text', text: ' and ' },
              { type: 'emoji', name: 'tada' },
              { type: 'text', text: ' emoji.' }
            ]
          }
        ]
      }
    ])
  }
};

export const TextStyles: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Plain, ' },
              { type: 'text', text: 'bold', style: { bold: true } },
              { type: 'text', text: ', ' },
              { type: 'text', text: 'italic', style: { italic: true } },
              { type: 'text', text: ', ' },
              { type: 'text', text: 'strike', style: { strike: true } },
              { type: 'text', text: ', ' },
              { type: 'text', text: 'code', style: { code: true } },
              { type: 'text', text: ', ' },
              { type: 'text', text: 'underline', style: { underline: true } },
              { type: 'text', text: ', ' },
              { type: 'text', text: 'highlight', style: { highlight: true } },
              { type: 'text', text: ', ' },
              { type: 'text', text: 'client highlight', style: { client_highlight: true } },
              { type: 'text', text: ' and ' },
              { type: 'text', text: 'all of the basics at once', style: { bold: true, italic: true, strike: true } },
              { type: 'text', text: '.' }
            ]
          }
        ]
      }
    ])
  }
};

export const RichTextListBullet: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [{ type: 'text', text: 'Agenda:' }]
          },
          {
            type: 'rich_text_list',
            style: 'bullet',
            elements: [
              { type: 'rich_text_section', elements: [{ type: 'text', text: 'Roadmap review' }] },
              { type: 'rich_text_section', elements: [{ type: 'text', text: 'Hiring update' }] },
              { type: 'rich_text_section', elements: [{ type: 'text', text: 'Open questions' }] }
            ]
          }
        ]
      }
    ])
  }
};

export const RichTextListOrdered: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_list',
            style: 'ordered',
            elements: [
              { type: 'rich_text_section', elements: [{ type: 'text', text: 'Create a branch' }] },
              { type: 'rich_text_section', elements: [{ type: 'text', text: 'Open a pull request' }] }
            ]
          },
          {
            type: 'rich_text_section',
            elements: [{ type: 'text', text: 'An ordered list continuing at 3 with `offset: 2` and a border:' }]
          },
          {
            type: 'rich_text_list',
            style: 'ordered',
            offset: 2,
            border: 1,
            elements: [
              { type: 'rich_text_section', elements: [{ type: 'text', text: 'Request review' }] },
              { type: 'rich_text_section', elements: [{ type: 'text', text: 'Merge' }] }
            ]
          }
        ]
      }
    ])
  }
};

// Nested lists are consecutive `rich_text_list`s, the inner ones using `indent`.
export const RichTextListNested: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [{ type: 'text', text: 'Launch tasks:' }]
          },
          {
            type: 'rich_text_list',
            style: 'bullet',
            elements: [
              { type: 'rich_text_section', elements: [{ type: 'text', text: 'Engineering' }] }
            ]
          },
          {
            type: 'rich_text_list',
            style: 'bullet',
            indent: 1,
            elements: [
              { type: 'rich_text_section', elements: [{ type: 'text', text: 'Feature flags' }] },
              { type: 'rich_text_section', elements: [{ type: 'text', text: 'Load testing' }] }
            ]
          },
          {
            type: 'rich_text_list',
            style: 'ordered',
            indent: 2,
            elements: [
              { type: 'rich_text_section', elements: [{ type: 'text', text: 'Write scenarios' }] },
              { type: 'rich_text_section', elements: [{ type: 'text', text: 'Run at 2× peak' }] }
            ]
          },
          {
            type: 'rich_text_list',
            style: 'bullet',
            elements: [
              { type: 'rich_text_section', elements: [{ type: 'text', text: 'Marketing' }] }
            ]
          }
        ]
      }
    ])
  }
};

export const RichTextPreformatted: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_preformatted',
            border: 0,
            language: 'json',
            elements: [
              {
                type: 'text',
                text: '{\n  "service": "api",\n  "status": "healthy"\n}'
              }
            ]
          },
          {
            type: 'rich_text_preformatted',
            border: 1,
            elements: [
              { type: 'text', text: 'See the runbook at ' },
              { type: 'link', url: 'https://runbooks.example.com/deploys' }
            ]
          }
        ]
      }
    ])
  }
};

export const RichTextQuote: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_quote',
            elements: [
              { type: 'text', text: 'We should document the escalation path in the onboarding guide.' }
            ]
          },
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Agreed — ' },
              { type: 'user', user_id: 'U0123ABCD' },
              { type: 'text', text: ' will draft it.' }
            ]
          },
          {
            type: 'rich_text_quote',
            border: 1,
            elements: [{ type: 'text', text: 'A quote with `border: 1`.', style: { italic: true } }]
          }
        ]
      }
    ])
  }
};

export const Link: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'link', url: 'https://docs.example.com' },
              { type: 'text', text: ' · ' },
              { type: 'link', url: 'https://docs.example.com/api', text: 'API reference' },
              { type: 'text', text: ' · ' },
              { type: 'link', url: 'https://docs.example.com/faq', text: 'FAQ', style: { bold: true } },
              { type: 'text', text: ' · ' },
              { type: 'link', url: 'https://example.com/unverified', text: 'Unverified link', unsafe: true }
            ]
          }
        ]
      }
    ])
  }
};

export const Emoji: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'emoji', name: 'wave' },
              { type: 'text', text: ' ' },
              { type: 'emoji', name: 'wave::skin-tone-4' },
              { type: 'text', text: ' ' },
              { type: 'emoji', name: 'white_check_mark', unicode: '2705' },
              { type: 'text', text: ' ' },
              { type: 'emoji', name: 'checkered_flag' }
            ]
          }
        ]
      }
    ])
  }
};

export const User: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Thanks ' },
              { type: 'user', user_id: 'U0123ABCD' },
              { type: 'text', text: ' and ' },
              { type: 'user', user_id: 'U0456EFGH', style: { bold: true } },
              { type: 'text', text: '!' }
            ]
          }
        ]
      }
    ])
  }
};

export const Usergroup: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'usergroup', usergroup_id: 'S0123ABCD' },
              { type: 'text', text: ' please review the on-call schedule.' }
            ]
          }
        ]
      }
    ])
  }
};

export const Channel: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Moving this to ' },
              { type: 'channel', channel_id: 'C0123ABCD' },
              { type: 'text', text: ' (see the ' },
              { type: 'channel', channel_id: 'C0456EFGH', tab_id: 'Ct0123ABCD', style: { italic: true } },
              { type: 'text', text: ' tab).' }
            ]
          }
        ]
      }
    ]))
  }
};

// The 0.1.1 renderer has no `team` support — the mention is dropped.
export const Team: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Shared with the ' },
              { type: 'team', team_id: 'T0123ABCD' },
              { type: 'text', text: ' workspace.' }
            ]
          }
        ]
      }
    ])
  }
};

export const Broadcast: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'broadcast', range: 'here' },
              { type: 'text', text: ' standup in 5 minutes. ' },
              { type: 'broadcast', range: 'channel' },
              { type: 'text', text: ' the release is out. ' },
              { type: 'broadcast', range: 'everyone', style: { bold: true } },
              { type: 'text', text: ' the office closes early Friday.' }
            ]
          }
        ]
      }
    ])
  }
};

export const DateElement: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
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
                  { type: 'text', text: '{date_num} at {time}: ' },
                  { type: 'date', timestamp: 1795186800, format: '{date_num} at {time}', fallback: 'Nov 19, 2026' }
                ]
              },
              {
                type: 'rich_text_section',
                elements: [
                  { type: 'text', text: '{date_long}: ' },
                  { type: 'date', timestamp: 1795186800, format: '{date_long}', timezone: 'America/Chicago' }
                ]
              },
              {
                type: 'rich_text_section',
                elements: [
                  { type: 'text', text: '{date_short_pretty} (linked): ' },
                  {
                    type: 'date',
                    timestamp: 1795186800,
                    format: '{date_short_pretty}',
                    url: 'https://calendar.example.com/events/411'
                  }
                ]
              },
              {
                type: 'rich_text_section',
                elements: [
                  { type: 'text', text: '{ago}: ' },
                  { type: 'date', timestamp: 1793361600, format: '{ago}', style: { italic: true } }
                ]
              }
            ]
          }
        ]
      }
    ]))
  }
};

export const Color: Story = {
  parameters: {
    slackBlocks: slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Primary ' },
              { type: 'color', value: '#1264A3' },
              { type: 'text', text: ', accent ' },
              { type: 'color', value: '#F405B3' },
              { type: 'text', text: ', success ' },
              { type: 'color', value: '#2EB67D', style: { bold: true } }
            ]
          }
        ]
      }
    ])
  }
};

// The 0.1.1 renderer has no `tag` support — the tags are dropped.
export const Tag: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'tag', text: 'Default' },
              { type: 'text', text: ' ' },
              { type: 'tag', text: 'Gray', color: 'gray' },
              { type: 'text', text: ' ' },
              { type: 'tag', text: 'Brown', color: 'brown' },
              { type: 'text', text: ' ' },
              { type: 'tag', text: 'Purple', color: 'purple' },
              { type: 'text', text: ' ' },
              { type: 'tag', text: 'Indigo', color: 'indigo' },
              { type: 'text', text: ' ' },
              { type: 'tag', text: 'Blue', color: 'blue' },
              { type: 'text', text: ' ' },
              { type: 'tag', text: 'Green', color: 'green' },
              { type: 'text', text: ' ' },
              { type: 'tag', text: 'Yellow', color: 'yellow' },
              { type: 'text', text: ' ' },
              { type: 'tag', text: 'Orange', color: 'orange' },
              { type: 'text', text: ' ' },
              { type: 'tag', text: 'Red', color: 'red', style: { bold: true } }
            ]
          }
        ]
      }
    ]))
  }
};

// The 0.1.1 renderer has no `citation` support — citations are dropped.
export const Citation: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Refunds are processed within 5 business days' },
              {
                type: 'citation',
                url: 'https://files.example.com/refund-policy',
                text: 'Refund policy',
                index: 1,
                details: { citation_type: 'file', descriptor: 'Team canvas', file_id: 'F0123ABCD' }
              },
              {
                type: 'citation',
                url: 'https://helpdesk.example.com/articles/22',
                text: 'Help desk article',
                index: 2,
                details: { citation_type: 'external', app_name: 'Help Desk', app_icon_url: SAMPLE_AVATAR }
              },
              {
                type: 'citation',
                url: 'https://www.example.com/blog/refunds',
                text: 'Refunds explained',
                index: 3,
                from_llm: true,
                details: {
                  citation_type: 'web',
                  display_name: 'example.com',
                  title: 'Refunds explained',
                  snippet: 'Most refunds settle in three to five business days.'
                }
              },
              {
                type: 'citation',
                url: 'https://example.slack.com/archives/C0123ABCD/p1795186800000100',
                text: 'Thread in #support',
                index: 4,
                is_slack_url: true,
                details: { citation_type: 'message', channel: 'C0123ABCD', message_ts: '1795186800.000100' }
              },
              {
                type: 'citation',
                url: 'https://example.com/memories/refund-preference',
                text: 'Saved preference',
                index: 5,
                details: { citation_type: 'memory', memory_id: 'M0123ABCD' }
              },
              { type: 'text', text: '.' }
            ]
          }
        ]
      }
    ]))
  }
};

// The 0.1.1 renderer has no `canvas` support — the reference is dropped.
export const Canvas: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Notes live in ' },
              { type: 'canvas', file_id: 'F0123ABCD' },
              { type: 'text', text: ' and ' },
              {
                type: 'canvas',
                file_id: 'F0456EFGH',
                text: 'Q4 planning',
                label: 'Planning canvas',
                section_id: 'temp:C:abc123',
                url: 'https://example.slack.com/docs/T0123ABCD/F0456EFGH'
              }
            ]
          }
        ]
      }
    ]))
  }
};

// The 0.1.1 renderer has no `canvas_user_mention` support.
export const CanvasUserMention: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Owner: ' },
              { type: 'canvas_user_mention', user_id: 'U0123ABCD' }
            ]
          }
        ]
      }
    ]))
  }
};

// The 0.1.1 renderer has no `canvas_message_unfurl` support.
export const CanvasMessageUnfurl: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              {
                type: 'canvas_message_unfurl',
                root_message_ts: '1795186800.000100',
                root_message_channel: 'C0123ABCD'
              }
            ]
          }
        ]
      }
    ]))
  }
};

// The 0.1.1 renderer has no rich-text `file` support.
export const FileElement: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Attached: ' },
              { type: 'file', file_id: 'F0123ABCD' },
              { type: 'text', text: ', ' },
              {
                type: 'file',
                file_id: 'F0456EFGH',
                text: 'budget-2027.xlsx',
                url: 'https://example.slack.com/files/U0123ABCD/F0456EFGH/budget-2027.xlsx'
              }
            ]
          }
        ]
      }
    ]))
  }
};

// The 0.1.1 renderer has no `list_record` support.
export const ListRecord: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Tracked as ' },
              {
                type: 'list_record',
                file_id: 'F0123ABCD',
                record_id: 'Rec0123ABCD',
                view_id: 'View0123ABCD',
                text: 'Laptop refresh'
              }
            ]
          }
        ]
      }
    ]))
  }
};

// The 0.1.1 renderer has no `message_mention` support.
export const MessageMention: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'As discussed in ' },
              {
                type: 'message_mention',
                channel_id: 'C0123ABCD',
                message_ts: '1795186800.000100',
                author_id: 'U0123ABCD',
                text: 'the planning thread'
              }
            ]
          }
        ]
      }
    ]))
  }
};

// The 0.1.1 renderer has no `attachment_mention` support.
export const AttachmentMention: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Spec: ' },
              {
                type: 'attachment_mention',
                url: 'https://docs.example.com/specs/search-v2',
                text: 'Search v2 spec',
                app_id: 'A0123ABCD',
                product_name: 'Docs'
              }
            ]
          }
        ]
      }
    ]))
  }
};

// The 0.1.1 renderer has no `salesforce_data_field` support.
export const SalesforceDataField: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Annual revenue: ' },
              {
                type: 'salesforce_data_field',
                salesforce_record_id: '001EXAMPLE0000AAA',
                salesforce_field_label: 'Annual Revenue',
                salesforce_field_api_name: 'AnnualRevenue',
                salesforce_include_field_label: false
              }
            ]
          }
        ]
      }
    ]))
  }
};

// The 0.1.1 renderer has no `work_object_mention` support.
export const WorkObjectMention: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'Blocked by ' },
              {
                type: 'work_object_mention',
                entity_id: 'E0123ABCD',
                app_id: 'A0123ABCD',
                text: 'OPS-1024: Rotate credentials',
                url: 'https://tracker.example.com/OPS-1024',
                icon_url: SAMPLE_AVATAR
              }
            ]
          }
        ]
      }
    ]))
  }
};

// The 0.1.1 renderer has no `workflow_mention` support.
export const WorkflowMention: Story = {
  parameters: {
    slackBlocks: unvalidated(slackPreview([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: 'To request access, run ' },
              {
                type: 'workflow_mention',
                workflow_id: 'Wf0123ABCD',
                function_trigger_id: 'Ft0123ABCD',
                text: 'Access request'
              }
            ]
          }
        ]
      }
    ]))
  }
};
