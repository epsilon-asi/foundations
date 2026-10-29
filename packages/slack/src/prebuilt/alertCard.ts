import type { Severity } from '../types/slack';
import { card } from './card';
import type { ActionDefinition, FieldDefinition } from './shared';

export interface AlertCardOptions {
  title: string;
  message: string | string[];
  severity?: Severity;
  source?: string;
  timestamp?: string;
  fields?: FieldDefinition[];
  actions?: ActionDefinition[];
  runbookUrl?: string;
}

export function alertCard(options: AlertCardOptions) {
  const actions: ActionDefinition[] = [...(options.actions ?? [])];
  if (options.runbookUrl) {
    actions.push({ text: 'Open runbook', url: options.runbookUrl, actionId: 'open_runbook' });
  }

  const context = [options.source ? `Source: ${options.source}` : '', options.timestamp ? `Time: ${options.timestamp}` : ''].filter(Boolean);

  return card({
    title: options.title,
    body: options.message,
    severity: options.severity ?? 'warning',
    fields: options.fields,
    actions,
    context
  });
}
