import { actions, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { Severity, SlackBlock } from '../types/slack';
import { compactJoin, slackLink, truncate } from '../utils/text';
import { tone } from './status';
import { toButtons, type ActionDefinition } from './shared';

export interface DigestItem {
  title: string;
  text?: string;
  url?: string;
  severity?: Severity;
}

export interface DigestOptions {
  title: string;
  items: DigestItem[];
  maxItems?: number;
  emptyText?: string;
  actions?: ActionDefinition[];
}

function renderItem(item: DigestItem): string {
  const prefix = item.severity ? tone(item.severity).emoji : '•';
  const title = item.url ? slackLink(item.url, item.title) : item.title;
  const description = item.text ? ` — ${truncate(item.text, 180)}` : '';
  return `${prefix} *${title}*${description}`;
}

function renderDigest(options: DigestOptions): RenderedComponent {
  const items = options.items.slice(0, options.maxItems ?? 10);
  const blocks: SlackBlock[] = [header(`🗞️ ${options.title}`)];

  if (items.length === 0) {
    blocks.push(section(options.emptyText ?? 'No updates.'));
  } else {
    blocks.push(section(items.map(renderItem).join('\n')));
  }

  const omitted = options.items.length - items.length;
  if (omitted > 0) {
    blocks.push(section(`_${omitted} more update${omitted === 1 ? '' : 's'} omitted._`));
  }

  if (options.actions?.length) {
    blocks.push(actions(toButtons(options.actions)));
  }

  return {
    blocks,
    fallbackText: compactJoin([options.title, `${items.length} update${items.length === 1 ? '' : 's'}`])
  };
}

export const digest = defineComponent<DigestOptions>('prebuilt.digest', renderDigest);
