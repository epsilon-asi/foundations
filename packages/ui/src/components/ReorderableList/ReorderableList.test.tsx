import { useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { ReorderableList } from './ReorderableList';

const items = [{ id: 'a', label: 'Sky' }, { id: 'locked', label: 'Locked' }, { id: 'b', label: 'Mountains' }, { id: 'c', label: 'Water' }];
const getItemId = (item: typeof items[number]) => item.id; const getItemLabel = (item: typeof items[number]) => item.label;
const locked = (item: typeof items[number]) => item.id === 'locked';
function Controlled({ changed = vi.fn() }) {
  const [order, setOrder] = useState(items); return <ReorderableList aria-label="Layers" items={order} getItemId={getItemId} getItemLabel={getItemLabel} isItemDisabled={locked}
    onReorder={(next, details) => { changed(next, details); setOrder(next); }} />;
}
const labels = () => screen.getAllByRole('listitem').map(row => row.textContent);
function mockRowLayout() { screen.getAllByRole('listitem').forEach((row, index) => vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 300, width: 300, top: index * 40, bottom: index * 40 + 40, height: 40, x: 0, y: index * 40, toJSON: () => ({}) })); }
function pointer(target: HTMLElement, type: string, x: number, y: number) { const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }); Object.defineProperty(event, 'pointerId', { value: 1 }); fireEvent(target, event); }
it('previews keyboard moves, preserves locked positions and commits once on drop with retained focus', () => {
  const changed = vi.fn(); renderWithUi(<Controlled changed={changed} />); const handle = screen.getByRole('button', { name: 'Reorder Sky' }); handle.focus();
  fireEvent.keyDown(handle, { key: ' ' }); fireEvent.keyDown(handle, { key: 'ArrowDown' }); expect(changed).not.toHaveBeenCalled();
  expect(labels()[1]).toContain('Locked'); expect(labels()[0]).toContain('Mountains');
  fireEvent.keyDown(handle, { key: 'Enter' }); expect(changed).toHaveBeenCalledTimes(1);
  expect(changed.mock.calls[0][0].map(getItemId)).toEqual(['b', 'locked', 'a', 'c']);
  expect(changed.mock.calls[0][1]).toEqual({ itemId: 'a', fromIndex: 0, toIndex: 2, method: 'keyboard' }); expect(handle).toHaveFocus();
});
it('cancels a keyboard preview with Escape or Tab without notifying the caller', () => {
  const changed = vi.fn(); renderWithUi(<Controlled changed={changed} />); const handle = screen.getByRole('button', { name: 'Reorder Sky' });
  for (const cancel of ['Escape', 'Tab']) { fireEvent.keyDown(handle, { key: ' ' }); fireEvent.keyDown(handle, { key: 'End' }); fireEvent.keyDown(handle, { key: cancel });
    expect(labels()[0]).toContain('Sky'); expect(handle).toHaveAttribute('aria-pressed', 'false'); }
  expect(changed).not.toHaveBeenCalled();
});
it('provides move buttons and ordinary handle focus navigation without picking up', () => {
  const changed = vi.fn(); renderWithUi(<Controlled changed={changed} />); const handle = screen.getByRole('button', { name: 'Reorder Sky' }); handle.focus();
  fireEvent.keyDown(handle, { key: 'ArrowDown' }); expect(screen.getByRole('button', { name: 'Reorder Mountains' })).toHaveFocus(); expect(changed).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Move Sky down' })); expect(changed).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'button', toIndex: 2 }));
  expect(screen.getByRole('button', { name: 'Reorder Locked' })).toBeDisabled();
});
it('supports pointer drops without reversing repeated moves or mutating the source array', () => {
  const changed = vi.fn(); renderWithUi(<Controlled changed={changed} />); mockRowLayout();
  const source = screen.getByRole('button', { name: 'Reorder Sky' });
  pointer(source, 'pointerdown', 20, 20); pointer(source, 'pointermove', 20, 140); pointer(source, 'pointermove', 20, 140);
  expect(labels()[0]).toContain('Sky'); // Pointer targets stay stable until drop.
  pointer(source, 'pointerup', 20, 140); fireEvent.click(source); // The trailing click must not begin a keyboard pickup.
  expect(changed).toHaveBeenCalledTimes(1); expect(changed.mock.calls[0][0].map(getItemId)).toEqual(['b', 'locked', 'c', 'a']);
  expect(changed.mock.calls[0][1]).toEqual({ itemId: 'a', fromIndex: 0, toIndex: 3, method: 'pointer' }); expect(items.map(getItemId)).toEqual(['a', 'locked', 'b', 'c']); expect(source).toHaveAttribute('aria-pressed', 'false');
});
it('ignores unstarted gestures, cancels interrupted drags and keeps ordering caller-owned', () => {
  const changed = vi.fn(); renderWithUi(<ReorderableList aria-label="Layers" items={items} getItemId={getItemId} getItemLabel={getItemLabel} onReorder={changed} />);
  mockRowLayout(); const source = screen.getByRole('button', { name: 'Reorder Sky' });
  pointer(source, 'pointermove', 20, 140); pointer(source, 'pointerup', 20, 140); expect(changed).not.toHaveBeenCalled();
  pointer(source, 'pointerdown', 20, 20); pointer(source, 'pointermove', 20, 140); pointer(source, 'pointercancel', 20, 140); expect(changed).not.toHaveBeenCalled();
  pointer(source, 'pointerdown', 20, 20); pointer(source, 'pointermove', 400, 300); pointer(source, 'pointerup', 400, 300); expect(changed).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Move Sky down' })); expect(changed).toHaveBeenCalledTimes(1); expect(labels()[0]).toContain('Sky');
});
it('cancels stale previews after external changes and supports disabled and empty states', () => {
  const changed = vi.fn(); const { rerender } = renderWithUi(<ReorderableList aria-label="Layers" items={items} getItemId={getItemId} getItemLabel={getItemLabel} onReorder={changed} />);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Sky' }), { key: ' ' });
  rerender(<ReorderableList aria-label="Layers" items={items.slice(1)} getItemId={getItemId} getItemLabel={getItemLabel} onReorder={changed} disabled />);
  expect(screen.getAllByRole('button').every(button => button.hasAttribute('disabled'))).toBe(true); expect(changed).not.toHaveBeenCalled();
  expect(screen.getByRole('list', { name: 'Layers' })).toHaveFocus();
  rerender(<ReorderableList aria-label="Layers" items={[]} getItemId={getItemId} getItemLabel={getItemLabel} onReorder={changed} />);
  expect(screen.getByText('No items to reorder')).toBeVisible();
});
