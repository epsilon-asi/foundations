import { actions, fieldSections, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { SlackBlock } from '../types/slack';
import { slugify } from '../utils/ids';
import { compactJoin } from '../utils/text';
import { toButtons, toFields, type ActionDefinition, type FieldDefinition } from './shared';

export type PipelineRunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'cancelled';

export const PIPELINE_STATUS: Record<PipelineRunStatus, { emoji: string; label: string }> = {
  pending: { emoji: '⏳', label: 'pending' },
  running: { emoji: '🔄', label: 'running' },
  passed: { emoji: '✅', label: 'passed' },
  failed: { emoji: '❌', label: 'failed' },
  skipped: { emoji: '⏭️', label: 'skipped' },
  cancelled: { emoji: '🚫', label: 'cancelled' }
};

export interface PipelineStage {
  name: string;
  status: PipelineRunStatus;
  duration?: string;
}

export interface PipelineStatusOptions {
  pipeline: string;
  status: PipelineRunStatus;
  branch?: string;
  commit?: string;
  triggeredBy?: string;
  duration?: string;
  stages?: PipelineStage[];
  url?: string;
  runId?: string;
  actions?: ActionDefinition[];
}

function renderPipelineStatus(options: PipelineStatusOptions): RenderedComponent {
  const selected = PIPELINE_STATUS[options.status];
  const blocks: SlackBlock[] = [header(`${selected.emoji} ${options.pipeline} ${selected.label}`)];

  const fields: FieldDefinition[] = [];
  if (options.branch) fields.push({ label: 'Branch', value: `\`${options.branch}\`` });
  if (options.commit) fields.push({ label: 'Commit', value: `\`${options.commit}\`` });
  if (options.triggeredBy) fields.push({ label: 'Triggered by', value: options.triggeredBy });
  if (options.duration) fields.push({ label: 'Duration', value: options.duration });
  if (fields.length) {
    blocks.push(...fieldSections(toFields(fields)));
  }

  if (options.stages?.length) {
    const lines = options.stages.map(
      (stage) => `${PIPELINE_STATUS[stage.status].emoji} ${stage.name}${stage.duration ? ` · ${stage.duration}` : ''}`
    );
    blocks.push(section(`*Stages*\n${lines.join('\n')}`));
  }

  const prefix = slugify(options.runId ?? options.pipeline, 'pipeline');
  const buttons: ActionDefinition[] = [];
  if (options.url) buttons.push({ text: 'View run', url: options.url, actionId: `${prefix}_view_run` });
  if (options.status === 'failed') {
    buttons.push({ text: 'Retry', style: 'primary', actionId: `${prefix}_retry`, value: options.runId ?? options.pipeline });
  }
  if (options.status === 'running' || options.status === 'pending') {
    buttons.push({ text: 'Cancel', style: 'danger', actionId: `${prefix}_cancel`, value: options.runId ?? options.pipeline });
  }
  buttons.push(...(options.actions ?? []));
  if (buttons.length) {
    blocks.push(actions(toButtons(buttons)));
  }

  return {
    blocks,
    fallbackText: compactJoin([`${options.pipeline} ${selected.label}`, options.branch, options.commit])
  };
}

export const pipelineStatus = defineComponent<PipelineStatusOptions>('prebuilt.pipelineStatus', renderPipelineStatus);
