import { createRef } from 'react';
import { screen, within } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { GradientStepper } from './GradientStepper';

const steps = [{ id: 'gather', title: 'Gather' }, { id: 'review', title: 'Review' }, { id: 'finish', title: 'Finish' }];

describe('GradientStepper', () => {
  it('renders ordered steps with current and completed semantics', () => {
    renderWithUi(<GradientStepper steps={steps} activeStep={1} aria-label="Review progress" />);
    expect(screen.getByRole('list', { name: 'Review progress' }).tagName).toBe('OL');
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Completed: Gather');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[2]).toHaveTextContent('Upcoming: Finish');
  });

  it('renders custom icons and updates them when steps complete', () => {
    const customSteps = [{ id: 'idea', title: 'Idea', icon: <span data-testid="idea-icon">★</span> }, ...steps];
    const { rerender } = renderWithUi(<GradientStepper steps={customSteps} activeStep={0} />);
    expect(screen.getByTestId('idea-icon')).toBeInTheDocument();
    rerender(<GradientStepper steps={customSteps} activeStep={1} />);
    expect(screen.queryByTestId('idea-icon')).not.toBeInTheDocument();
    expect(within(screen.getAllByRole('listitem')[0]).getByText('Completed:')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step');
  });

  it('handles empty, inactive and fully completed step collections', () => {
    const { rerender } = renderWithUi(<GradientStepper steps={[]} />);
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    rerender(<GradientStepper steps={steps} activeStep={-1} />);
    expect(screen.getAllByRole('listitem').every((item) => !item.hasAttribute('aria-current'))).toBe(true);
    rerender(<GradientStepper steps={steps} activeStep={steps.length} />);
    expect(screen.getAllByText('Completed:')).toHaveLength(3);
  });

  it('supports vertical presentation, refs and sx overrides', () => {
    const ref = createRef<HTMLOListElement>();
    renderWithUi(<GradientStepper ref={ref} steps={steps} orientation="vertical" aria-label="Progress"
      sx={(theme) => ({ padding: `${theme.shape.borderRadius}px` })} />);
    expect(ref.current).toBe(screen.getByRole('list', { name: 'Progress' }));
    expect(ref.current).toHaveStyle({ padding: '14px' });
  });

  it('does not announce earlier steps as completed in non-linear mode', () => {
    renderWithUi(<GradientStepper steps={steps} activeStep={1} nonLinear />);
    expect(screen.queryByText('Completed:')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step');
  });
});
