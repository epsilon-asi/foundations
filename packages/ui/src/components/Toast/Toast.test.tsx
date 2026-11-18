import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { Toast } from './Toast';

afterEach(() => vi.useRealTimers());
it('reports timeout without mutating controlled open and restarts timing for a new message ID', () => {
  vi.useFakeTimers(); const close = vi.fn();
  const { rerender } = renderWithUi(<Toast open message="Saved" messageId="one" autoHideDuration={1000} onClose={close} />);
  act(() => vi.advanceTimersByTime(600)); rerender(<Toast open message="Updated" messageId="two" autoHideDuration={1000} onClose={close} />);
  act(() => vi.advanceTimersByTime(600)); expect(close).not.toHaveBeenCalled(); act(() => vi.advanceTimersByTime(400));
  expect(close).toHaveBeenCalledExactlyOnceWith(null, 'timeout'); expect(screen.getByRole('status')).toHaveTextContent('Updated');
});
it.each(['hover', 'focus'])('pauses auto-hide during %s and resumes afterwards', (mode) => {
  vi.useFakeTimers(); const close = vi.fn(); renderWithUi(<Toast open message="Saved" autoHideDuration={1000} onClose={close} />);
  const surface = screen.getByRole('status'); act(() => vi.advanceTimersByTime(500));
  if (mode === 'hover') fireEvent.mouseEnter(surface); else fireEvent.focus(screen.getByRole('button', { name: 'Close notification' }));
  act(() => vi.advanceTimersByTime(2000)); expect(close).not.toHaveBeenCalled();
  if (mode === 'hover') fireEvent.mouseLeave(surface); else fireEvent.blur(screen.getByRole('button', { name: 'Close notification' }));
  act(() => vi.advanceTimersByTime(500)); expect(close).toHaveBeenCalledWith(null, 'timeout');
});
it('supports persistent notifications, explicit close and Escape dismissal', () => {
  vi.useFakeTimers(); const close = vi.fn(); renderWithUi(<Toast open message="Review required" severity="warning" autoHideDuration={null} onClose={close} />);
  act(() => vi.advanceTimersByTime(10000)); expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Close notification' })); expect(close).toHaveBeenLastCalledWith(expect.anything(), 'closeButtonClick');
  fireEvent.keyDown(document, { key: 'Escape' }); expect(close).toHaveBeenLastCalledWith(expect.anything(), 'escapeKeyDown');
});
it('ignores click-away by default and allows opting into it', () => {
  vi.useFakeTimers(); const close = vi.fn(); const { rerender } = renderWithUi(<Toast open message="Saved" onClose={close} />);
  act(() => vi.advanceTimersByTime(1)); fireEvent.click(document.body); expect(close).not.toHaveBeenCalled();
  rerender(<Toast open message="Saved" onClose={close} dismissOnClickAway />); fireEvent.click(document.body); expect(close).toHaveBeenCalledWith(expect.anything(), 'clickaway');
});
