import { button, type ButtonInput, type FieldInput } from '../blocks';
import type { ButtonElement, Primitive } from '../types/slack';
import { formatPrimitive, slackLink, truncate } from '../utils/text';

export interface FieldDefinition {
  label: string;
  value: Primitive;
  markdown?: boolean;
}

export interface ActionDefinition {
  text: string;
  actionId?: string;
  url?: string;
  value?: string;
  style?: 'primary' | 'danger';
  accessibilityLabel?: string;
}

export function toFields(fields: FieldDefinition[] = []): FieldInput[] {
  return fields.map((field) => ({
    label: field.label,
    value: field.value,
    ...(field.markdown !== undefined ? { markdown: field.markdown } : {})
  }));
}

export function toButtons(actions: ActionDefinition[] = []): ButtonElement[] {
  return actions.map((action): ButtonElement => {
    const input: ButtonInput = { text: action.text };
    if (action.actionId) input.actionId = action.actionId;
    if (action.url) input.url = action.url;
    if (action.value) input.value = action.value;
    if (action.style) input.style = action.style;
    if (action.accessibilityLabel) input.accessibilityLabel = action.accessibilityLabel;
    return button(input);
  });
}

export function linkedLabel(label: string, url?: string): string {
  return url ? slackLink(url, label) : label;
}

export function formatFieldValue(value: Primitive): string {
  return truncate(formatPrimitive(value), 2000);
}
