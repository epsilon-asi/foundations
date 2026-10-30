import { actions, context, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { SlackBlock } from '../types/slack';
import { compactJoin } from '../utils/text';
import { bulletList, toButtons, type ActionDefinition } from './shared';

export interface ReleaseNotesOptions {
  version: string;
  product?: string;
  date?: string;
  summary?: string;
  features?: string[];
  improvements?: string[];
  fixes?: string[];
  breaking?: string[];
  maxItemsPerSection?: number;
  url?: string;
  actions?: ActionDefinition[];
}

function renderGroup(title: string, items: string[], max: number): string {
  const shown = items.slice(0, max);
  const omitted = items.length - shown.length;
  return `*${title}*\n${bulletList(shown)}${omitted > 0 ? `\n_+${omitted} more_` : ''}`;
}

function renderReleaseNotes(options: ReleaseNotesOptions): RenderedComponent {
  const max = options.maxItemsPerSection ?? 10;
  const title = compactJoin([options.product, options.version], ' ');
  const blocks: SlackBlock[] = [header(`🚀 ${title}`)];

  if (options.date) {
    blocks.push(context([`Released ${options.date}`]));
  }
  if (options.summary) {
    blocks.push(section(options.summary));
  }

  const groups: Array<[string, string[] | undefined]> = [
    ['⚠️ Breaking changes', options.breaking],
    ['✨ New', options.features],
    ['⚡ Improvements', options.improvements],
    ['🐛 Fixes', options.fixes]
  ];
  const rendered = groups.filter(([, items]) => items?.length).map(([groupTitle, items]) => section(renderGroup(groupTitle, items ?? [], max)));
  blocks.push(...rendered);

  if (!options.summary && rendered.length === 0) {
    blocks.push(section('_No notable changes in this release._'));
  }

  const buttons: ActionDefinition[] = [...(options.actions ?? [])];
  if (options.url) {
    buttons.unshift({ text: 'Full changelog', url: options.url, actionId: 'open_changelog' });
  }
  if (buttons.length) {
    blocks.push(actions(toButtons(buttons)));
  }

  return {
    blocks,
    fallbackText: compactJoin([
      `Released ${title}`,
      options.breaking?.length ? `${options.breaking.length} breaking change${options.breaking.length === 1 ? '' : 's'}` : ''
    ])
  };
}

export const releaseNotes = defineComponent<ReleaseNotesOptions>('prebuilt.releaseNotes', renderReleaseNotes);
