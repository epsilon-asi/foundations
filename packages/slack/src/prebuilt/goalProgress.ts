import { actions, context, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { Primitive, SlackBlock } from '../types/slack';
import { compactJoin, formatPrimitive } from '../utils/text';
import { clampPercent, progressBar, toButtons, type ActionDefinition } from './shared';

export interface KeyResult {
  title: string;
  progress: number;
  current?: Primitive;
  target?: Primitive;
  owner?: string;
}

export interface GoalProgressOptions {
  objective: string;
  keyResults: KeyResult[];
  period?: string;
  owner?: string;
  actions?: ActionDefinition[];
}

function progressDot(percent: number): string {
  if (percent >= 70) return '🟢';
  if (percent >= 40) return '🟡';
  return '🔴';
}

function renderKeyResult(keyResult: KeyResult): string {
  const percent = clampPercent(keyResult.progress);
  const detail = compactJoin([
    keyResult.target !== undefined ? `${formatPrimitive(keyResult.current)} / ${formatPrimitive(keyResult.target)}` : '',
    keyResult.owner
  ]);
  return `${progressDot(percent)} *${keyResult.title}*\n${progressBar(percent)} ${percent}%${detail ? `  _${detail}_` : ''}`;
}

function renderGoalProgress(options: GoalProgressOptions): RenderedComponent {
  const overall = options.keyResults.length
    ? clampPercent(options.keyResults.reduce((sum, keyResult) => sum + clampPercent(keyResult.progress), 0) / options.keyResults.length)
    : 0;
  const blocks: SlackBlock[] = [
    header(`🎯 ${options.objective}`),
    context([compactJoin([options.period, options.owner ? `Owner: ${options.owner}` : '', `Overall ${overall}%`])])
  ];

  if (options.keyResults.length === 0) {
    blocks.push(section('No key results defined yet.'));
  } else {
    blocks.push(section(options.keyResults.slice(0, 10).map(renderKeyResult).join('\n\n')));
  }

  if (options.actions?.length) {
    blocks.push(actions(toButtons(options.actions)));
  }

  return {
    blocks,
    fallbackText: compactJoin([options.objective, `${overall}% overall`])
  };
}

export const goalProgress = defineComponent<GoalProgressOptions>('prebuilt.goalProgress', renderGoalProgress);
