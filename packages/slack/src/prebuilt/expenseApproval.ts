import { slackLink } from '../utils/text';
import { approvalRequest } from './approvalRequest';
import { formatMoney, type FieldDefinition } from './shared';

export interface ExpenseApprovalOptions {
  employee: string;
  amount: number;
  category: string;
  description: string;
  currency?: string;
  merchant?: string;
  expenseDate?: string;
  costCenter?: string;
  receiptUrl?: string;
  reportId?: string;
}

export function expenseApproval(options: ExpenseApprovalOptions) {
  const fields: FieldDefinition[] = [
    { label: 'Amount', value: formatMoney(options.amount, options.currency) },
    { label: 'Category', value: options.category }
  ];
  if (options.merchant) fields.push({ label: 'Merchant', value: options.merchant });
  if (options.expenseDate) fields.push({ label: 'Date', value: options.expenseDate });
  if (options.costCenter) fields.push({ label: 'Cost center', value: options.costCenter });
  if (options.receiptUrl) fields.push({ label: 'Receipt', value: slackLink(options.receiptUrl, 'View receipt') });

  return approvalRequest({
    title: `Expense: ${formatMoney(options.amount, options.currency)} · ${options.category}`,
    requester: options.employee,
    reason: options.description,
    approveActionId: 'approve_expense',
    rejectActionId: 'reject_expense',
    approveValue: options.reportId,
    rejectValue: options.reportId,
    fields
  });
}
