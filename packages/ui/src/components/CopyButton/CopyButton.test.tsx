import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { CopyButton, CopyableValue } from './CopyButton';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('copies the exact value, reports success accessibly and resets feedback', async () => {
  vi.useFakeTimers(); const copy = vi.fn().mockResolvedValue(undefined); const copied = vi.fn();
  renderWithUi(<CopyButton value={'  asset\n'} copy={copy} onCopied={copied} resetAfter={1000} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy value' })); });
  expect(copy).toHaveBeenCalledWith('  asset\n'); expect(copied).toHaveBeenCalledWith('  asset\n'); expect(screen.getByRole('status')).toHaveTextContent('Copied');
  act(() => { vi.advanceTimersByTime(1000); }); expect(screen.getByRole('status')).toBeEmptyDOMElement();
});
it('catches clipboard rejection and allows retry without claiming success', async () => {
  const failure = new Error('Permission denied'); const copy = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined); const error = vi.fn(); const success = vi.fn();
  renderWithUi(<CopyButton value="asset" copy={copy} onCopyError={error} onCopied={success} />);
  fireEvent.click(screen.getByRole('button')); await waitFor(() => expect(error).toHaveBeenCalledWith(failure));
  expect(screen.getByRole('status')).toHaveTextContent('Unable to copy'); expect(success).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button')); await waitFor(() => expect(success).toHaveBeenCalledWith('asset'));
});
it('handles an unavailable browser clipboard without throwing', async () => {
  vi.stubGlobal('navigator', {}); const error = vi.fn(); renderWithUi(<CopyButton value="asset" onCopyError={error} />);
  fireEvent.click(screen.getByRole('button')); await waitFor(() => expect(error).toHaveBeenCalledWith(expect.any(Error)));
});
it('uses the browser clipboard by default', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined); vi.stubGlobal('navigator', { clipboard: { writeText } });
  renderWithUi(<CopyButton value="asset" />); fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('asset'));
});
it('guards pending requests, disabled clicks and stale completions after value changes', async () => {
  let resolve!: () => void; const copy = vi.fn(() => new Promise<void>(done => { resolve = done; })); const copied = vi.fn();
  const { rerender } = renderWithUi(<CopyButton value="old" copy={copy} onCopied={copied} />);
  fireEvent.click(screen.getByRole('button')); fireEvent.click(screen.getByRole('button')); expect(copy).toHaveBeenCalledTimes(1); expect(screen.getByRole('button')).toBeDisabled();
  rerender(<CopyButton value="new" copy={copy} onCopied={copied} disabled />);
  await act(async () => resolve()); expect(copied).not.toHaveBeenCalled(); expect(screen.getByRole('status')).toBeEmptyDOMElement();
  fireEvent.click(screen.getByRole('button')); expect(copy).toHaveBeenCalledTimes(1);
});
it('does not deliver callbacks after unmounting', async () => {
  let resolve!: () => void; const copied = vi.fn(); const { unmount } = renderWithUi(<CopyButton value="asset" onCopied={copied} copy={() => new Promise<void>(done => { resolve = done; })} />);
  fireEvent.click(screen.getByRole('button')); unmount(); await act(async () => resolve()); expect(copied).not.toHaveBeenCalled();
});
it('copies the underlying value when the displayed value differs', async () => {
  const copy = vi.fn().mockResolvedValue(undefined); renderWithUi(<CopyableValue value="asset_123456789" displayValue="asset_123…" label="Asset identifier" copyButtonProps={{ copy, 'aria-label': 'Copy asset ID' }} />);
  expect(screen.getByText('asset_123…')).toBeVisible(); fireEvent.click(screen.getByRole('button', { name: 'Copy asset ID' }));
  await waitFor(() => expect(copy).toHaveBeenCalledWith('asset_123456789'));
});
