import { card } from './card';
import type { ActionDefinition, FieldDefinition } from './shared';

export interface ApprovalRequestOptions {
  title: string;
  requester: string;
  reason: string;
  approveActionId?: string;
  rejectActionId?: string;
  approveUrl?: string;
  rejectUrl?: string;
  approveValue?: string;
  rejectValue?: string;
  fields?: FieldDefinition[];
}

export function approvalRequest(options: ApprovalRequestOptions) {
  const actions: ActionDefinition[] = [
    {
      text: 'Approve',
      style: 'primary',
      actionId: options.approveActionId ?? 'approve_request',
      url: options.approveUrl,
      value: options.approveValue ?? 'approve'
    },
    {
      text: 'Reject',
      style: 'danger',
      actionId: options.rejectActionId ?? 'reject_request',
      url: options.rejectUrl,
      value: options.rejectValue ?? 'reject'
    }
  ];

  return card({
    title: options.title,
    body: options.reason,
    severity: 'info',
    fields: [{ label: 'Requester', value: options.requester }, ...(options.fields ?? [])],
    actions
  });
}
