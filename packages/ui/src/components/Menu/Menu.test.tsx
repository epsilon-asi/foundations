import { fireEvent, screen } from '@testing-library/react';
import { mockMenuAnchorLayout } from '../../test/menuTriggerContract';
import { renderWithUi } from '../../test/renderWithUi';
import { Menu } from './Menu';

describe('Menu', () => {
  let anchor: HTMLButtonElement;
  beforeEach(() => {
    mockMenuAnchorLayout();
    anchor = document.createElement('button');
    anchor.textContent = 'Anchor';
    document.body.append(anchor);
  });
  afterEach(() => { anchor.remove(); vi.restoreAllMocks(); });

  it('is controlled and reports selection without changing open state itself', () => {
    const onClose = vi.fn();
    const { rerender } = renderWithUi(<Menu anchorEl={anchor} open items={[{ id: 'open', label: 'Open' }]}
      onClose={onClose} transitionDuration={0} slotProps={{ list: { 'aria-label': 'Item actions' } }} />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open' }));
    expect(onClose).toHaveBeenCalledWith('itemClick');
    expect(screen.getByRole('menu', { name: 'Item actions' })).toBeInTheDocument();
    rerender(<Menu anchorEl={anchor} open={false} items={[]} transitionDuration={0} />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('can notify selection while keeping the menu open', () => {
    const onClose = vi.fn();
    const onItemClick = vi.fn();
    renderWithUi(<Menu anchorEl={anchor} open closeOnClick={false} items={[{ id: 'pin', label: 'Pin' }]}
      onClose={onClose} onItemClick={onItemClick} transitionDuration={0} />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pin' }));
    expect(onItemClick).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('focuses an empty menu rather than leaving focus outside the overlay', () => {
    renderWithUi(<Menu anchorEl={anchor} open header="No actions available" items={[]} transitionDuration={0} />);
    expect(screen.getByText('No actions available')).toBeInTheDocument();
    expect(screen.getByRole('menu')).toHaveFocus();
  });

  it('supports functional list slot props and item style overrides', () => {
    renderWithUi(<Menu anchorEl={anchor} open items={[{ id: 'open', label: 'Open', sx: { padding: '12px' } }]}
      slotProps={{ list: () => ({ 'aria-label': 'Custom actions' }) }} transitionDuration={0} />);
    expect(screen.getByRole('menu', { name: 'Custom actions' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveStyle({ padding: '12px' });
  });
});
