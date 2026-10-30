import { actions, context, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { SlackBlock } from '../types/slack';
import { compactJoin } from '../utils/text';
import { toButtons, type ActionDefinition } from './shared';

export interface StandupEntry {
  person: string;
  yesterday?: string;
  today?: string;
  blockers?: string;
}

export interface StandupSummaryOptions {
  team: string;
  entries: StandupEntry[];
  date?: string;
  maxEntries?: number;
  actions?: ActionDefinition[];
}

function renderEntry(entry: StandupEntry): string {
  const lines = [
    entry.yesterday ? `*Yesterday:* ${entry.yesterday}` : '',
    entry.today ? `*Today:* ${entry.today}` : '',
    entry.blockers ? `*Blockers:* 🚧 ${entry.blockers}` : ''
  ].filter(Boolean);
  return [`*${entry.person}*`, ...(lines.length ? lines : ['_No update submitted._'])].join('\n');
}

function renderStandupSummary(options: StandupSummaryOptions): RenderedComponent {
  const entries = options.entries.slice(0, options.maxEntries ?? 10);
  const blockers = options.entries.filter((entry) => entry.blockers).length;
  const blocks: SlackBlock[] = [header(`🧍 ${options.team} standup`)];

  blocks.push(
    context([
      compactJoin([
        options.date,
        `${options.entries.length} update${options.entries.length === 1 ? '' : 's'}`,
        blockers ? `🚧 ${blockers} blocker${blockers === 1 ? '' : 's'}` : 'No blockers'
      ])
    ])
  );

  if (entries.length === 0) {
    blocks.push(section('No standup updates yet.'));
  } else {
    blocks.push(...entries.map((entry) => section(renderEntry(entry))));
  }

  const omitted = options.entries.length - entries.length;
  if (omitted > 0) {
    blocks.push(section(`_${omitted} more update${omitted === 1 ? '' : 's'} not shown._`));
  }

  if (options.actions?.length) {
    blocks.push(actions(toButtons(options.actions)));
  }

  return {
    blocks,
    fallbackText: compactJoin([`${options.team} standup`, options.date, blockers ? `${blockers} blockers` : ''])
  };
}

export const standupSummary = defineComponent<StandupSummaryOptions>('prebuilt.standupSummary', renderStandupSummary);
