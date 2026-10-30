import { card } from './card';
import type { ActionDefinition, FieldDefinition } from './shared';

export type HiringRecommendation = 'strong_yes' | 'yes' | 'no' | 'strong_no';

export const HIRING_RECOMMENDATION_LABELS: Record<HiringRecommendation, string> = {
  strong_yes: '💚 Strong yes',
  yes: '👍 Yes',
  no: '👎 No',
  strong_no: '⛔ Strong no'
};

export interface CandidateUpdateOptions {
  candidate: string;
  role: string;
  stage: string;
  recommendation?: HiringRecommendation;
  feedbackSummary?: string;
  nextStep?: string;
  interviewAt?: string;
  recruiter?: string;
  hiringManager?: string;
  profileUrl?: string;
  scorecardUrl?: string;
  actions?: ActionDefinition[];
}

export function candidateUpdate(options: CandidateUpdateOptions) {
  const fields: FieldDefinition[] = [{ label: 'Stage', value: options.stage }];
  if (options.recommendation) fields.push({ label: 'Recommendation', value: HIRING_RECOMMENDATION_LABELS[options.recommendation] });
  if (options.nextStep) fields.push({ label: 'Next step', value: options.nextStep });
  if (options.interviewAt) fields.push({ label: 'Interview', value: options.interviewAt });
  if (options.recruiter) fields.push({ label: 'Recruiter', value: options.recruiter });
  if (options.hiringManager) fields.push({ label: 'Hiring manager', value: options.hiringManager });

  const actions: ActionDefinition[] = [];
  if (options.profileUrl) actions.push({ text: 'View candidate', url: options.profileUrl, actionId: 'view_candidate' });
  if (options.scorecardUrl) actions.push({ text: 'Submit scorecard', url: options.scorecardUrl, style: 'primary', actionId: 'submit_scorecard' });
  actions.push(...(options.actions ?? []));

  return card({
    title: `${options.candidate} — ${options.role}`,
    body: options.feedbackSummary,
    severity: 'info',
    fields,
    actions
  });
}
