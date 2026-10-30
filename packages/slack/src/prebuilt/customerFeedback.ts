import { actions, context, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { Severity, SlackBlock } from '../types/slack';
import { asLines, compactJoin, truncate } from '../utils/text';
import { titleWithTone } from './status';
import { toButtons, type ActionDefinition } from './shared';

export interface CustomerFeedbackOptions {
  customer: string;
  comment: string;
  rating?: number;
  maxRating?: number;
  plan?: string;
  source?: string;
  submittedAt?: string;
  url?: string;
  actions?: ActionDefinition[];
}

function ratingSeverity(rating: number | undefined, maxRating: number): Severity {
  if (rating === undefined) return 'info';
  const ratio = rating / maxRating;
  if (ratio >= 0.8) return 'success';
  if (ratio > 0.4) return 'neutral';
  return 'warning';
}

function stars(rating: number, maxRating: number): string {
  const filled = Math.min(maxRating, Math.max(0, Math.round(rating)));
  return `${'★'.repeat(filled)}${'☆'.repeat(maxRating - filled)} ${filled}/${maxRating}`;
}

function renderCustomerFeedback(options: CustomerFeedbackOptions): RenderedComponent {
  const maxRating = options.maxRating ?? 5;
  const quote = asLines(truncate(options.comment, 2_000)).map((line) => `>${line}`).join('\n');
  const headline = [`*${options.customer}*${options.plan ? ` · ${options.plan}` : ''}`, options.rating !== undefined ? stars(options.rating, maxRating) : '']
    .filter(Boolean)
    .join('\n');

  const blocks: SlackBlock[] = [
    header(titleWithTone('New customer feedback', ratingSeverity(options.rating, maxRating))),
    section(`${headline}\n${quote}`)
  ];

  const meta = compactJoin([options.source ? `via ${options.source}` : '', options.submittedAt]);
  if (meta) {
    blocks.push(context([meta]));
  }

  const buttons: ActionDefinition[] = [{ text: 'Reply', actionId: 'reply_feedback', value: options.customer }];
  if (options.url) buttons.unshift({ text: 'View feedback', url: options.url, actionId: 'view_feedback' });
  buttons.push(...(options.actions ?? []));
  blocks.push(actions(toButtons(buttons)));

  return {
    blocks,
    fallbackText: compactJoin([
      `Feedback from ${options.customer}`,
      options.rating !== undefined ? `${options.rating}/${maxRating}` : '',
      truncate(options.comment, 140)
    ])
  };
}

export const customerFeedback = defineComponent<CustomerFeedbackOptions>('prebuilt.customerFeedback', renderCustomerFeedback);
