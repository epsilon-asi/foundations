import { actions, fieldSections, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { SlackBlock } from '../types/slack';
import { compactJoin } from '../utils/text';
import { clampPercent, progressBar, toButtons, toFields, type ActionDefinition, type FieldDefinition } from './shared';

export interface TrainingAssignmentOptions {
  course: string;
  courseUrl: string;
  description?: string;
  dueDate?: string;
  duration?: string;
  required?: boolean;
  assignedBy?: string;
  progress?: number;
  actions?: ActionDefinition[];
}

function renderTrainingAssignment(options: TrainingAssignmentOptions): RenderedComponent {
  const blocks: SlackBlock[] = [header(`🎓 ${options.course}`)];

  if (options.description) {
    blocks.push(section(options.description));
  }

  const started = options.progress !== undefined && options.progress > 0;
  if (options.progress !== undefined) {
    const percent = clampPercent(options.progress);
    blocks.push(section(`${progressBar(percent)} ${percent}% complete`));
  }

  const fields: FieldDefinition[] = [];
  if (options.dueDate) fields.push({ label: 'Due', value: options.dueDate });
  if (options.duration) fields.push({ label: 'Duration', value: options.duration });
  if (options.required !== undefined) fields.push({ label: 'Required', value: options.required });
  if (options.assignedBy) fields.push({ label: 'Assigned by', value: options.assignedBy });
  if (fields.length) {
    blocks.push(...fieldSections(toFields(fields)));
  }

  blocks.push(
    actions(
      toButtons([
        { text: started ? 'Continue course' : 'Start course', url: options.courseUrl, style: 'primary', actionId: 'open_course' },
        ...(options.actions ?? [])
      ])
    )
  );

  return {
    blocks,
    fallbackText: compactJoin([`Training assigned: ${options.course}`, options.dueDate ? `Due ${options.dueDate}` : ''])
  };
}

export const trainingAssignment = defineComponent<TrainingAssignmentOptions>('prebuilt.trainingAssignment', renderTrainingAssignment);
