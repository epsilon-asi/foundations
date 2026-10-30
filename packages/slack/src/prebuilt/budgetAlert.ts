import type { Severity } from '../types/slack';
import { card } from './card';
import { formatMoney, progressBar, type ActionDefinition, type FieldDefinition } from './shared';

export interface BudgetAlertOptions {
  budgetName: string;
  spent: number;
  budget: number;
  currency?: string;
  period?: string;
  forecast?: number;
  owner?: string;
  warningThreshold?: number;
  url?: string;
  actions?: ActionDefinition[];
}

export function budgetAlert(options: BudgetAlertOptions) {
  const percent = options.budget > 0 ? Math.round((options.spent / options.budget) * 100) : 100;
  const threshold = options.warningThreshold ?? 80;
  const severity: Severity = percent >= 100 ? 'danger' : percent >= threshold ? 'warning' : 'success';
  const title =
    severity === 'danger'
      ? `${options.budgetName} is over budget`
      : severity === 'warning'
        ? `${options.budgetName} at ${percent}% of budget`
        : `${options.budgetName} is on track`;

  const remaining = options.budget - options.spent;
  const fields: FieldDefinition[] = [
    { label: 'Spent', value: formatMoney(options.spent, options.currency) },
    { label: 'Budget', value: formatMoney(options.budget, options.currency) },
    { label: remaining >= 0 ? 'Remaining' : 'Over by', value: formatMoney(Math.abs(remaining), options.currency) }
  ];
  if (options.forecast !== undefined) fields.push({ label: 'Forecast', value: formatMoney(options.forecast, options.currency) });
  if (options.period) fields.push({ label: 'Period', value: options.period });
  if (options.owner) fields.push({ label: 'Owner', value: options.owner });

  const actions: ActionDefinition[] = [...(options.actions ?? [])];
  if (options.url) {
    actions.unshift({ text: 'View spend report', url: options.url, actionId: 'view_budget' });
  }

  return card({
    title,
    body: `${progressBar(percent)} ${percent}% used`,
    severity,
    fields,
    actions
  });
}
