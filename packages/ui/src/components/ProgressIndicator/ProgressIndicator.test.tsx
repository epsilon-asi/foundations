import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { ProgressIndicator } from './ProgressIndicator';

it('exposes determinate progress with an accessible label, status and custom value text', () => {
  const { rerender } = renderWithUi(<ProgressIndicator label="Export" value={35} status="7 of 20 images" valueText="7 of 20" />);
  const progress = screen.getByRole('progressbar', { name: 'Export' });
  expect(progress).toHaveAttribute('aria-valuenow', '35'); expect(progress).toHaveAttribute('aria-valuetext', '7 of 20');
  expect(progress).toHaveAccessibleDescription('7 of 20 images');
  rerender(<ProgressIndicator label="Export" value={100} status="Complete" />);
  expect(progress).toHaveAttribute('aria-valuenow', '100'); expect(progress).toHaveAccessibleDescription('Complete');
});
it.each([undefined, NaN, Infinity])('uses indeterminate progress for %s', value => {
  renderWithUi(<ProgressIndicator label="Preparing" value={value} />);
  expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
});
it('clamps bounds and delegates cancellation without changing the task state', () => {
  const cancel = vi.fn(); const { rerender } = renderWithUi(<ProgressIndicator label="Upload" value={150} onCancel={cancel} />);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(cancel).toHaveBeenCalledTimes(1);
  rerender(<ProgressIndicator label="Upload" value={-20} onCancel={cancel} cancelDisabled cancelLabel="Stopping" />);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0'); expect(screen.getByRole('button')).toBeDisabled();
});
