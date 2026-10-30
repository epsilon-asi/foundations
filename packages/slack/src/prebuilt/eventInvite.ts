import { actions, fieldSections, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { SlackBlock } from '../types/slack';
import { slugify } from '../utils/ids';
import { compactJoin } from '../utils/text';
import { toButtons, toFields, type ActionDefinition, type FieldDefinition } from './shared';

export interface EventInviteOptions {
  title: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  host?: string;
  description?: string;
  eventId?: string;
  rsvp?: boolean;
  calendarUrl?: string;
  videoUrl?: string;
  actions?: ActionDefinition[];
}

function renderEventInvite(options: EventInviteOptions): RenderedComponent {
  const when = options.endsAt ? `${options.startsAt} – ${options.endsAt}` : options.startsAt;
  const fields: FieldDefinition[] = [{ label: 'When', value: when }];
  if (options.location) fields.push({ label: 'Where', value: options.location });
  if (options.host) fields.push({ label: 'Host', value: options.host });

  const blocks: SlackBlock[] = [header(`📅 ${options.title}`)];
  if (options.description) {
    blocks.push(section(options.description));
  }
  blocks.push(...fieldSections(toFields(fields)));

  const prefix = slugify(options.eventId ?? options.title, 'event');
  const buttons: ActionDefinition[] = [];
  if (options.rsvp !== false) {
    buttons.push(
      { text: 'Going', style: 'primary', actionId: `${prefix}_rsvp_yes`, value: 'yes' },
      { text: 'Maybe', actionId: `${prefix}_rsvp_maybe`, value: 'maybe' },
      { text: 'Can’t go', actionId: `${prefix}_rsvp_no`, value: 'no' }
    );
  }
  if (options.videoUrl) buttons.push({ text: 'Join call', url: options.videoUrl, actionId: `${prefix}_join_call` });
  if (options.calendarUrl) buttons.push({ text: 'Add to calendar', url: options.calendarUrl, actionId: `${prefix}_add_to_calendar` });
  buttons.push(...(options.actions ?? []));

  if (buttons.length) {
    blocks.push(actions(toButtons(buttons)));
  }

  return {
    blocks,
    fallbackText: compactJoin([options.title, when, options.location])
  };
}

export const eventInvite = defineComponent<EventInviteOptions>('prebuilt.eventInvite', renderEventInvite);
