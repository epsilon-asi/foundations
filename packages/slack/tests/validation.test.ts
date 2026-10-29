import { describe, expect, it } from 'vitest';
import { assertValidMessage, validateBlocks, validateMessage } from '../src/core/validation';
import { SlackKitValidationError } from '../src/core/errors';
import { SLACK_LIMITS } from '../src/core/limits';
import type { SlackBlock, SlackMessagePayload } from '../src/types/slack';

const long = (length: number) => 'x'.repeat(length);
const payload = (blocks: SlackBlock[], text = 'fallback'): SlackMessagePayload => ({ text, blocks });

describe('validation', () => {
  it('detects message-level block and text issues', () => {
    const manyBlocks = Array.from({ length: 51 }, () => ({ type: 'divider' as const }));
    expect(validateBlocks(manyBlocks)[0]?.message).toContain('at most 50 blocks');

    const blankTextIssues = validateMessage(payload([{ type: 'divider' }], ''));
    expect(blankTextIssues.some((issue) => issue.severity === 'warning' && issue.path === 'text')).toBe(true);

    const longTextIssues = validateMessage(payload([{ type: 'divider' }], long(SLACK_LIMITS.topLevelTextHard + 1)));
    expect(longTextIssues.some((issue) => issue.path === 'text' && issue.severity === 'error')).toBe(true);
  });

  it('detects header and section issues', () => {
    const issues = validateBlocks([
      { type: 'header', text: { type: 'plain_text', text: long(151) } },
      { type: 'section' },
      { type: 'section', text: { type: 'mrkdwn', text: long(3001) } },
      {
        type: 'section',
        fields: Array.from({ length: 11 }, (_, index) => ({ type: 'mrkdwn' as const, text: index === 0 ? long(2001) : 'ok' }))
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'has accessory' },
        accessory: { type: 'image', alt_text: '' }
      }
    ]);

    expect(issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'blocks.0.text.text',
      'blocks.1',
      'blocks.2.text.text',
      'blocks.3.fields',
      'blocks.3.fields.0.text',
      'blocks.4.accessory',
      'blocks.4.accessory.alt_text'
    ]));
  });

  it('detects image, context, and action issues', () => {
    const issues = validateBlocks([
      { type: 'image', alt_text: '' },
      { type: 'image', image_url: long(3001), alt_text: long(2001), title: { type: 'plain_text', text: long(2001) } },
      { type: 'context', elements: [] },
      { type: 'context', elements: Array.from({ length: 11 }, () => ({ type: 'mrkdwn' as const, text: 'ok' })) },
      { type: 'context', elements: [{ type: 'mrkdwn', text: long(2001) }, { type: 'image', alt_text: '' }] },
      { type: 'actions', elements: [] },
      { type: 'actions', elements: Array.from({ length: 26 }, () => ({ type: 'button', text: { type: 'plain_text' as const, text: 'ok' }, action_id: 'ok' })) },
      {
        type: 'actions',
        elements: [
          { type: 'button', text: { type: 'plain_text', text: '' }, action_id: '', value: long(2001), url: long(3001) },
          { type: 'button', text: { type: 'plain_text', text: long(76) }, action_id: 'long_text' }
        ]
      }
    ]);

    expect(issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'blocks.0',
      'blocks.0.alt_text',
      'blocks.1.image_url',
      'blocks.1.alt_text',
      'blocks.1.title.text',
      'blocks.2.elements',
      'blocks.3.elements',
      'blocks.4.elements.0.text',
      'blocks.4.elements.1',
      'blocks.4.elements.1.alt_text',
      'blocks.5.elements',
      'blocks.6.elements',
      'blocks.7.elements.0.action_id',
      'blocks.7.elements.0.text.text',
      'blocks.7.elements.0.value',
      'blocks.7.elements.0.url',
      'blocks.7.elements.1.text.text'
    ]));
  });

  it('throws a structured validation error for invalid payloads', () => {
    expect(() => assertValidMessage(payload([{ type: 'section' }]))).toThrow(SlackKitValidationError);
    try {
      assertValidMessage(payload([{ type: 'section' }]));
    } catch (error) {
      expect(error).toBeInstanceOf(SlackKitValidationError);
      expect((error as SlackKitValidationError).issues[0]?.path).toBe('blocks.0');
    }
  });

  it('ignores unknown blocks to allow future Slack block types', () => {
    expect(validateBlocks([{ type: 'future_block', content: 'ok' }])).toEqual([]);
  });
});
