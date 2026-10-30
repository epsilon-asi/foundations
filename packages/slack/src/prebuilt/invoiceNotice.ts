import type { Severity } from '../types/slack';
import { slugify } from '../utils/ids';
import { card } from './card';
import { formatMoney, type ActionDefinition, type FieldDefinition } from './shared';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';

const INVOICE_STATUS: Record<InvoiceStatus, { label: string; severity: Severity }> = {
  draft: { label: 'Draft', severity: 'neutral' },
  sent: { label: 'Sent', severity: 'info' },
  paid: { label: 'Paid', severity: 'success' },
  overdue: { label: 'Overdue', severity: 'danger' },
  void: { label: 'Void', severity: 'neutral' }
};

export interface InvoiceNoticeOptions {
  invoiceNumber: string;
  customer: string;
  amount: number;
  status: InvoiceStatus;
  currency?: string;
  issuedAt?: string;
  dueDate?: string;
  paidAt?: string;
  url?: string;
  payUrl?: string;
  actions?: ActionDefinition[];
}

export function invoiceNotice(options: InvoiceNoticeOptions) {
  const selected = INVOICE_STATUS[options.status];
  const fields: FieldDefinition[] = [
    { label: 'Customer', value: options.customer },
    { label: 'Amount', value: formatMoney(options.amount, options.currency) },
    { label: 'Status', value: selected.label }
  ];
  if (options.issuedAt) fields.push({ label: 'Issued', value: options.issuedAt });
  if (options.dueDate) fields.push({ label: 'Due', value: options.dueDate });
  if (options.paidAt) fields.push({ label: 'Paid', value: options.paidAt });

  const prefix = slugify(options.invoiceNumber, 'invoice');
  const actions: ActionDefinition[] = [];
  const payable = options.status === 'sent' || options.status === 'overdue';
  if (payable && options.payUrl) actions.push({ text: 'Pay now', url: options.payUrl, style: 'primary', actionId: `${prefix}_pay` });
  if (options.url) actions.push({ text: 'View invoice', url: options.url, actionId: `${prefix}_view` });
  if (options.status === 'overdue') actions.push({ text: 'Send reminder', actionId: `${prefix}_remind`, value: options.invoiceNumber });
  actions.push(...(options.actions ?? []));

  return card({
    title: `Invoice ${options.invoiceNumber} · ${selected.label}`,
    severity: selected.severity,
    fields,
    actions
  });
}
