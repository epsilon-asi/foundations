import { actions, context, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { SlackBlock } from '../types/slack';
import { compactJoin } from '../utils/text';
import { toButtons, type ActionDefinition } from './shared';

export interface SurveyRequestOptions {
  title: string;
  surveyUrl: string;
  description?: string;
  dueDate?: string;
  estimatedMinutes?: number;
  questionCount?: number;
  anonymous?: boolean;
  actions?: ActionDefinition[];
}

function renderSurveyRequest(options: SurveyRequestOptions): RenderedComponent {
  const blocks: SlackBlock[] = [header(`📋 ${options.title}`)];

  if (options.description) {
    blocks.push(section(options.description));
  }

  const meta = compactJoin([
    options.questionCount ? `${options.questionCount} question${options.questionCount === 1 ? '' : 's'}` : '',
    options.estimatedMinutes ? `~${options.estimatedMinutes} min` : '',
    options.dueDate ? `Due ${options.dueDate}` : '',
    options.anonymous ? 'Anonymous' : ''
  ]);
  if (meta) {
    blocks.push(context([meta]));
  }

  blocks.push(
    actions(
      toButtons([
        { text: 'Take the survey', url: options.surveyUrl, style: 'primary', actionId: 'open_survey' },
        ...(options.actions ?? [])
      ])
    )
  );

  return {
    blocks,
    fallbackText: compactJoin([options.title, options.dueDate ? `Due ${options.dueDate}` : ''])
  };
}

export const surveyRequest = defineComponent<SurveyRequestOptions>('prebuilt.surveyRequest', renderSurveyRequest);
