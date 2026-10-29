import { actions, context, fieldSections, header, imageElement, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { ImageSource, Severity, SlackBlock } from '../types/slack';
import { asLines, compactJoin } from '../utils/text';
import { titleWithTone } from './status';
import { toButtons, toFields, type ActionDefinition, type FieldDefinition } from './shared';

export interface CardOptions extends ImageSource {
  title: string;
  body?: string | string[];
  severity?: Severity;
  fields?: FieldDefinition[];
  actions?: ActionDefinition[];
  context?: string[];
  thumbnailUrl?: string;
  thumbnailAltText?: string;
  includeDivider?: boolean;
}

function renderCard(options: CardOptions): RenderedComponent {
  const blocks: SlackBlock[] = [header(titleWithTone(options.title, options.severity ?? 'neutral'))];
  const body = asLines(options.body).join('\n');

  if (body) {
    blocks.push(
      section({
        text: body,
        ...(options.thumbnailUrl
          ? { accessory: imageElement({ imageUrl: options.thumbnailUrl, altText: options.thumbnailAltText ?? options.title }) }
          : {})
      })
    );
  }

  if (options.fields?.length) {
    blocks.push(...fieldSections(toFields(options.fields)));
  }

  if (options.context?.length) {
    blocks.push(context(options.context));
  }

  if (options.actions?.length) {
    blocks.push(actions(toButtons(options.actions)));
  }

  if (options.includeDivider) {
    blocks.push({ type: 'divider' as const });
  }

  return {
    blocks,
    fallbackText: compactJoin([options.title, body, options.fields?.map((field) => `${field.label}: ${field.value}`).join(', ')])
  };
}

export const card = defineComponent<CardOptions>('prebuilt.card', renderCard);
