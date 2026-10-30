import { button, context, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { SlackBlock } from '../types/slack';
import { slugify } from '../utils/ids';
import { compactJoin } from '../utils/text';
import { progressBar } from './shared';

export interface PollOption {
  label: string;
  votes?: number;
  value?: string;
}

export interface PollOptions {
  question: string;
  options: PollOption[];
  pollId?: string;
  showResults?: boolean;
  allowVoting?: boolean;
  anonymous?: boolean;
  closesAt?: string;
  maxOptions?: number;
}

function renderPoll(options: PollOptions): RenderedComponent {
  const choices = options.options.slice(0, options.maxOptions ?? 10);
  const totalVotes = choices.reduce((sum, choice) => sum + (choice.votes ?? 0), 0);
  const prefix = slugify(options.pollId ?? 'poll', 'poll');
  const blocks: SlackBlock[] = [header(`🗳️ ${options.question}`)];

  choices.forEach((choice, index) => {
    const votes = choice.votes ?? 0;
    const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
    const text = options.showResults
      ? `*${choice.label}*\n${progressBar(percent)} ${percent}% (${votes} vote${votes === 1 ? '' : 's'})`
      : `*${choice.label}*`;

    blocks.push(
      section({
        text,
        ...(options.allowVoting !== false
          ? {
              accessory: button({
                text: 'Vote',
                actionId: `${prefix}_vote_${index + 1}`,
                value: choice.value ?? slugify(choice.label, `option_${index + 1}`)
              })
            }
          : {})
      })
    );
  });

  const omitted = options.options.length - choices.length;
  const meta = compactJoin([
    options.showResults ? `${totalVotes} vote${totalVotes === 1 ? '' : 's'}` : '',
    options.anonymous ? 'Responses are anonymous' : '',
    options.closesAt ? `Closes ${options.closesAt}` : '',
    omitted > 0 ? `${omitted} more option${omitted === 1 ? '' : 's'} not shown` : ''
  ]);
  if (meta) {
    blocks.push(context([meta]));
  }

  return {
    blocks,
    fallbackText: compactJoin([`Poll: ${options.question}`, choices.map((choice) => choice.label).join(', ')])
  };
}

export const poll = defineComponent<PollOptions>('prebuilt.poll', renderPoll);
