import { createRef } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { Alert } from './Alert';
import { ActionButton } from '../ActionButton';

it('uses polite status for informational feedback and alert for urgent errors', () => {
  const { rerender } = renderWithUi(<Alert title="Saved" severity="success">Changes were saved.</Alert>);
  expect(screen.getByRole('status')).toHaveTextContent('SavedChanges were saved.');
  rerender(<Alert severity="error">Could not save.</Alert>); expect(screen.getByRole('alert')).toHaveTextContent('Could not save.');
});
it('preserves independent action/dismissal callbacks, native props, refs and style overrides', () => {
  const close = vi.fn(); const action = vi.fn(); const ref = createRef<HTMLDivElement>();
  renderWithUi(<Alert ref={ref} data-testid="alert" onClose={close} action={<ActionButton onClick={action}>Retry</ActionButton>} sx={{ margin: '7px' }}>Failed</Alert>);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' })); expect(action).toHaveBeenCalledTimes(1); expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Close alert' })); expect(close).toHaveBeenCalledTimes(1);
  expect(ref.current).toBe(screen.getByTestId('alert')); expect(ref.current).toHaveStyle({ margin: '7px' });
});
