import { button, type ButtonInput, type FieldInput } from '../blocks';
import type { ButtonElement, Primitive, Severity } from '../types/slack';
import { formatPrimitive, slackLink, truncate } from '../utils/text';
import { tone } from './status';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export const PRIORITY_SEVERITY: Record<Priority, Severity> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger'
};

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

export function priorityLabel(priority: Priority): string {
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);
  return `${tone(PRIORITY_SEVERITY[priority]).emoji} ${label}`;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function progressBar(percent: number, width = 10): string {
  const filled = Math.round((clampPercent(percent) / 100) * width);
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
}

export function formatMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function bulletList(items: string[], bullet = '•'): string {
  return items.map((item) => `${bullet} ${item}`).join('\n');
}
