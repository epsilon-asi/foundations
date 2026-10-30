import { actions, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { SlackBlock } from '../types/slack';
import { compactJoin } from '../utils/text';
import { linkedLabel, progressBar, toButtons, type ActionDefinition } from './shared';

export interface ChecklistItem {
  text: string;
  done?: boolean;
  owner?: string;
  url?: string;
}

export interface ChecklistOptions {
  title: string;
  items: ChecklistItem[];
  description?: string;
  showProgress?: boolean;
  maxItems?: number;
  emptyText?: string;
  actions?: ActionDefinition[];
}

function renderItem(item: ChecklistItem): string {
  const label = linkedLabel(item.text, item.url);
  const owner = item.owner ? ` — ${item.owner}` : '';
  return item.done ? `✅ ~${label}~${owner}` : `⬜ ${label}${owner}`;
}

function renderChecklist(options: ChecklistOptions): RenderedComponent {
  const items = options.items.slice(0, options.maxItems ?? 20);
  const done = options.items.filter((item) => item.done).length;
  const total = options.items.length;
  const blocks: SlackBlock[] = [header(`☑️ ${options.title}`)];

  if (options.description) {
    blocks.push(section(options.description));
  }

  if (options.showProgress !== false && total > 0) {
    blocks.push(section(`${progressBar((done / total) * 100)} *${done}/${total}* complete`));
  }

  if (items.length === 0) {
    blocks.push(section(options.emptyText ?? 'No items yet.'));
  } else {
    blocks.push(section(items.map(renderItem).join('\n')));
  }

  const omitted = total - items.length;
  if (omitted > 0) {
    blocks.push(section(`_${omitted} more item${omitted === 1 ? '' : 's'} not shown._`));
  }

  if (options.actions?.length) {
    blocks.push(actions(toButtons(options.actions)));
  }

  return {
    blocks,
    fallbackText: compactJoin([options.title, `${done}/${total} complete`])
  };
}

export const checklist = defineComponent<ChecklistOptions>('prebuilt.checklist', renderChecklist);
