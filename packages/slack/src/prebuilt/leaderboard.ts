import { actions, context, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { Primitive, SlackBlock } from '../types/slack';
import { compactJoin, formatPrimitive } from '../utils/text';
import { toButtons, type ActionDefinition } from './shared';

export interface LeaderboardEntry {
  name: string;
  score: Primitive;
  change?: number;
}

export interface LeaderboardOptions {
  title: string;
  entries: LeaderboardEntry[];
  metric?: string;
  period?: string;
  maxEntries?: number;
  emptyText?: string;
  actions?: ActionDefinition[];
}

const MEDALS = ['🥇', '🥈', '🥉'];

function renderEntry(entry: LeaderboardEntry, index: number, metric?: string): string {
  const rank = MEDALS[index] ?? `${index + 1}.`;
  const change = entry.change ? (entry.change > 0 ? ` ▲${entry.change}` : ` ▼${Math.abs(entry.change)}`) : '';
  return `${rank} *${entry.name}* — ${formatPrimitive(entry.score)}${metric ? ` ${metric}` : ''}${change}`;
}

function renderLeaderboard(options: LeaderboardOptions): RenderedComponent {
  const entries = options.entries.slice(0, options.maxEntries ?? 10);
  const blocks: SlackBlock[] = [header(`🏆 ${options.title}`)];

  if (options.period) {
    blocks.push(context([options.period]));
  }

  if (entries.length === 0) {
    blocks.push(section(options.emptyText ?? 'No entries yet.'));
  } else {
    blocks.push(section(entries.map((entry, index) => renderEntry(entry, index, options.metric)).join('\n')));
  }

  if (options.actions?.length) {
    blocks.push(actions(toButtons(options.actions)));
  }

  return {
    blocks,
    fallbackText: compactJoin([options.title, entries[0] ? `Leader: ${entries[0].name}` : ''])
  };
}

export const leaderboard = defineComponent<LeaderboardOptions>('prebuilt.leaderboard', renderLeaderboard);
