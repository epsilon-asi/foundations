import { approvalRequest } from './approvalRequest';
import type { FieldDefinition } from './shared';

export interface TimeOffRequestOptions {
  employee: string;
  type: string;
  startDate: string;
  endDate: string;
  days?: number;
  balanceAfter?: string;
  coverage?: string;
  note?: string;
  requestId?: string;
}

export function timeOffRequest(options: TimeOffRequestOptions) {
  const fields: FieldDefinition[] = [
    { label: 'Type', value: options.type },
    { label: 'Dates', value: `${options.startDate} – ${options.endDate}` }
  ];
  if (options.days !== undefined) fields.push({ label: 'Days', value: options.days });
  if (options.balanceAfter) fields.push({ label: 'Balance after', value: options.balanceAfter });
  if (options.coverage) fields.push({ label: 'Coverage', value: options.coverage });

  return approvalRequest({
    title: `Time off: ${options.employee}`,
    requester: options.employee,
    reason: options.note ?? `${options.employee} requested ${options.type.toLowerCase()} from ${options.startDate} to ${options.endDate}.`,
    approveActionId: 'approve_time_off',
    rejectActionId: 'reject_time_off',
    approveValue: options.requestId,
    rejectValue: options.requestId,
    fields
  });
}
