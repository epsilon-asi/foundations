import type { Severity } from '../types/slack';
import { card } from './card';
import { clampPercent, formatMoney, type ActionDefinition, type FieldDefinition } from './shared';

export type DealOutcome = 'open' | 'won' | 'lost';

const DEAL_OUTCOME: Record<DealOutcome, { prefix: string; severity: Severity }> = {
  open: { prefix: 'Deal update', severity: 'info' },
  won: { prefix: 'Deal won', severity: 'success' },
  lost: { prefix: 'Deal lost', severity: 'danger' }
};

export interface DealUpdateOptions {
  dealName: string;
  account: string;
  amount: number;
  stage: string;
  outcome?: DealOutcome;
  currency?: string;
  owner?: string;
  closeDate?: string;
  probability?: number;
  nextStep?: string;
  note?: string;
  url?: string;
  actions?: ActionDefinition[];
}

export function dealUpdate(options: DealUpdateOptions) {
  const outcome = DEAL_OUTCOME[options.outcome ?? 'open'];
  const fields: FieldDefinition[] = [
    { label: 'Account', value: options.account },
    { label: 'Amount', value: formatMoney(options.amount, options.currency) },
    { label: 'Stage', value: options.stage }
  ];
  if (options.probability !== undefined) fields.push({ label: 'Probability', value: `${clampPercent(options.probability)}%` });
  if (options.owner) fields.push({ label: 'Owner', value: options.owner });
  if (options.closeDate) fields.push({ label: 'Close date', value: options.closeDate });
  if (options.nextStep) fields.push({ label: 'Next step', value: options.nextStep });

  const actions: ActionDefinition[] = [...(options.actions ?? [])];
  if (options.url) {
    actions.unshift({ text: 'Open in CRM', url: options.url, actionId: 'open_deal' });
  }

  return card({
    title: `${outcome.prefix}: ${options.dealName}`,
    body: options.note,
    severity: outcome.severity,
    fields,
    actions
  });
}
