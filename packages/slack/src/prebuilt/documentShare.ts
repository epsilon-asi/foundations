import { actions, context, imageElement, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { SlackBlock } from '../types/slack';
import { compactJoin, slackLink } from '../utils/text';
import { toButtons, type ActionDefinition } from './shared';

export interface DocumentShareOptions {
  title: string;
  url: string;
  description?: string;
  documentType?: string;
  sharedBy?: string;
  updatedAt?: string;
  access?: string;
  thumbnailUrl?: string;
  actions?: ActionDefinition[];
}

function renderDocumentShare(options: DocumentShareOptions): RenderedComponent {
  const text = [`📄 *${slackLink(options.url, options.title)}*`, options.description].filter(Boolean).join('\n');
  const blocks: SlackBlock[] = [
    section({
      text,
      ...(options.thumbnailUrl ? { accessory: imageElement({ imageUrl: options.thumbnailUrl, altText: options.title }) } : {})
    })
  ];

  const meta = compactJoin([
    options.documentType,
    options.sharedBy ? `Shared by ${options.sharedBy}` : '',
    options.updatedAt ? `Updated ${options.updatedAt}` : '',
    options.access
  ]);
  if (meta) {
    blocks.push(context([meta]));
  }

  blocks.push(
    actions(toButtons([{ text: 'Open', url: options.url, style: 'primary', actionId: 'open_document' }, ...(options.actions ?? [])]))
  );

  return {
    blocks,
    fallbackText: options.sharedBy ? `${options.sharedBy} shared ${options.title}` : options.title
  };
}

export const documentShare = defineComponent<DocumentShareOptions>('prebuilt.documentShare', renderDocumentShare);
