import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { ContextMenu } from './ContextMenu';

const items = [{ id: 'open', label: 'Open' }, { id: 'delete', label: 'Delete', disabled: true }, { id: 'copy', label: 'Copy' }];
it('opens at a pointer position, skips disabled items, reports callbacks and restores focus', async () => {
  const itemClick = vi.fn(); const localClick = vi.fn(); const close = vi.fn();
  renderWithUi(<ContextMenu aria-label="Asset" data-testid="region" items={[{ ...items[0], onClick: localClick }, ...items.slice(1)]} onItemClick={itemClick} onClose={close} menuProps={{ transitionDuration: 0 }}>Asset preview</ContextMenu>);
  const region = screen.getByTestId('region'); fireEvent.contextMenu(region, { clientX: 20, clientY: 30 });
  expect(screen.getByRole('menu', { name: 'Asset' })).toBeVisible(); expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Open' }), { key: 'ArrowDown' });
  expect(screen.getByRole('menuitem', { name: 'Copy' })).toHaveFocus();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' })); expect(itemClick).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Open' }));
  expect(localClick).toHaveBeenCalledTimes(1); expect(itemClick).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledWith('itemClick');
  await waitFor(() => expect(region).toHaveFocus());
});
it.each([{ key: 'F10', shiftKey: true }, { key: 'ContextMenu' }])('opens from the keyboard with %s and dismisses with Escape', async key => {
  renderWithUi(<ContextMenu data-testid="region" aria-label="Layer" items={items} menuProps={{ transitionDuration: 0 }}><button>Layer content</button></ContextMenu>);
  const child = screen.getByRole('button'); child.focus(); fireEvent.keyDown(child, key);
  fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Open' }), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument()); expect(child).toHaveFocus();
});
it('honors disabled and prevented trigger events', () => {
  const { rerender } = renderWithUi(<ContextMenu data-testid="region" items={items} disabled>Region</ContextMenu>);
  fireEvent.contextMenu(screen.getByTestId('region')); expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  rerender(<ContextMenu data-testid="region" items={items} onContextMenu={event => event.preventDefault()}>Region</ContextMenu>);
  fireEvent.contextMenu(screen.getByTestId('region')); expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
it('reports Tab dismissal and restores the context region', async () => {
  const close = vi.fn(); renderWithUi(<ContextMenu data-testid="region" items={items} onClose={close} menuProps={{ transitionDuration: 0 }}>Region</ContextMenu>);
  fireEvent.contextMenu(screen.getByTestId('region')); fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Open' }), { key: 'Tab' });
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument()); expect(close).toHaveBeenCalledWith('tabKeyDown');
  expect(screen.getByTestId('region')).toHaveFocus();
});
it('supports selection without dismissal and closes when disabled while open', async () => {
  const change = vi.fn(); const { rerender } = renderWithUi(<ContextMenu data-testid="region" items={items} onOpenChange={change} menuProps={{ transitionDuration: 0, closeOnClick: false }}>Region</ContextMenu>);
  fireEvent.contextMenu(screen.getByTestId('region')); fireEvent.click(screen.getByRole('menuitem', { name: 'Open' }));
  expect(screen.getByRole('menu')).toBeVisible();
  rerender(<ContextMenu data-testid="region" items={items} disabled onOpenChange={change} menuProps={{ transitionDuration: 0 }}>Region</ContextMenu>);
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument()); expect(change).toHaveBeenLastCalledWith(false);
});
