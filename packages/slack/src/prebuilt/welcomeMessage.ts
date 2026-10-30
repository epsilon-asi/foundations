import { actions, fieldSections, header, imageElement, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { SlackBlock } from '../types/slack';
import { compactJoin, slackLink } from '../utils/text';
import { bulletList, toButtons, toFields, type ActionDefinition, type FieldDefinition } from './shared';

export interface WelcomeResource {
  label: string;
  url: string;
}

export interface WelcomeMessageOptions {
  name: string;
  role?: string;
  team?: string;
  startDate?: string;
  manager?: string;
  buddy?: string;
  bio?: string;
  avatarUrl?: string;
  resources?: WelcomeResource[];
  actions?: ActionDefinition[];
}

function renderWelcomeMessage(options: WelcomeMessageOptions): RenderedComponent {
  const intro = `Please give a warm welcome to *${options.name}*${options.role ? `, our new ${options.role}` : ''}${options.team ? ` on ${options.team}` : ''}! 🎉`;
  const text = [intro, options.bio].filter(Boolean).join('\n');

  const blocks: SlackBlock[] = [
    header(`👋 Welcome, ${options.name}!`),
    section({
      text,
      ...(options.avatarUrl ? { accessory: imageElement({ imageUrl: options.avatarUrl, altText: options.name }) } : {})
    })
  ];

  const fields: FieldDefinition[] = [];
  if (options.role) fields.push({ label: 'Role', value: options.role });
  if (options.team) fields.push({ label: 'Team', value: options.team });
  if (options.startDate) fields.push({ label: 'Start date', value: options.startDate });
  if (options.manager) fields.push({ label: 'Manager', value: options.manager });
  if (options.buddy) fields.push({ label: 'Onboarding buddy', value: options.buddy });
  if (fields.length) {
    blocks.push(...fieldSections(toFields(fields)));
  }

  if (options.resources?.length) {
    blocks.push(section(`*Helpful links*\n${bulletList(options.resources.map((resource) => slackLink(resource.url, resource.label)))}`));
  }

  if (options.actions?.length) {
    blocks.push(actions(toButtons(options.actions)));
  }

  return {
    blocks,
    fallbackText: compactJoin([`Welcome ${options.name}`, options.role, options.team])
  };
}

export const welcomeMessage = defineComponent<WelcomeMessageOptions>('prebuilt.welcomeMessage', renderWelcomeMessage);
