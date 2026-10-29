import { SLACK_LIMITS } from '../core/limits';
import type { MrkdwnTextObject, PlainTextObject, Primitive, SlackTextObject } from '../types/slack';
import { truncate } from '../utils/text';

export interface TextOptions {
  maxLength?: number;
  emoji?: boolean;
  verbatim?: boolean;
}

export function plainText(text: Primitive, options: TextOptions = {}): PlainTextObject {
  const { maxLength = SLACK_LIMITS.sectionText, emoji = true } = options;
  return {
    type: 'plain_text',
    text: truncate(text, maxLength),
    emoji
  };
}

export function mrkdwn(text: Primitive, options: TextOptions = {}): MrkdwnTextObject {
  const { maxLength = SLACK_LIMITS.sectionText, verbatim } = options;
  const object: MrkdwnTextObject = {
    type: 'mrkdwn',
    text: truncate(text, maxLength)
  };
  if (verbatim !== undefined) {
    object.verbatim = verbatim;
  }
  return object;
}

export function textObject(text: Primitive, type: 'plain_text' | 'mrkdwn' = 'mrkdwn', options: TextOptions = {}): SlackTextObject {
  return type === 'plain_text' ? plainText(text, options) : mrkdwn(text, options);
}
