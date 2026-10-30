import { slackLink } from '../utils/text';
import { card } from './card';
import type { ActionDefinition, FieldDefinition } from './shared';

export interface LeadAlertOptions {
  name: string;
  company?: string;
  jobTitle?: string;
  email?: string;
  source?: string;
  score?: number;
  hotScore?: number;
  owner?: string;
  message?: string;
  url?: string;
  leadId?: string;
  actions?: ActionDefinition[];
}

export function leadAlert(options: LeadAlertOptions) {
  const hot = options.score !== undefined && options.score >= (options.hotScore ?? 80);
  const fields: FieldDefinition[] = [];
  if (options.company) fields.push({ label: 'Company', value: options.company });
  if (options.jobTitle) fields.push({ label: 'Title', value: options.jobTitle });
  if (options.email) fields.push({ label: 'Email', value: slackLink(`mailto:${options.email}`, options.email) });
  if (options.source) fields.push({ label: 'Source', value: options.source });
  if (options.score !== undefined) fields.push({ label: 'Lead score', value: `${options.score}${hot ? ' 🔥' : ''}` });
  fields.push({ label: 'Owner', value: options.owner ?? 'Unassigned' });

  const actions: ActionDefinition[] = [];
  if (!options.owner) {
    actions.push({ text: 'Claim lead', style: 'primary', actionId: 'claim_lead', value: options.leadId ?? options.email ?? options.name });
  }
  if (options.url) actions.push({ text: 'View in CRM', url: options.url, actionId: 'view_lead' });
  actions.push(...(options.actions ?? []));

  return card({
    title: `${hot ? 'Hot lead' : 'New lead'}: ${options.name}${options.company ? ` (${options.company})` : ''}`,
    body: options.message,
    severity: hot ? 'success' : 'info',
    fields,
    actions
  });
}
