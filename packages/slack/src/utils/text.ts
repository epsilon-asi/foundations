import type { Primitive } from '../types/slack';

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function truncate(value: Primitive, maxLength: number, suffix = '…'): string {
  const text = String(value ?? '');
  if (maxLength < 0) {
    throw new RangeError('maxLength must be non-negative');
  }
  if (text.length <= maxLength) {
    return text;
  }
  if (maxLength <= suffix.length) {
    return suffix.slice(0, maxLength);
  }
  return `${text.slice(0, maxLength - suffix.length).trimEnd()}${suffix}`;
}

export function escapeMrkdwn(value: Primitive): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function slackLink(url: string, label?: string): string {
  const safeUrl = url.replace(/>/g, '');
  if (!isNonEmptyString(label)) {
    return `<${safeUrl}>`;
  }
  const safeLabel = escapeMrkdwn(label).replace(/\|/g, '¦');
  return `<${safeUrl}|${safeLabel}>`;
}

export function formatPrimitive(value: Primitive): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
}

export function compactJoin(values: Array<Primitive>, separator = ' • '): string {
  return values
    .map((value) => String(value ?? '').trim())
    .filter((value) => value.length > 0)
    .join(separator);
}

export function asLines(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((line) => line.trim()).filter(Boolean);
  }
  if (!isNonEmptyString(value)) {
    return [];
  }
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) {
    throw new RangeError('chunk size must be greater than zero');
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function stripSlackMrkdwn(value: string): string {
  return value
    .replace(/<([^|>]+)\|([^>]+)>/g, '$2')
    .replace(/<([^>]+)>/g, '$1')
    .replace(/[!*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
