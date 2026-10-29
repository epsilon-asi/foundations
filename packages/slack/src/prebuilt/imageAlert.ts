import { actions, context, header, image, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { ImageSource, Severity, SlackBlock } from '../types/slack';
import { asLines, compactJoin } from '../utils/text';
import { titleWithTone } from './status';
import { toButtons, type ActionDefinition } from './shared';

export interface ImageAlertOptions extends ImageSource {
  title: string;
  message?: string | string[];
  severity?: Severity;
  altText: string;
  imageTitle?: string;
  caption?: string;
  actions?: ActionDefinition[];
}

function renderImageAlert(options: ImageAlertOptions): RenderedComponent {
  const blocks: SlackBlock[] = [header(titleWithTone(options.title, options.severity ?? 'warning'))];
  const body = asLines(options.message).join('\n');
  if (body) {
    blocks.push(section(body));
  }
  blocks.push(
    image({
      imageUrl: options.imageUrl,
      slackFile: options.slackFile,
      altText: options.altText,
      title: options.imageTitle ?? options.title
    })
  );
  if (options.caption) {
    blocks.push(context([options.caption]));
  }
  if (options.actions?.length) {
    blocks.push(actions(toButtons(options.actions)));
  }

  return {
    blocks,
    fallbackText: compactJoin([options.title, body, options.altText])
  };
}

export const imageAlert = defineComponent<ImageAlertOptions>('prebuilt.imageAlert', renderImageAlert);
