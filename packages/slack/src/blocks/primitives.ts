import { SLACK_LIMITS } from '../core/limits';
import type {
  ActionsBlock,
  ButtonElement,
  ConfirmationDialog,
  ContextBlock,
  DividerBlock,
  HeaderBlock,
  ImageBlock,
  ImageElement,
  Primitive,
  SectionBlock,
  SlackBlockElement,
  SlackFileImageObject,
  SlackTextObject,
  ImageSource
} from '../types/slack';
import { actionId } from '../utils/ids';
import { chunk, escapeMrkdwn, formatPrimitive, isNonEmptyString, truncate } from '../utils/text';
import { mrkdwn, plainText } from './text';

export interface BlockOptions {
  blockId?: string;
}

export interface FieldInput {
  label: string;
  value: Primitive;
  markdown?: boolean;
}

export interface SectionInput extends BlockOptions {
  text?: Primitive;
  fields?: Array<FieldInput | SlackTextObject>;
  accessory?: SlackBlockElement;
  verbatim?: boolean;
  expand?: boolean;
}

export interface ImageInput extends BlockOptions, ImageSource {
  altText: string;
  title?: string;
}

export interface ButtonInput {
  text: string;
  actionId?: string;
  url?: string;
  value?: string;
  style?: 'primary' | 'danger';
  accessibilityLabel?: string;
  confirm?: ConfirmationDialog;
}

export function header(text: Primitive, options: BlockOptions = {}): HeaderBlock {
  return {
    type: 'header',
    text: plainText(text, { maxLength: SLACK_LIMITS.headerText }),
    ...(options.blockId ? { block_id: truncate(options.blockId, SLACK_LIMITS.blockId, '') } : {})
  };
}

export function divider(options: BlockOptions = {}): DividerBlock {
  return {
    type: 'divider',
    ...(options.blockId ? { block_id: truncate(options.blockId, SLACK_LIMITS.blockId, '') } : {})
  };
}

export function field(input: FieldInput): SlackTextObject {
  const label = truncate(escapeMrkdwn(input.label), 80);
  const value = truncate(formatPrimitive(input.value), SLACK_LIMITS.fieldText - label.length - 4);
  const rendered = `*${label}:*\n${value}`;
  return input.markdown === false
    ? plainText(`${input.label}:\n${formatPrimitive(input.value)}`, { maxLength: SLACK_LIMITS.fieldText })
    : mrkdwn(rendered, { maxLength: SLACK_LIMITS.fieldText });
}

export function section(input: SectionInput | Primitive): SectionBlock {
  const config = (typeof input === 'object' && input !== null && !Array.isArray(input)
    ? input
    : { text: input as Primitive }) as SectionInput;

  const hasText = isNonEmptyString(String(config.text ?? '').trim());
  const hasFields = Boolean(config.fields?.length);

  if (!hasText && !hasFields) {
    throw new Error('section requires text or fields');
  }

  const block: SectionBlock = { type: 'section' };

  if (hasText) {
    block.text = mrkdwn(config.text, {
      maxLength: SLACK_LIMITS.sectionText,
      verbatim: config.verbatim
    });
  }

  if (hasFields) {
    block.fields = config.fields
      ?.slice(0, SLACK_LIMITS.sectionFields)
      .map((item) => ('label' in item ? field(item) : item));
  }

  if (config.accessory) {
    block.accessory = config.accessory;
  }
  if (config.blockId) {
    block.block_id = truncate(config.blockId, SLACK_LIMITS.blockId, '');
  }
  if (config.expand !== undefined) {
    block.expand = config.expand;
  }

  return block;
}

export function context(elements: Array<string | SlackTextObject | ImageElement>, options: BlockOptions = {}): ContextBlock {
  if (elements.length === 0) {
    throw new Error('context requires at least one element');
  }

  return {
    type: 'context',
    elements: elements.slice(0, SLACK_LIMITS.contextElements).map((element) => {
      if (typeof element === 'string') {
        return mrkdwn(element, { maxLength: SLACK_LIMITS.fieldText });
      }
      return element;
    }),
    ...(options.blockId ? { block_id: truncate(options.blockId, SLACK_LIMITS.blockId, '') } : {})
  };
}

export function imageElement(input: ImageInput): ImageElement {
  if (!input.imageUrl && !input.slackFile) {
    throw new Error('image element requires imageUrl or slackFile');
  }

  return {
    type: 'image',
    ...(input.imageUrl ? { image_url: truncate(input.imageUrl, SLACK_LIMITS.imageUrl, '') } : {}),
    ...(input.slackFile ? { slack_file: input.slackFile } : {}),
    alt_text: truncate(input.altText, SLACK_LIMITS.imageAltText)
  };
}

export function image(input: ImageInput): ImageBlock {
  if (!input.imageUrl && !input.slackFile) {
    throw new Error('image requires imageUrl or slackFile');
  }

  return {
    type: 'image',
    ...(input.imageUrl ? { image_url: truncate(input.imageUrl, SLACK_LIMITS.imageUrl, '') } : {}),
    ...(input.slackFile ? { slack_file: input.slackFile } : {}),
    alt_text: truncate(input.altText, SLACK_LIMITS.imageAltText),
    ...(input.title ? { title: plainText(input.title, { maxLength: SLACK_LIMITS.imageTitle }) } : {}),
    ...(input.blockId ? { block_id: truncate(input.blockId, SLACK_LIMITS.blockId, '') } : {})
  };
}

export function button(input: ButtonInput): ButtonElement {
  const element: ButtonElement = {
    type: 'button',
    text: plainText(input.text, { maxLength: SLACK_LIMITS.buttonText }),
    action_id: truncate(input.actionId ?? actionId(input.text), SLACK_LIMITS.blockId, '')
  };

  if (input.url) {
    element.url = truncate(input.url, SLACK_LIMITS.buttonUrl, '');
  }
  if (input.value) {
    element.value = truncate(input.value, SLACK_LIMITS.buttonValue);
  }
  if (input.style) {
    element.style = input.style;
  }
  if (input.accessibilityLabel) {
    element.accessibility_label = truncate(input.accessibilityLabel, SLACK_LIMITS.buttonText);
  }
  if (input.confirm) {
    element.confirm = input.confirm;
  }

  return element;
}

export function actions(elements: SlackBlockElement[], options: BlockOptions = {}): ActionsBlock {
  if (elements.length === 0) {
    throw new Error('actions requires at least one element');
  }

  return {
    type: 'actions',
    elements: elements.slice(0, SLACK_LIMITS.actionElements),
    ...(options.blockId ? { block_id: truncate(options.blockId, SLACK_LIMITS.blockId, '') } : {})
  };
}

export function fieldSections(fields: FieldInput[], options: BlockOptions = {}): SectionBlock[] {
  return chunk(fields, SLACK_LIMITS.sectionFields).map((fieldChunk, index) =>
    section({
      fields: fieldChunk,
      blockId: options.blockId ? `${options.blockId}_${index + 1}` : undefined
    })
  );
}
