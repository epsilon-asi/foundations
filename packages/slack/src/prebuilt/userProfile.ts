import { actions, fieldSections, imageElement, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { SlackBlock } from '../types/slack';
import { compactJoin, slackLink } from '../utils/text';
import { toButtons, toFields, type ActionDefinition, type FieldDefinition } from './shared';

export interface UserProfileOptions {
  name: string;
  title?: string;
  department?: string;
  location?: string;
  timezone?: string;
  email?: string;
  phone?: string;
  manager?: string;
  pronouns?: string;
  status?: string;
  avatarUrl?: string;
  profileUrl?: string;
  actions?: ActionDefinition[];
}

function renderUserProfile(options: UserProfileOptions): RenderedComponent {
  const headline = [`*${options.name}*${options.pronouns ? ` (${options.pronouns})` : ''}`, options.title, options.status ? `_${options.status}_` : '']
    .filter(Boolean)
    .join('\n');

  const blocks: SlackBlock[] = [
    section({
      text: headline,
      ...(options.avatarUrl ? { accessory: imageElement({ imageUrl: options.avatarUrl, altText: options.name }) } : {})
    })
  ];

  const fields: FieldDefinition[] = [];
  if (options.department) fields.push({ label: 'Department', value: options.department });
  if (options.manager) fields.push({ label: 'Manager', value: options.manager });
  if (options.location) fields.push({ label: 'Location', value: options.location });
  if (options.timezone) fields.push({ label: 'Time zone', value: options.timezone });
  if (options.email) fields.push({ label: 'Email', value: slackLink(`mailto:${options.email}`, options.email) });
  if (options.phone) fields.push({ label: 'Phone', value: options.phone });
  if (fields.length) {
    blocks.push(...fieldSections(toFields(fields)));
  }

  const buttons: ActionDefinition[] = [...(options.actions ?? [])];
  if (options.profileUrl) {
    buttons.unshift({ text: 'View full profile', url: options.profileUrl, actionId: 'view_profile' });
  }
  if (buttons.length) {
    blocks.push(actions(toButtons(buttons)));
  }

  return {
    blocks,
    fallbackText: compactJoin([options.name, options.title, options.department])
  };
}

export const userProfile = defineComponent<UserProfileOptions>('prebuilt.userProfile', renderUserProfile);
