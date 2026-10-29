import { describe, expect, it } from 'vitest';
import {
  actions,
  button,
  context,
  divider,
  field,
  fieldSections,
  header,
  image,
  imageElement,
  mrkdwn,
  plainText,
  section,
  textObject
} from '../src/blocks';
import { SLACK_LIMITS } from '../src/core/limits';
import { asLines, chunk, compactJoin, escapeMrkdwn, formatPrimitive, slackLink, stripSlackMrkdwn, truncate } from '../src/utils/text';
import { actionId, blockId, slugify } from '../src/utils/ids';

const long = (length: number) => 'x'.repeat(length);

describe('text utilities', () => {
  it('truncates values and handles short maximum lengths', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
    expect(truncate('abcdef', 1)).toBe('…');
    expect(truncate('abc', 10)).toBe('abc');
    expect(() => truncate('abc', -1)).toThrow(RangeError);
  });

  it('formats and escapes Slack mrkdwn values', () => {
    expect(escapeMrkdwn('a&b<c>d')).toBe('a&amp;b&lt;c&gt;d');
    expect(slackLink('https://example.com/path>bad', 'A|B <C>')).toBe('<https://example.com/pathbad|A¦B &lt;C&gt;>');
    expect(slackLink('https://example.com')).toBe('<https://example.com>');
    expect(stripSlackMrkdwn('*<https://example.com|Open>* `now`')).toBe('Open now');
  });

  it('normalizes primitive and list values', () => {
    expect(formatPrimitive(true)).toBe('Yes');
    expect(formatPrimitive(false)).toBe('No');
    expect(formatPrimitive(null)).toBe('—');
    expect(formatPrimitive('')).toBe('—');
    expect(compactJoin(['one', '', undefined, 'two'])).toBe('one • two');
    expect(asLines([' first ', '', 'second'])).toEqual(['first', 'second']);
    expect(asLines('a\n\n b ')).toEqual(['a', 'b']);
    expect(asLines(undefined)).toEqual([]);
    expect(chunk([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
    expect(() => chunk([1], 0)).toThrow(RangeError);
  });

  it('creates stable ids', () => {
    expect(slugify('Deploy API!')).toBe('deploy_api');
    expect(slugify('***', 'fallback')).toBe('fallback');
    expect(actionId('View details', 'incident')).toBe('incident_view_details');
    expect(blockId('Main header', 'card')).toBe('card_main_header');
  });
});

describe('Block Kit primitives', () => {
  it('creates plain and markdown text objects', () => {
    expect(plainText('hello')).toEqual({ type: 'plain_text', text: 'hello', emoji: true });
    expect(mrkdwn('*hello*', { verbatim: true })).toEqual({ type: 'mrkdwn', text: '*hello*', verbatim: true });
    expect(textObject('hello', 'plain_text').type).toBe('plain_text');
    expect(textObject('hello', 'mrkdwn').type).toBe('mrkdwn');
  });

  it('creates headers and dividers with length-safe identifiers', () => {
    expect(header(long(200)).text.text).toHaveLength(SLACK_LIMITS.headerText);
    expect(header('Hi', { blockId: long(300) }).block_id).toHaveLength(SLACK_LIMITS.blockId);
    expect(divider()).toEqual({ type: 'divider' });
    expect(divider({ blockId: 'd1' })).toEqual({ type: 'divider', block_id: 'd1' });
  });

  it('creates sections from text, fields, accessories, and expand options', () => {
    const block = section({
      text: 'hello',
      fields: [{ label: 'Ready', value: true }, { label: 'Raw', value: '<ok>', markdown: false }],
      accessory: imageElement({ imageUrl: 'https://example.com/a.png', altText: 'a' }),
      blockId: 'section-1',
      expand: true,
      verbatim: false
    });

    expect(block.type).toBe('section');
    expect(block.fields).toHaveLength(2);
    expect(block.accessory?.type).toBe('image');
    expect(block.expand).toBe(true);
    expect(section('simple').text?.text).toBe('simple');
    expect(() => section({ text: '' })).toThrow('section requires text or fields');
  });

  it('creates field sections in chunks and truncates field text', () => {
    const text = field({ label: 'Count', value: 42 });
    expect(text.text).toContain('*Count:*');
    expect(field({ label: 'Long', value: long(3000) }).text.length).toBeLessThanOrEqual(SLACK_LIMITS.fieldText);
    const sections = fieldSections(Array.from({ length: 12 }, (_, index) => ({ label: `F${index}`, value: index })), { blockId: 'fields' });
    expect(sections).toHaveLength(2);
    expect(sections[0]?.fields).toHaveLength(10);
    expect(sections[1]?.block_id).toBe('fields_2');
  });

  it('creates context blocks and validates input shape early', () => {
    const block = context(['hello', mrkdwn('world'), imageElement({ imageUrl: 'https://example.com/a.png', altText: 'a' })], { blockId: 'ctx' });
    expect(block.elements).toHaveLength(3);
    expect(block.block_id).toBe('ctx');
    expect(context(Array.from({ length: 12 }, (_, index) => `item ${index}`)).elements).toHaveLength(10);
    expect(() => context([])).toThrow('context requires at least one element');
  });

  it('creates image blocks and image elements', () => {
    expect(image({ imageUrl: 'https://example.com/chart.png', altText: 'chart', title: 'Chart' }).title?.text).toBe('Chart');
    expect(image({ slackFile: { id: 'F123' }, altText: 'file' }).slack_file?.id).toBe('F123');
    expect(imageElement({ slackFile: { url: 'https://files.slack.com/x' }, altText: 'private' }).slack_file?.url).toContain('files.slack.com');
    expect(() => image({ altText: 'missing' })).toThrow('image requires imageUrl or slackFile');
    expect(() => imageElement({ altText: 'missing' })).toThrow('image element requires imageUrl or slackFile');
  });

  it('creates buttons and action blocks', () => {
    const btn = button({ text: 'Open', url: 'https://example.com', style: 'primary', value: 'open', accessibilityLabel: 'Open dashboard' });
    expect(btn.action_id).toBe('action_open');
    expect(btn.style).toBe('primary');
    expect(btn.url).toBe('https://example.com');
    expect(actions([btn], { blockId: 'actions' }).block_id).toBe('actions');
    expect(actions(Array.from({ length: 30 }, (_, index) => button({ text: `B${index}` }))).elements).toHaveLength(25);
    expect(() => actions([])).toThrow('actions requires at least one element');
  });
});
