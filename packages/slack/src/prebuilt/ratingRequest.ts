import { actions, button, context, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { ButtonElement, SlackBlock } from '../types/slack';
import { slugify } from '../utils/ids';

export type RatingScale = 'stars' | 'nps' | 'thumbs';

export interface RatingRequestOptions {
  question: string;
  description?: string;
  scale?: RatingScale;
  requestId?: string;
  lowLabel?: string;
  highLabel?: string;
}

function ratingButtons(scale: RatingScale, prefix: string): ButtonElement[] {
  if (scale === 'thumbs') {
    return [
      button({ text: '👍 Yes', actionId: `${prefix}_rate_yes`, value: 'yes', style: 'primary' }),
      button({ text: '👎 No', actionId: `${prefix}_rate_no`, value: 'no' })
    ];
  }

  const values = scale === 'nps' ? Array.from({ length: 11 }, (_, index) => index) : [1, 2, 3, 4, 5];
  return values.map((value) =>
    button({
      text: scale === 'stars' ? `${value} ⭐` : String(value),
      actionId: `${prefix}_rate_${value}`,
      value: String(value)
    })
  );
}

function renderRatingRequest(options: RatingRequestOptions): RenderedComponent {
  const scale = options.scale ?? 'stars';
  const prefix = slugify(options.requestId ?? 'rating', 'rating');
  const text = [`*${options.question}*`, options.description].filter(Boolean).join('\n');
  const blocks: SlackBlock[] = [section(text), actions(ratingButtons(scale, prefix))];

  if (scale !== 'thumbs') {
    const low = scale === 'nps' ? '0' : '1';
    const high = scale === 'nps' ? '10' : '5';
    blocks.push(
      context([`${low} = ${options.lowLabel ?? (scale === 'nps' ? 'Not at all likely' : 'Poor')} · ${high} = ${options.highLabel ?? (scale === 'nps' ? 'Extremely likely' : 'Excellent')}`])
    );
  }

  return {
    blocks,
    fallbackText: options.question
  };
}

export const ratingRequest = defineComponent<RatingRequestOptions>('prebuilt.ratingRequest', renderRatingRequest);
