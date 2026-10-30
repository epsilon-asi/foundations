import { actions, fieldSections, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { SlackBlock } from '../types/slack';
import { slugify } from '../utils/ids';
import { compactJoin } from '../utils/text';
import { toButtons, toFields, type ActionDefinition, type FieldDefinition } from './shared';

export interface ReminderOptions {
  title: string;
  details?: string;
  dueAt?: string;
  assignee?: string;
  overdue?: boolean;
  url?: string;
  reminderId?: string;
  snooze?: boolean;
  actions?: ActionDefinition[];
}

function renderReminder(options: ReminderOptions): RenderedComponent {
  const blocks: SlackBlock[] = [header(options.overdue ? `🔴 Overdue: ${options.title}` : `⏰ ${options.title}`)];

  if (options.details) {
    blocks.push(section(options.details));
  }

  const fields: FieldDefinition[] = [];
  if (options.dueAt) fields.push({ label: 'Due', value: options.dueAt });
  if (options.assignee) fields.push({ label: 'Assignee', value: options.assignee });
  if (fields.length) {
    blocks.push(...fieldSections(toFields(fields)));
  }

  const prefix = slugify(options.reminderId ?? options.title, 'reminder');
  const buttons: ActionDefinition[] = [{ text: 'Mark done', style: 'primary', actionId: `${prefix}_done`, value: 'done' }];
  if (options.snooze !== false) {
    buttons.push({ text: 'Snooze 1 hour', actionId: `${prefix}_snooze`, value: '1h' });
  }
  if (options.url) {
    buttons.push({ text: 'Open', url: options.url, actionId: `${prefix}_open` });
  }
  buttons.push(...(options.actions ?? []));
  blocks.push(actions(toButtons(buttons)));

  return {
    blocks,
    fallbackText: compactJoin([options.overdue ? `Overdue: ${options.title}` : `Reminder: ${options.title}`, options.dueAt ? `Due ${options.dueAt}` : ''])
  };
}

export const reminder = defineComponent<ReminderOptions>('prebuilt.reminder', renderReminder);
