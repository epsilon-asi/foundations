import { expect, it } from 'vitest';
import { enumOptionMessageKey } from '../../src/i18n/fieldMessageKeys.js';

it('derives the default label key for an Offering status', () => {
  expect(enumOptionMessageKey({ resource: 'Offering', field: 'status', value: 'DRAFT' }))
    .toBe('offering.status.DRAFT');
});

it('preserves the model field name and the exact string enum value', () => {
  enum KeyState { Pending = 'pendingReview' }
  expect(enumOptionMessageKey({ resource: 'ApiKey', field: 'approvalState', value: KeyState.Pending }))
    .toBe('apiKey.approvalState.pendingReview');
});

it('uses the stored value of a numeric enum', () => {
  enum Priority { Low, High }
  expect(enumOptionMessageKey({ resource: 'Task', field: 'priority', value: Priority.Low }))
    .toBe('task.priority.0');
});
