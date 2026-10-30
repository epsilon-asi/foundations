import { actions, context, header, image, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { ImageSource, SlackBlock } from '../types/slack';
import { asLines } from '../utils/text';
import { toButtons, type ActionDefinition } from './shared';

export interface KudosOptions extends ImageSource {
  recipient: string;
  from: string;
  message: string;
  value?: string;
  imageAltText?: string;
  actions?: ActionDefinition[];
}

function renderKudos(options: KudosOptions): RenderedComponent {
  const quote = asLines(options.message).map((line) => `>${line}`).join('\n');
  const blocks: SlackBlock[] = [
    header('🙌 Kudos!'),
    section(`*${options.from}* recognized *${options.recipient}*\n${quote}`)
  ];

  if (options.imageUrl || options.slackFile) {
    blocks.push(
      image({
        imageUrl: options.imageUrl,
        slackFile: options.slackFile,
        altText: options.imageAltText ?? `Kudos for ${options.recipient}`
      })
    );
  }

  if (options.value) {
    blocks.push(context([`🏅 Company value: *${options.value}*`]));
  }

  if (options.actions?.length) {
    blocks.push(actions(toButtons(options.actions)));
  }

  return {
    blocks,
    fallbackText: `${options.from} gave kudos to ${options.recipient}: ${options.message}`
  };
}

export const kudos = defineComponent<KudosOptions>('prebuilt.kudos', renderKudos);
