import type { Severity } from '../types/slack';
import { card } from './card';
import type { ActionDefinition, FieldDefinition } from './shared';

export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'extended' | 'completed' | 'cancelled';

const MAINTENANCE_STATUS: Record<MaintenanceStatus, { label: string; severity: Severity }> = {
  scheduled: { label: '🗓️ Scheduled', severity: 'info' },
  in_progress: { label: '🛠️ In progress', severity: 'warning' },
  extended: { label: '⏳ Extended', severity: 'warning' },
  completed: { label: '✅ Completed', severity: 'success' },
  cancelled: { label: '🚫 Cancelled', severity: 'neutral' }
};

export interface MaintenanceNoticeOptions {
  title: string;
  status: MaintenanceStatus;
  startsAt: string;
  endsAt?: string;
  description?: string;
  services?: string[];
  impact?: string;
  statusUrl?: string;
  actions?: ActionDefinition[];
}

export function maintenanceNotice(options: MaintenanceNoticeOptions) {
  const selected = MAINTENANCE_STATUS[options.status];
  const fields: FieldDefinition[] = [
    { label: 'Status', value: selected.label },
    { label: 'Window', value: options.endsAt ? `${options.startsAt} – ${options.endsAt}` : options.startsAt }
  ];
  if (options.services?.length) fields.push({ label: 'Affected services', value: options.services.join(', ') });
  if (options.impact) fields.push({ label: 'Expected impact', value: options.impact });

  const actions: ActionDefinition[] = [...(options.actions ?? [])];
  if (options.statusUrl) {
    actions.unshift({ text: 'Status page', url: options.statusUrl, actionId: 'open_status_page' });
  }

  return card({
    title: options.title,
    body: options.description,
    severity: selected.severity,
    fields,
    actions
  });
}
