import { defaultUiTheme } from '../../theme';
import { createRef } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { ActionButton } from '../ActionButton';
import { DialogCard } from './DialogCard';

describe('DialogCard', () => {
  it('renders its heading, subtitle, message, icon and children', () => {
    renderWithUi(
      <DialogCard
        title="Report ready"
        subtitle="Your export is complete."
        message="The report includes the last 30 days."
        icon={<svg role="img" aria-label="Success" />}
      >
        <a href="/reports/latest">Download report</a>
      </DialogCard>
    );

    expect(screen.getByRole('heading', { name: 'Report ready', level: 2 })).toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByText('Your export is complete.')).toBeInTheDocument();
    expect(screen.getByText('The report includes the last 30 days.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Success' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download report' })).toHaveAttribute('href', '/reports/latest');
  });

  it('leaves modal behavior to the consumer', () => {
    renderWithUi(<DialogCard>Confirmation details</DialogCard>);

    expect(screen.getByText('Confirmation details')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders action slots without taking ownership of their state', () => {
    const onContinue = vi.fn();
    const onCancel = vi.fn();
    renderWithUi(
      <DialogCard
        title="Continue?"
        actions={[
          <ActionButton key="cancel" onClick={onCancel}>Cancel</ActionButton>,
          <ActionButton key="continue" loading onClick={onContinue}>Continue</ActionButton>
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it.each([['xs', '444px'], ['sm', '600px']] as const)(
    'applies the %s width and can remove the width limit',
    (maxWidth, expectedWidth) => {
      const { rerender } = renderWithUi(<DialogCard maxWidth={maxWidth} data-testid="card" />);
      expect(screen.getByTestId('card')).toHaveStyle({ maxWidth: expectedWidth });

      rerender(<DialogCard maxWidth={false} data-testid="card" />);
      expect(screen.getByTestId('card')).toHaveStyle({ maxWidth: 'none' });
    }
  );

  it('forwards root props and refs, allowing sx to override defaults', () => {
    const ref = createRef<HTMLDivElement>();
    renderWithUi(
      <DialogCard
        ref={ref}
        aria-label="Confirmation card"
        sx={[{ padding: '1px' }, (theme) => ({ padding: `${theme.shape.borderRadius}px` })]}
      />
    );

    expect(ref.current).toBe(screen.getByLabelText('Confirmation card'));
    expect(ref.current).toHaveStyle({ padding: `${defaultUiTheme.shape.borderRadius}px` });
  });
});
