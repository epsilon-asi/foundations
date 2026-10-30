import { slugify } from '../utils/ids';
import { card } from './card';
import { PRIORITY_SEVERITY, priorityLabel, type ActionDefinition, type FieldDefinition, type Priority } from './shared';

export interface SupportTicketOptions {
  ticketId: string;
  subject: string;
  requester: string;
  status?: string;
  priority?: Priority;
  assignee?: string;
  channel?: string;
  slaDueAt?: string;
  description?: string;
  url?: string;
  actions?: ActionDefinition[];
}

export function supportTicket(options: SupportTicketOptions) {
  const fields: FieldDefinition[] = [
    { label: 'Requester', value: options.requester },
    { label: 'Status', value: options.status ?? 'New' },
    { label: 'Assignee', value: options.assignee ?? 'Unassigned' }
  ];
  if (options.priority) fields.push({ label: 'Priority', value: priorityLabel(options.priority) });
  if (options.channel) fields.push({ label: 'Channel', value: options.channel });
  if (options.slaDueAt) fields.push({ label: 'SLA due', value: options.slaDueAt });

  const prefix = slugify(options.ticketId, 'ticket');
  const actions: ActionDefinition[] = [];
  if (!options.assignee) {
    actions.push({ text: 'Assign to me', style: 'primary', actionId: `${prefix}_assign`, value: options.ticketId });
  }
  if (options.url) actions.push({ text: 'View ticket', url: options.url, actionId: `${prefix}_view` });
  actions.push(...(options.actions ?? []));

  return card({
    title: `${options.ticketId}: ${options.subject}`,
    body: options.description,
    severity: options.priority ? PRIORITY_SEVERITY[options.priority] : 'info',
    fields,
    actions
  });
}
