import type { Severity } from '../types/slack';

export interface StatusTone {
  emoji: string;
  label: string;
}

export const STATUS_TONES: Record<Severity, StatusTone> = {
  neutral: { emoji: '•', label: 'Update' },
  info: { emoji: 'ℹ️', label: 'Info' },
  success: { emoji: '✅', label: 'Success' },
  warning: { emoji: '⚠️', label: 'Warning' },
  danger: { emoji: '🚨', label: 'Critical' }
};

export function tone(severity: Severity = 'info'): StatusTone {
  return STATUS_TONES[severity] ?? STATUS_TONES.info;
}

export function titleWithTone(title: string, severity: Severity = 'info'): string {
  const selected = tone(severity);
  return `${selected.emoji} ${title}`;
}
