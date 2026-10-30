import { actions, context, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { SlackBlock } from '../types/slack';
import { compactJoin } from '../utils/text';
import { bulletList, toButtons, type ActionDefinition } from './shared';

export interface MeetingActionItem {
  owner: string;
  task: string;
  dueDate?: string;
}

export interface MeetingSummaryOptions {
  title: string;
  date?: string;
  attendees?: string[];
  summary?: string;
  decisions?: string[];
  actionItems?: MeetingActionItem[];
  notesUrl?: string;
  recordingUrl?: string;
  actions?: ActionDefinition[];
}

function renderMeetingSummary(options: MeetingSummaryOptions): RenderedComponent {
  const blocks: SlackBlock[] = [header(`🗒️ ${options.title}`)];

  const meta = compactJoin([options.date, options.attendees?.length ? `👥 ${options.attendees.join(', ')}` : '']);
  if (meta) {
    blocks.push(context([meta]));
  }

  if (options.summary) {
    blocks.push(section(`*Summary*\n${options.summary}`));
  }

  if (options.decisions?.length) {
    blocks.push(section(`*Decisions*\n${bulletList(options.decisions)}`));
  }

  if (options.actionItems?.length) {
    const lines = options.actionItems.map(
      (item) => `☐ *${item.owner}* — ${item.task}${item.dueDate ? ` _(due ${item.dueDate})_` : ''}`
    );
    blocks.push(section(`*Action items*\n${lines.join('\n')}`));
  }

  const buttons: ActionDefinition[] = [];
  if (options.notesUrl) buttons.push({ text: 'Open notes', url: options.notesUrl, actionId: 'open_meeting_notes' });
  if (options.recordingUrl) buttons.push({ text: 'Watch recording', url: options.recordingUrl, actionId: 'open_meeting_recording' });
  buttons.push(...(options.actions ?? []));
  if (buttons.length) {
    blocks.push(actions(toButtons(buttons)));
  }

  return {
    blocks,
    fallbackText: compactJoin([
      `Meeting notes: ${options.title}`,
      options.actionItems?.length ? `${options.actionItems.length} action item${options.actionItems.length === 1 ? '' : 's'}` : ''
    ])
  };
}

export const meetingSummary = defineComponent<MeetingSummaryOptions>('prebuilt.meetingSummary', renderMeetingSummary);
