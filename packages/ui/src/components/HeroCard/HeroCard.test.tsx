import { createRef } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { ActionButton } from '../ActionButton';
import { HeroCard } from './HeroCard';

describe('HeroCard', () => {
  it('renders the eyebrow, heading, rich content and actions', () => {
    const onClick = vi.fn();
    renderWithUi(<HeroCard title="Discover" header="Your next idea" content={<p>Explore your workspace.</p>}
      action={<ActionButton onClick={onClick}>Explore</ActionButton>} />);
    expect(screen.getByText('Discover')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your next idea', level: 2 })).toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByText('Explore your workspace.').tagName).toBe('P');
    fireEvent.click(screen.getByRole('button', { name: 'Explore' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('changes visual reading order when flipped', () => {
    const props = { title: 'Discover', header: 'Ideas', content: 'Notes', visual: <svg role="img" aria-label="Ideas visual" /> };
    const { rerender } = renderWithUi(<HeroCard {...props} />);
    const heading = screen.getByRole('heading', { name: 'Ideas' });
    const visual = screen.getByRole('img', { name: 'Ideas visual' });
    expect(heading.compareDocumentPosition(visual) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    rerender(<HeroCard {...props} flip />);
    expect(screen.getByRole('heading').compareDocumentPosition(screen.getByRole('img')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('supports omitted visuals/actions and additional children', () => {
    renderWithUi(<HeroCard title="Workspace" header="Welcome" content="Get started."><a href="/help">Read more</a></HeroCard>);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read more' })).toHaveAttribute('href', '/help');
  });

  it('forwards refs, root props and style overrides', () => {
    const ref = createRef<HTMLDivElement>();
    renderWithUi(<HeroCard ref={ref} title="Workspace" header="Welcome" content="Notes" aria-label="Welcome card"
      sx={[{ padding: '2px' }, { padding: '8px' }]} />);
    expect(ref.current).toBe(screen.getByLabelText('Welcome card'));
    expect(ref.current).toHaveStyle({ padding: '8px' });
  });
});
