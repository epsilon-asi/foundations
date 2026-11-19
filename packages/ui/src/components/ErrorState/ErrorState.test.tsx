import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { ErrorState } from './ErrorState';

it('renders recovery actions and reveals details without stealing focus', () => {
  renderWithUi(<><button>Elsewhere</button><ErrorState title="Export failed" description="The destination could not be reached." details="Error E123" actions={<button>Choose destination</button>} /></>);
  screen.getByRole('button', { name: 'Elsewhere' }).focus(); expect(screen.getByRole('alert')).toHaveTextContent('Export failed');
  expect(screen.queryByText('Error E123')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Error details' })); expect(screen.getByText('Error E123')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Choose destination' })).toBeVisible();
});
it('awaits retry, blocks duplicate submissions and leaves recovery state caller-owned', async () => {
  let resolve!: () => void; const retry = vi.fn(() => new Promise<void>(done => { resolve = done; }));
  renderWithUi(<ErrorState title="Export failed" onRetry={retry} />);
  fireEvent.click(screen.getByRole('button', { name: 'Try again' })); fireEvent.click(screen.getByRole('button'));
  expect(retry).toHaveBeenCalledTimes(1); expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled();
  await act(async () => resolve()); expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled(); expect(screen.getByText('Export failed')).toBeVisible();
});
it('handles retry rejection, exposes failure feedback and permits a further retry', async () => {
  const error = new Error('offline'); const failed = vi.fn(); const retry = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);
  renderWithUi(<ErrorState title="Failed" onRetry={retry} onRetryError={failed} />);
  fireEvent.click(screen.getByRole('button', { name: 'Try again' })); await waitFor(() => expect(failed).toHaveBeenCalledWith(error));
  expect(screen.getByRole('status')).toHaveTextContent('Retry failed'); fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument()); expect(retry).toHaveBeenCalledTimes(2);
});
it('supports external retrying and disabled states', () => {
  const retry = vi.fn(); const { rerender } = renderWithUi(<ErrorState title="Failed" onRetry={retry} retrying />);
  expect(screen.getByRole('button')).toBeDisabled(); rerender(<ErrorState title="Failed" onRetry={retry} retryDisabled />);
  fireEvent.click(screen.getByRole('button')); expect(retry).not.toHaveBeenCalled();
});
