import type { Severity } from '../types/slack';
import { slugify } from '../utils/ids';
import { card } from './card';
import type { ActionDefinition, FieldDefinition } from './shared';

export interface SecurityAlertOptions {
  title: string;
  description: string;
  severity?: Severity;
  user?: string;
  ipAddress?: string;
  location?: string;
  device?: string;
  occurredAt?: string;
  verify?: boolean;
  alertId?: string;
  url?: string;
  actions?: ActionDefinition[];
}

export function securityAlert(options: SecurityAlertOptions) {
  const fields: FieldDefinition[] = [];
  if (options.user) fields.push({ label: 'Account', value: options.user });
  if (options.occurredAt) fields.push({ label: 'When', value: options.occurredAt });
  if (options.ipAddress) fields.push({ label: 'IP address', value: `\`${options.ipAddress}\`` });
  if (options.location) fields.push({ label: 'Location', value: options.location });
  if (options.device) fields.push({ label: 'Device', value: options.device });

  const prefix = slugify(options.alertId ?? 'security_alert', 'security_alert');
  const actions: ActionDefinition[] = [];
  if (options.verify !== false) {
    actions.push(
      { text: 'Yes, this was me', style: 'primary', actionId: `${prefix}_confirm`, value: 'confirmed' },
      { text: 'No, secure my account', style: 'danger', actionId: `${prefix}_report`, value: 'report' }
    );
  }
  if (options.url) actions.push({ text: 'View details', url: options.url, actionId: `${prefix}_details` });
  actions.push(...(options.actions ?? []));

  return card({
    title: options.title,
    body: options.description,
    severity: options.severity ?? 'danger',
    fields,
    actions,
    context: ['🔒 Security never asks for your password in Slack.']
  });
}
