import { actions, fieldSections, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { SlackBlock } from '../types/slack';
import { compactJoin } from '../utils/text';
import { bulletList, clampPercent, progressBar, toButtons, toFields, type ActionDefinition, type FieldDefinition } from './shared';

export type ProjectHealth = 'on_track' | 'at_risk' | 'off_track' | 'completed' | 'paused';

export const PROJECT_HEALTH_LABELS: Record<ProjectHealth, string> = {
  on_track: '🟢 On track',
  at_risk: '🟡 At risk',
  off_track: '🔴 Off track',
  completed: '✅ Completed',
  paused: '⏸️ Paused'
};

export interface ProjectStatusOptions {
  project: string;
  health: ProjectHealth;
  summary?: string;
  progress?: number;
  owner?: string;
  dueDate?: string;
  highlights?: string[];
  risks?: string[];
  nextSteps?: string[];
  url?: string;
  actions?: ActionDefinition[];
}

function renderProjectStatus(options: ProjectStatusOptions): RenderedComponent {
  const statusLine = `*Status:* ${PROJECT_HEALTH_LABELS[options.health]}`;
  const blocks: SlackBlock[] = [
    header(`📌 ${options.project}`),
    section([statusLine, options.summary].filter(Boolean).join('\n'))
  ];

  if (options.progress !== undefined) {
    const percent = clampPercent(options.progress);
    blocks.push(section(`${progressBar(percent)} ${percent}% complete`));
  }

  const fields: FieldDefinition[] = [];
  if (options.owner) fields.push({ label: 'Owner', value: options.owner });
  if (options.dueDate) fields.push({ label: 'Target date', value: options.dueDate });
  if (fields.length) {
    blocks.push(...fieldSections(toFields(fields)));
  }

  if (options.highlights?.length) blocks.push(section(`*✨ Highlights*\n${bulletList(options.highlights)}`));
  if (options.risks?.length) blocks.push(section(`*⚠️ Risks*\n${bulletList(options.risks)}`));
  if (options.nextSteps?.length) blocks.push(section(`*➡️ Next steps*\n${bulletList(options.nextSteps)}`));

  const buttons: ActionDefinition[] = [...(options.actions ?? [])];
  if (options.url) {
    buttons.unshift({ text: 'Open project', url: options.url, actionId: 'open_project' });
  }
  if (buttons.length) {
    blocks.push(actions(toButtons(buttons)));
  }

  return {
    blocks,
    fallbackText: compactJoin([
      options.project,
      PROJECT_HEALTH_LABELS[options.health],
      options.progress !== undefined ? `${clampPercent(options.progress)}% complete` : ''
    ])
  };
}

export const projectStatus = defineComponent<ProjectStatusOptions>('prebuilt.projectStatus', renderProjectStatus);
