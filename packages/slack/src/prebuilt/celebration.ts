import { actions, header, image, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { ImageSource, SlackBlock } from '../types/slack';
import { toButtons, type ActionDefinition } from './shared';

export type CelebrationOccasion = 'birthday' | 'work_anniversary' | 'promotion' | 'milestone';

export interface CelebrationOptions extends ImageSource {
  name: string;
  occasion: CelebrationOccasion;
  years?: number;
  newRole?: string;
  title?: string;
  message?: string;
  imageAltText?: string;
  actions?: ActionDefinition[];
}

function celebrationTitle(options: CelebrationOptions): string {
  if (options.title) {
    return options.title;
  }
  switch (options.occasion) {
    case 'birthday':
      return `🎂 Happy birthday, ${options.name}!`;
    case 'work_anniversary':
      return options.years
        ? `🎉 Happy ${options.years}-year anniversary, ${options.name}!`
        : `🎉 Happy work anniversary, ${options.name}!`;
    case 'promotion':
      return `🚀 Congratulations, ${options.name}!`;
    default:
      return `🏆 ${options.name} reached a milestone!`;
  }
}

function defaultMessage(options: CelebrationOptions): string {
  switch (options.occasion) {
    case 'birthday':
      return `Wishing *${options.name}* a fantastic birthday. Drop your wishes in the thread!`;
    case 'work_anniversary':
      return `Thank you, *${options.name}*, for ${options.years ? `${options.years} amazing year${options.years === 1 ? '' : 's'}` : 'everything you do'} with the team.`;
    case 'promotion':
      return options.newRole ? `*${options.name}* is now *${options.newRole}*. Well deserved!` : `*${options.name}* has been promoted. Well deserved!`;
    default:
      return `Join us in celebrating *${options.name}*.`;
  }
}

function renderCelebration(options: CelebrationOptions): RenderedComponent {
  const title = celebrationTitle(options);
  const message = options.message ?? defaultMessage(options);
  const blocks: SlackBlock[] = [header(title), section(message)];

  if (options.imageUrl || options.slackFile) {
    blocks.push(
      image({
        imageUrl: options.imageUrl,
        slackFile: options.slackFile,
        altText: options.imageAltText ?? title
      })
    );
  }

  if (options.actions?.length) {
    blocks.push(actions(toButtons(options.actions)));
  }

  return {
    blocks,
    fallbackText: title
  };
}

export const celebration = defineComponent<CelebrationOptions>('prebuilt.celebration', renderCelebration);
