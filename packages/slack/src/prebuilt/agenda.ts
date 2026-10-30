import { actions, context, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { SlackBlock } from '../types/slack';
import { compactJoin } from '../utils/text';
import { linkedLabel, toButtons, type ActionDefinition } from './shared';

export interface AgendaItem {
  time: string;
  title: string;
  location?: string;
  url?: string;
  note?: string;
}

export interface AgendaOptions {
  title: string;
  items: AgendaItem[];
  date?: string;
  maxItems?: number;
  emptyText?: string;
  actions?: ActionDefinition[];
}

function renderItem(item: AgendaItem): string {
  const location = item.location ? ` · 📍 ${item.location}` : '';
  const note = item.note ? `\n_${item.note}_` : '';
  return `*${item.time}*  ${linkedLabel(item.title, item.url)}${location}${note}`;
}

function renderAgenda(options: AgendaOptions): RenderedComponent {
  const items = options.items.slice(0, options.maxItems ?? 15);
  const blocks: SlackBlock[] = [header(`🗓️ ${options.title}`)];

  if (options.date) {
    blocks.push(context([options.date]));
  }

  if (items.length === 0) {
    blocks.push(section(options.emptyText ?? 'Nothing scheduled.'));
  } else {
    blocks.push(section(items.map(renderItem).join('\n')));
  }

  const omitted = options.items.length - items.length;
  if (omitted > 0) {
    blocks.push(section(`_${omitted} more item${omitted === 1 ? '' : 's'} not shown._`));
  }

  if (options.actions?.length) {
    blocks.push(actions(toButtons(options.actions)));
  }

  return {
    blocks,
    fallbackText: compactJoin([options.title, options.date, `${options.items.length} item${options.items.length === 1 ? '' : 's'}`])
  };
}

export const agenda = defineComponent<AgendaOptions>('prebuilt.agenda', renderAgenda);
