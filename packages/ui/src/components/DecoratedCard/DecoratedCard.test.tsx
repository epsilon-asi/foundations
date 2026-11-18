import { defaultUiTheme } from '../../theme';
import { createRef } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { ActionButton } from '../ActionButton';
import { DecoratedCard } from './DecoratedCard';

describe('DecoratedCard', () => {
  it('renders a heading and content without requiring a graphic or actions', () => {
    renderWithUi(<DecoratedCard title="Research">Your latest findings.</DecoratedCard>);

    expect(screen.getByRole('heading', { name: 'Research', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Your latest findings.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('supports a content-only card', () => {
    renderWithUi(<DecoratedCard>Notes</DecoratedCard>);

    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('hides the decorative graphic from assistive technology and pointer interaction', () => {
    renderWithUi(
      <DecoratedCard graphic={<svg role="img" aria-label="Decoration" />}>
        Findings
      </DecoratedCard>
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { hidden: true }).parentElement).toHaveStyle({ pointerEvents: 'none' });
  });

  it('composes custom actions with their own disabled behavior', () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    renderWithUi(
      <DecoratedCard
        actions={[
          <ActionButton key="open" onClick={onOpen}>Open</ActionButton>,
          <ActionButton key="delete" disabled onClick={onDelete}>Delete</ActionButton>
        ]}
      >
        Findings
      </DecoratedCard>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('forwards root props and refs while independently styling the graphic', () => {
    const ref = createRef<HTMLDivElement>();
    renderWithUi(
      <DecoratedCard
        ref={ref}
        aria-label="Research card"
        sx={(theme) => ({ padding: `${theme.shape.borderRadius}px` })}
        graphic={<svg role="img" />}
        graphicSx={[{ opacity: 0.2 }, (theme) => ({ width: theme.breakpoints.values.sm / 10 })]}
      >
        Findings
      </DecoratedCard>
    );

    const card = screen.getByLabelText('Research card');
    expect(ref.current).toBe(card);
    expect(card).toHaveStyle({ padding: `${defaultUiTheme.shape.borderRadius}px` });
    expect(screen.getByRole('img', { hidden: true }).parentElement).toHaveStyle({ opacity: '0.2', width: '60px' });
  });
});
