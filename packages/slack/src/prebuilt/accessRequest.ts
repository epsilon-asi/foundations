import { approvalRequest } from './approvalRequest';
import type { FieldDefinition } from './shared';

export interface AccessRequestOptions {
  requester: string;
  resource: string;
  accessLevel: string;
  justification: string;
  duration?: string;
  ticketId?: string;
  requestId?: string;
}

export function accessRequest(options: AccessRequestOptions) {
  const fields: FieldDefinition[] = [
    { label: 'Resource', value: options.resource },
    { label: 'Access level', value: options.accessLevel }
  ];
  if (options.duration) fields.push({ label: 'Duration', value: options.duration });
  if (options.ticketId) fields.push({ label: 'Ticket', value: options.ticketId });

  return approvalRequest({
    title: `Access request: ${options.resource}`,
    requester: options.requester,
    reason: options.justification,
    approveActionId: 'approve_access',
    rejectActionId: 'reject_access',
    approveValue: options.requestId,
    rejectValue: options.requestId,
    fields
  });
}
