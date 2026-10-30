import { actions, fieldSections, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { Severity, SlackBlock } from '../types/slack';
import { asLines, compactJoin } from '../utils/text';
import { tone } from './status';
import { linkedLabel, toButtons, toFields, type ActionDefinition, type FieldDefinition } from './shared';

export interface HandoffIncident {
  id: string;
  title: string;
  severity?: Severity;
  url?: string;
}

export interface OnCallHandoffOptions {
  rotation: string;
  from: string;
  to: string;
  startsAt?: string;
  endsAt?: string;
  openIncidents?: HandoffIncident[];
  notes?: string | string[];
  scheduleUrl?: string;
  actions?: ActionDefinition[];
}

function renderOnCallHandoff(options: OnCallHandoffOptions): RenderedComponent {
  const blocks: SlackBlock[] = [
    header(`📟 ${options.rotation} on-call handoff`),
    section(`*${options.from}* ➜ *${options.to}*`)
  ];

  const fields: FieldDefinition[] = [];
  if (options.startsAt) fields.push({ label: 'Shift starts', value: options.startsAt });
  if (options.endsAt) fields.push({ label: 'Shift ends', value: options.endsAt });
  if (fields.length) {
    blocks.push(...fieldSections(toFields(fields)));
  }

  const incidents = options.openIncidents ?? [];
  blocks.push(
    section(
      incidents.length
        ? `*Open incidents (${incidents.length})*\n${incidents
            .map((incident) => `${tone(incident.severity ?? 'warning').emoji} ${linkedLabel(`${incident.id}: ${incident.title}`, incident.url)}`)
            .join('\n')}`
        : '✅ No open incidents.'
    )
  );

  const notes = asLines(options.notes);
  if (notes.length) {
    blocks.push(section(`*Notes*\n${notes.join('\n')}`));
  }

  const buttons: ActionDefinition[] = [{ text: 'Acknowledge handoff', style: 'primary', actionId: 'acknowledge_handoff', value: options.to }];
  if (options.scheduleUrl) buttons.push({ text: 'View schedule', url: options.scheduleUrl, actionId: 'view_oncall_schedule' });
  buttons.push(...(options.actions ?? []));
  blocks.push(actions(toButtons(buttons)));

  return {
    blocks,
    fallbackText: compactJoin([
      `${options.rotation} on-call: ${options.from} → ${options.to}`,
      `${incidents.length} open incident${incidents.length === 1 ? '' : 's'}`
    ])
  };
}

export const onCallHandoff = defineComponent<OnCallHandoffOptions>('prebuilt.onCallHandoff', renderOnCallHandoff);
