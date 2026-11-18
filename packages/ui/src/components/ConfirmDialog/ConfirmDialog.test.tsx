import { fireEvent, screen } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { ConfirmDialog } from './ConfirmDialog';

it('starts on cancel and forwards confirmation and cancellation exactly once', async () => {
  const onConfirm = vi.fn(); const onClose = vi.fn();
  renderWithUi(<ConfirmDialog open title="Discard asset?" description="This removes the working copy." destructive
    confirmLabel="Discard" onConfirm={onConfirm} onClose={onClose} transitionDuration={0} />);
  expect(screen.getByRole('alertdialog', { name: 'Discard asset?' })).toHaveAccessibleDescription('This removes the working copy.');
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onConfirm).toHaveBeenCalledWith(expect.anything());
  expect(onClose).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalledWith(expect.anything(), 'cancelButtonClick');
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
});

it('blocks all actions and dismissal while busy', async () => {
  const onConfirm = vi.fn(); const onClose = vi.fn();
  renderWithUi(<ConfirmDialog open title="Send" busy busyLabel="Sending…" onConfirm={onConfirm} onClose={onClose} transitionDuration={0} />);
  for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Sending…' }));
  await userEvent.keyboard('{Escape}');
  expect(onConfirm).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
});

it('keeps errors visible and allows cancellation when confirmation is unavailable', async () => {
  const onConfirm = vi.fn(); const onClose = vi.fn();
  const { rerender } = renderWithUi(<ConfirmDialog open title="Confirm" error="The estimate changed." confirmDisabled
    onConfirm={onConfirm} onClose={onClose} transitionDuration={0}><p>Review the new estimate.</p></ConfirmDialog>);
  expect(screen.getByRole('alert')).toHaveTextContent('The estimate changed.');
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  rerender(<ConfirmDialog open title="Confirm" onConfirm={onConfirm} onClose={onClose} transitionDuration={0} />);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
});
