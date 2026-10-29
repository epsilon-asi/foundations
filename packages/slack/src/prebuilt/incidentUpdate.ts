import type { Severity } from '../types/slack';
import { card } from './card';
import type { ActionDefinition, FieldDefinition } from './shared';

export interface IncidentUpdateOptions {
  incidentId: string;
  title: string;
  status: string;
  severity?: Severity;
  summary: string;
  impact?: string;
  owner?: string;
  startedAt?: string;
  nextUpdateAt?: string;
  actions?: ActionDefinition[];
}

export function incidentUpdate(options: IncidentUpdateOptions) {
  const fields: FieldDefinition[] = [
    { label: 'Incident', value: options.incidentId },
    { label: 'Status', value: options.status }
  ];

  if (options.impact) fields.push({ label: 'Impact', value: options.impact });
  if (options.owner) fields.push({ label: 'Owner', value: options.owner });
  if (options.startedAt) fields.push({ label: 'Started', value: options.startedAt });
  if (options.nextUpdateAt) fields.push({ label: 'Next update', value: options.nextUpdateAt });

  return card({
    title: options.title,
    body: options.summary,
    severity: options.severity ?? 'danger',
    fields,
    actions: options.actions
  });
}
