import type {
  ActionsBlock,
  ContextBlock,
  HeaderBlock,
  ImageBlock,
  SectionBlock,
  SlackBlock,
  SlackTextObject
} from '../types/slack';
import { compactJoin, stripSlackMrkdwn, truncate } from '../utils/text';
import { SLACK_LIMITS } from './limits';

function textValue(text?: SlackTextObject): string {
  return text ? stripSlackMrkdwn(text.text) : '';
}

function fallbackFromHeader(block: HeaderBlock): string {
  return textValue(block.text);
}

function fallbackFromSection(block: SectionBlock): string {
  const sectionText = textValue(block.text);
  const fieldsText = block.fields?.map(textValue).join(' ') ?? '';
  return compactJoin([sectionText, fieldsText], ' ');
}

function fallbackFromContext(block: ContextBlock): string {
  return block.elements
    .map((element) => ('text' in element ? stripSlackMrkdwn(element.text) : element.alt_text))
    .filter(Boolean)
    .join(' ');
}

function fallbackFromActions(block: ActionsBlock): string {
  return block.elements
    .map((element) => {
      if (element && typeof element === 'object' && 'text' in element) {
        const text = (element as { text?: { text?: string } }).text?.text;
        return text ?? '';
      }
      return '';
    })
    .filter(Boolean)
    .join(' ');
}

function fallbackFromImage(block: ImageBlock): string {
  return block.title?.text ? `${block.title.text}: ${block.alt_text}` : block.alt_text;
}

export function fallbackFromBlock(block: SlackBlock): string {
  switch (block.type) {
    case 'header':
      return fallbackFromHeader(block as HeaderBlock);
    case 'section':
      return fallbackFromSection(block as SectionBlock);
    case 'context':
      return fallbackFromContext(block as ContextBlock);
    case 'actions':
      return fallbackFromActions(block as ActionsBlock);
    case 'image':
      return fallbackFromImage(block as ImageBlock);
    case 'markdown':
      return stripSlackMrkdwn(String((block as { text?: string }).text ?? ''));
    default:
      return '';
  }
}

export function fallbackFromBlocks(blocks: SlackBlock[]): string {
  return truncate(
    blocks
      .map(fallbackFromBlock)
      .filter(Boolean)
      .join(' • '),
    SLACK_LIMITS.topLevelTextRecommended
  );
}

export function resolveFallbackText(options: {
  providedText?: string;
  componentFallback?: string;
  blocks: SlackBlock[];
}): string {
  if (options.providedText?.trim()) {
    return truncate(options.providedText, SLACK_LIMITS.topLevelTextHard);
  }
  if (options.componentFallback?.trim()) {
    return truncate(options.componentFallback, SLACK_LIMITS.topLevelTextHard);
  }
  return fallbackFromBlocks(options.blocks);
}
