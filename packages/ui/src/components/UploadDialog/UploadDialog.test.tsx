import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { UploadDialog } from './UploadDialog';

const file = new File(['asset'], 'asset.txt', { type: 'text/plain', lastModified: 1 });
const picker = () => screen.getByLabelText('Choose files', { selector: 'input' }) as HTMLInputElement;
it('requires a selection and submits a file snapshot through the caller callback', async () => {
  const submit = vi.fn(); const success = vi.fn(); const close = vi.fn();
  renderWithUi(<UploadDialog open onSubmit={submit} onSubmitSuccess={success} onClose={close} transitionDuration={0} />);
  expect(screen.getByRole('button', { name: 'Upload files' })).toBeDisabled(); await userEvent.upload(picker(), file);
  await userEvent.click(screen.getByRole('button', { name: 'Upload files' })); await waitFor(() => expect(success).toHaveBeenCalledTimes(1));
  expect(submit).toHaveBeenCalledExactlyOnceWith([file]); expect(screen.getByRole('dialog')).toBeVisible(); expect(close).not.toHaveBeenCalled();
});
it('blocks duplicate submission, file mutation and all dismissal while submitting', async () => {
  let finish!: () => void; const promise = new Promise<void>((resolve) => { finish = resolve; }); const submit = vi.fn(() => promise); const close = vi.fn();
  renderWithUi(<UploadDialog open defaultFiles={[file]} onSubmit={submit} onClose={close} transitionDuration={0} />);
  fireEvent.click(screen.getByRole('button', { name: 'Upload files' })); fireEvent.click(screen.getByRole('button', { name: 'Upload files' }));
  expect(submit).toHaveBeenCalledTimes(1); expect(picker()).toBeDisabled(); expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');
  await userEvent.keyboard('{Escape}'); fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(close).not.toHaveBeenCalled();
  await act(async () => { finish(); await promise; }); expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
});
it('retains files and clears busy after rejection, allowing a successful retry', async () => {
  const failure = new Error('Connection unavailable'); const submit = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined); const error = vi.fn(); const success = vi.fn();
  renderWithUi(<UploadDialog open defaultFiles={[file]} onSubmit={submit} onSubmitError={error} onSubmitSuccess={success} transitionDuration={0} />);
  await userEvent.click(screen.getByRole('button', { name: 'Upload files' })); expect(await screen.findByRole('alert')).toHaveTextContent('Connection unavailable');
  expect(error).toHaveBeenCalledWith(failure); expect(screen.getByText('asset.txt')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Upload files' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: 'Upload files' })); await waitFor(() => expect(success).toHaveBeenCalledTimes(1)); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('reports cancel reasons and resets uncontrolled selection after the caller closes', async () => {
  const close = vi.fn(); const submit = vi.fn(); const { rerender } = renderWithUi(<UploadDialog open defaultFiles={[file]} onSubmit={submit} onClose={close} transitionDuration={0} />);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(close).toHaveBeenCalledWith(expect.anything(), 'cancelButtonClick');
  expect(screen.getByText('asset.txt')).toBeInTheDocument(); rerender(<UploadDialog open={false} onSubmit={submit} onClose={close} transitionDuration={0} />);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); rerender(<UploadDialog open onSubmit={submit} onClose={close} transitionDuration={0} />);
  expect(screen.queryByText('asset.txt')).not.toBeInTheDocument();
});
it('ignores stale completion after closing/reopening and preserves the new selection', async () => {
  let finish!: () => void; const promise = new Promise<void>((resolve) => { finish = resolve; }); const submit = vi.fn(() => promise); const success = vi.fn();
  const { rerender } = renderWithUi(<UploadDialog open defaultFiles={[file]} onSubmit={submit} onSubmitSuccess={success} transitionDuration={0} />);
  await userEvent.click(screen.getByRole('button', { name: 'Upload files' }));
  rerender(<UploadDialog open={false} onSubmit={submit} onSubmitSuccess={success} transitionDuration={0} />);
  rerender(<UploadDialog open onSubmit={submit} onSubmitSuccess={success} transitionDuration={0} />);
  const next = new File(['new'], 'new.txt'); await userEvent.upload(picker(), next);
  await act(async () => { finish(); await promise; }); expect(success).not.toHaveBeenCalled(); expect(screen.getByText('new.txt')).toBeVisible();
});
