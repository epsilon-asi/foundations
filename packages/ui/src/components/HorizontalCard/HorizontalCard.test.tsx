import { defaultUiTheme } from '../../theme';
import { createRef } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { ActionButton } from '../ActionButton';
import { HorizontalCard } from './HorizontalCard';

describe('HorizontalCard', () => {
  it('renders its heading, subtitle and content', () => {
    renderWithUi(
      <HorizontalCard title="Workspace" subtitle="Details shared with your team.">
        <p>Epsilon research</p>
      </HorizontalCard>
    );

    expect(screen.getByRole('heading', { name: 'Workspace', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Details shared with your team.')).toBeInTheDocument();
    expect(screen.getByText('Epsilon research')).toBeInTheDocument();
  });

  it('accepts custom heading, subtitle and action nodes', () => {
    const onClick = vi.fn();
    renderWithUi(
      <HorizontalCard
        title={<h3>Team</h3>}
        subtitle={<a href="/team">View members</a>}
        action={<ActionButton onClick={onClick}>Manage</ActionButton>}
      >
        12 members
      </HorizontalCard>
    );

    expect(screen.getByRole('heading', { name: 'Team', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View members' })).toHaveAttribute('href', '/team');
    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('updates displayed content when props change', () => {
    const { rerender } = renderWithUi(<HorizontalCard title="Before">Old details</HorizontalCard>);

    rerender(<HorizontalCard title="After">New details</HorizontalCard>);

    expect(screen.getByRole('heading', { name: 'After' })).toBeInTheDocument();
    expect(screen.getByText('New details')).toBeInTheDocument();
    expect(screen.queryByText('Old details')).not.toBeInTheDocument();
  });

  it('provides a transparent variant without a card surface', () => {
    renderWithUi(<HorizontalCard title="Summary" variant="transparent" data-testid="card" />);

    expect(screen.getByTestId('card')).toHaveStyle({
      'background-color': 'rgba(0, 0, 0, 0)',
      'border-style': 'none',
      'box-shadow': 'none'
    });
  });

  it('forwards card props and its ref, and composes sx arrays in order', () => {
    const ref = createRef<HTMLDivElement>();
    renderWithUi(
      <HorizontalCard
        ref={ref}
        title="Summary"
        aria-label="Project summary"
        sx={[{ padding: '3px' }, (theme) => ({ padding: `${theme.shape.borderRadius}px` })]}
      />
    );

    const card = screen.getByLabelText('Project summary');
    expect(ref.current).toBe(card);
    expect(card).toHaveStyle({ padding: `${defaultUiTheme.shape.borderRadius}px` });
  });
});
