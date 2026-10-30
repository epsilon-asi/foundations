import { slugify } from '../utils/ids';
import { card } from './card';
import { PRIORITY_SEVERITY, priorityLabel, type ActionDefinition, type FieldDefinition, type Priority } from './shared';

export interface TaskAssignmentOptions {
  title: string;
  assignee: string;
  description?: string;
  assignedBy?: string;
  dueDate?: string;
  priority?: Priority;
  project?: string;
  status?: string;
  url?: string;
  taskId?: string;
  actions?: ActionDefinition[];
}

export function taskAssignment(options: TaskAssignmentOptions) {
  const fields: FieldDefinition[] = [{ label: 'Assignee', value: options.assignee }];
  if (options.assignedBy) fields.push({ label: 'Assigned by', value: options.assignedBy });
  if (options.dueDate) fields.push({ label: 'Due', value: options.dueDate });
  if (options.priority) fields.push({ label: 'Priority', value: priorityLabel(options.priority) });
  if (options.project) fields.push({ label: 'Project', value: options.project });
  if (options.status) fields.push({ label: 'Status', value: options.status });

  const prefix = slugify(options.taskId ?? options.title, 'task');
  const actions: ActionDefinition[] = [{ text: 'Accept', style: 'primary', actionId: `${prefix}_accept`, value: options.taskId ?? prefix }];
  if (options.url) actions.push({ text: 'View task', url: options.url, actionId: `${prefix}_view` });
  actions.push(...(options.actions ?? []));

  return card({
    title: options.title,
    body: options.description,
    severity: options.priority ? PRIORITY_SEVERITY[options.priority] : 'info',
    fields,
    actions
  });
}
