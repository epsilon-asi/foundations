import { actions, context, fieldSections, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { SlackBlock } from '../types/slack';
import { compactJoin, slackLink, truncate } from '../utils/text';
import { toButtons, toFields, type ActionDefinition, type FieldDefinition } from './shared';

export type PullRequestState = 'open' | 'draft' | 'approved' | 'changes_requested' | 'merged' | 'closed';

export const PULL_REQUEST_STATE_LABELS: Record<PullRequestState, string> = {
  open: '🟢 Open',
  draft: '⚪ Draft',
  approved: '✅ Approved',
  changes_requested: '🟠 Changes requested',
  merged: '🟣 Merged',
  closed: '🔴 Closed'
};

export interface PullRequestOptions {
  repository: string;
  number: number;
  title: string;
  author: string;
  url: string;
  state?: PullRequestState;
  description?: string;
  reviewers?: string[];
  additions?: number;
  deletions?: number;
  filesChanged?: number;
  baseBranch?: string;
  headBranch?: string;
  labels?: string[];
  actions?: ActionDefinition[];
}

function renderPullRequest(options: PullRequestOptions): RenderedComponent {
  const state = options.state ?? 'open';
  const text = [`*${slackLink(options.url, options.title)}*`, options.description ? truncate(options.description, 600) : '']
    .filter(Boolean)
    .join('\n');
  const blocks: SlackBlock[] = [header(`🔀 ${options.repository} #${options.number}`), section(text)];

  const fields: FieldDefinition[] = [
    { label: 'Author', value: options.author },
    { label: 'State', value: PULL_REQUEST_STATE_LABELS[state] }
  ];
  if (options.reviewers?.length) fields.push({ label: 'Reviewers', value: options.reviewers.join(', ') });
  if (options.additions !== undefined || options.deletions !== undefined) {
    const files = options.filesChanged !== undefined ? ` in ${options.filesChanged} file${options.filesChanged === 1 ? '' : 's'}` : '';
    fields.push({ label: 'Changes', value: `+${options.additions ?? 0} / −${options.deletions ?? 0}${files}` });
  }
  if (options.headBranch && options.baseBranch) {
    fields.push({ label: 'Branch', value: `\`${options.headBranch}\` → \`${options.baseBranch}\`` });
  }
  blocks.push(...fieldSections(toFields(fields)));

  if (options.labels?.length) {
    blocks.push(context([`🏷️ ${options.labels.join(' · ')}`]));
  }

  const reviewable = state === 'open' || state === 'changes_requested' || state === 'approved';
  blocks.push(
    actions(
      toButtons([
        { text: reviewable ? 'Review' : 'View', url: options.url, actionId: 'open_pull_request', ...(reviewable ? { style: 'primary' as const } : {}) },
        ...(options.actions ?? [])
      ])
    )
  );

  return {
    blocks,
    fallbackText: `${options.repository}#${options.number}: ${options.title} (${PULL_REQUEST_STATE_LABELS[state]}) by ${options.author}`
  };
}

export const pullRequest = defineComponent<PullRequestOptions>('prebuilt.pullRequest', renderPullRequest);
