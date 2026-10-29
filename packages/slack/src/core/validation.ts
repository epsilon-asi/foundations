import type {
  ActionsBlock,
  ButtonElement,
  ContextBlock,
  HeaderBlock,
  ImageBlock,
  ImageElement,
  SectionBlock,
  SlackBlock,
  SlackMessagePayload,
  SlackTextObject
} from '../types/slack';
import { SlackKitValidationError, type ValidationIssue } from './errors';
import { SLACK_LIMITS } from './limits';

function issue(path: string, message: string, severity: ValidationIssue['severity'] = 'error'): ValidationIssue {
  return { path, message, severity };
}

function hasTooLongText(text: SlackTextObject | undefined, max: number): boolean {
  return Boolean(text && text.text.length > max);
}

function validateImageElement(element: ImageElement, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!element.image_url && !element.slack_file) {
    issues.push(issue(path, 'image element requires image_url or slack_file'));
  }
  if (!element.alt_text) {
    issues.push(issue(`${path}.alt_text`, 'image element requires alt_text'));
  }
  if (element.image_url && element.image_url.length > SLACK_LIMITS.imageUrl) {
    issues.push(issue(`${path}.image_url`, `must be <= ${SLACK_LIMITS.imageUrl} characters`));
  }
  if (element.alt_text && element.alt_text.length > SLACK_LIMITS.imageAltText) {
    issues.push(issue(`${path}.alt_text`, `must be <= ${SLACK_LIMITS.imageAltText} characters`));
  }
  return issues;
}

function validateHeader(block: HeaderBlock, path: string): ValidationIssue[] {
  return hasTooLongText(block.text, SLACK_LIMITS.headerText)
    ? [issue(`${path}.text.text`, `must be <= ${SLACK_LIMITS.headerText} characters`)]
    : [];
}

function validateSection(block: SectionBlock, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!block.text && !block.fields?.length) {
    issues.push(issue(path, 'section requires text or fields'));
  }
  if (hasTooLongText(block.text, SLACK_LIMITS.sectionText)) {
    issues.push(issue(`${path}.text.text`, `must be <= ${SLACK_LIMITS.sectionText} characters`));
  }
  if (block.fields && block.fields.length > SLACK_LIMITS.sectionFields) {
    issues.push(issue(`${path}.fields`, `must have <= ${SLACK_LIMITS.sectionFields} fields`));
  }
  block.fields?.forEach((field, fieldIndex) => {
    if (field.text.length > SLACK_LIMITS.fieldText) {
      issues.push(issue(`${path}.fields.${fieldIndex}.text`, `must be <= ${SLACK_LIMITS.fieldText} characters`));
    }
  });
  if (block.accessory && typeof block.accessory === 'object' && block.accessory.type === 'image') {
    issues.push(...validateImageElement(block.accessory as ImageElement, `${path}.accessory`));
  }
  return issues;
}

function validateContext(block: ContextBlock, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (block.elements.length === 0) {
    issues.push(issue(`${path}.elements`, 'context requires at least one element'));
  }
  if (block.elements.length > SLACK_LIMITS.contextElements) {
    issues.push(issue(`${path}.elements`, `must have <= ${SLACK_LIMITS.contextElements} elements`));
  }
  block.elements.forEach((element, elementIndex) => {
    if ('alt_text' in element) {
      issues.push(...validateImageElement(element, `${path}.elements.${elementIndex}`));
    } else if (element.text.length > SLACK_LIMITS.fieldText) {
      issues.push(issue(`${path}.elements.${elementIndex}.text`, `must be <= ${SLACK_LIMITS.fieldText} characters`));
    }
  });
  return issues;
}

function validateImageBlock(block: ImageBlock, path: string): ValidationIssue[] {
  const issues = validateImageElement(
    { type: 'image', image_url: block.image_url, slack_file: block.slack_file, alt_text: block.alt_text },
    path
  );
  if (block.title && block.title.text.length > SLACK_LIMITS.imageTitle) {
    issues.push(issue(`${path}.title.text`, `must be <= ${SLACK_LIMITS.imageTitle} characters`));
  }
  return issues;
}

function validateButton(element: ButtonElement, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!element.action_id) {
    issues.push(issue(`${path}.action_id`, 'button requires action_id'));
  }
  if (!element.text?.text) {
    issues.push(issue(`${path}.text.text`, 'button requires text'));
  }
  if (element.text?.text && element.text.text.length > SLACK_LIMITS.buttonText) {
    issues.push(issue(`${path}.text.text`, `must be <= ${SLACK_LIMITS.buttonText} characters`));
  }
  if (element.value && element.value.length > SLACK_LIMITS.buttonValue) {
    issues.push(issue(`${path}.value`, `must be <= ${SLACK_LIMITS.buttonValue} characters`));
  }
  if (element.url && element.url.length > SLACK_LIMITS.buttonUrl) {
    issues.push(issue(`${path}.url`, `must be <= ${SLACK_LIMITS.buttonUrl} characters`));
  }
  return issues;
}

function validateActions(block: ActionsBlock, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (block.elements.length === 0) {
    issues.push(issue(`${path}.elements`, 'actions requires at least one element'));
  }
  if (block.elements.length > SLACK_LIMITS.actionElements) {
    issues.push(issue(`${path}.elements`, `must have <= ${SLACK_LIMITS.actionElements} elements`));
  }
  block.elements.forEach((element, elementIndex) => {
    if (element && typeof element === 'object' && element.type === 'button') {
      issues.push(...validateButton(element as ButtonElement, `${path}.elements.${elementIndex}`));
    }
  });
  return issues;
}

export function validateBlocks(blocks: SlackBlock[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (blocks.length > SLACK_LIMITS.messageBlocks) {
    issues.push(issue('blocks', `Slack messages can include at most ${SLACK_LIMITS.messageBlocks} blocks`));
  }

  blocks.forEach((block, index) => {
    const path = `blocks.${index}`;
    switch (block.type) {
      case 'header':
        issues.push(...validateHeader(block as HeaderBlock, path));
        break;
      case 'section':
        issues.push(...validateSection(block as SectionBlock, path));
        break;
      case 'context':
        issues.push(...validateContext(block as ContextBlock, path));
        break;
      case 'image':
        issues.push(...validateImageBlock(block as ImageBlock, path));
        break;
      case 'actions':
        issues.push(...validateActions(block as ActionsBlock, path));
        break;
      default:
        break;
    }
  });

  return issues;
}

export function validateMessage(payload: SlackMessagePayload): ValidationIssue[] {
  const issues = validateBlocks(payload.blocks);
  if (!payload.text || payload.text.trim().length === 0) {
    issues.push(issue('text', 'top-level text fallback is recommended for notifications and accessibility', 'warning'));
  }
  if (payload.text && payload.text.length > SLACK_LIMITS.topLevelTextHard) {
    issues.push(issue('text', `must be <= ${SLACK_LIMITS.topLevelTextHard} characters`));
  }
  return issues;
}

export function assertValidMessage(payload: SlackMessagePayload): void {
  const errors = validateMessage(payload).filter((item) => item.severity === 'error');
  if (errors.length > 0) {
    throw new SlackKitValidationError(errors);
  }
}
