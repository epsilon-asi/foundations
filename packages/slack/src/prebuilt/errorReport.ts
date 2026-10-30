import { actions, fieldSections, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { Primitive, Severity, SlackBlock } from '../types/slack';
import { slugify } from '../utils/ids';
import { compactJoin, truncate } from '../utils/text';
import { titleWithTone } from './status';
import { toButtons, toFields, type ActionDefinition, type FieldDefinition } from './shared';

export type ErrorLevel = 'warning' | 'error' | 'fatal';

const LEVEL_SEVERITY: Record<ErrorLevel, Severity> = {
  warning: 'warning',
  error: 'danger',
  fatal: 'danger'
};

export interface ErrorReportOptions {
  title: string;
  service: string;
  message: string;
  environment?: string;
  level?: ErrorLevel;
  stackTrace?: string;
  maxStackLines?: number;
  occurrences?: Primitive;
  usersAffected?: Primitive;
  firstSeen?: string;
  lastSeen?: string;
  assignee?: string;
  url?: string;
  issueId?: string;
  actions?: ActionDefinition[];
}

function codeBlock(text: string): string {
  return ['```', text.replace(/```/g, "'''"), '```'].join('\n');
}

function renderErrorReport(options: ErrorReportOptions): RenderedComponent {
  const level = options.level ?? 'error';
  const where = options.environment ? `${options.service} (${options.environment})` : options.service;
  const blocks: SlackBlock[] = [
    header(titleWithTone(options.title, LEVEL_SEVERITY[level])),
    section(`*${where}* · ${level.toUpperCase()}\n${codeBlock(truncate(options.message, 500))}`)
  ];

  if (options.stackTrace) {
    const lines = options.stackTrace.split('\n');
    const maxLines = options.maxStackLines ?? 12;
    const shown = lines.slice(0, maxLines).join('\n');
    const more = lines.length > maxLines ? `\n… ${lines.length - maxLines} more line${lines.length - maxLines === 1 ? '' : 's'}` : '';
    blocks.push(section(`*Stack trace*\n${codeBlock(truncate(`${shown}${more}`, 2_400))}`));
  }

  const fields: FieldDefinition[] = [];
  if (options.occurrences !== undefined) fields.push({ label: 'Occurrences', value: options.occurrences });
  if (options.usersAffected !== undefined) fields.push({ label: 'Users affected', value: options.usersAffected });
  if (options.firstSeen) fields.push({ label: 'First seen', value: options.firstSeen });
  if (options.lastSeen) fields.push({ label: 'Last seen', value: options.lastSeen });
  if (options.assignee) fields.push({ label: 'Assignee', value: options.assignee });
  if (fields.length) {
    blocks.push(...fieldSections(toFields(fields)));
  }

  const prefix = slugify(options.issueId ?? options.title, 'error');
  const value = options.issueId ?? prefix;
  const buttons: ActionDefinition[] = [];
  if (options.url) buttons.push({ text: 'View issue', url: options.url, actionId: `${prefix}_view` });
  if (!options.assignee) buttons.push({ text: 'Assign to me', actionId: `${prefix}_assign`, value });
  buttons.push({ text: 'Resolve', style: 'primary', actionId: `${prefix}_resolve`, value });
  buttons.push(...(options.actions ?? []));
  blocks.push(actions(toButtons(buttons)));

  return {
    blocks,
    fallbackText: compactJoin([`${level.toUpperCase()}: ${options.title}`, where, truncate(options.message, 200)])
  };
}

export const errorReport = defineComponent<ErrorReportOptions>('prebuilt.errorReport', renderErrorReport);
