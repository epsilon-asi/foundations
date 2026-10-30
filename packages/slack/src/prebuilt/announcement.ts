import { actions, context, header, image, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { ImageSource, SlackBlock } from '../types/slack';
import { asLines, compactJoin } from '../utils/text';
import { toButtons, type ActionDefinition } from './shared';

export interface AnnouncementOptions extends ImageSource {
  title: string;
  body: string | string[];
  author?: string;
  audience?: string;
  postedAt?: string;
  imageAltText?: string;
  actions?: ActionDefinition[];
}

function renderAnnouncement(options: AnnouncementOptions): RenderedComponent {
  const body = asLines(options.body).join('\n');
  const blocks: SlackBlock[] = [header(`📣 ${options.title}`)];

  if (body) {
    blocks.push(section(body));
  }

  if (options.imageUrl || options.slackFile) {
    blocks.push(
      image({
        imageUrl: options.imageUrl,
        slackFile: options.slackFile,
        altText: options.imageAltText ?? options.title
      })
    );
  }

  const meta = compactJoin([
    options.author ? `Posted by *${options.author}*` : '',
    options.audience ? `For ${options.audience}` : '',
    options.postedAt
  ]);
  if (meta) {
    blocks.push(context([meta]));
  }

  if (options.actions?.length) {
    blocks.push(actions(toButtons(options.actions)));
  }

  return {
    blocks,
    fallbackText: compactJoin([options.title, body])
  };
}

export const announcement = defineComponent<AnnouncementOptions>('prebuilt.announcement', renderAnnouncement);
