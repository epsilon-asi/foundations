import { createRef } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { VirtualList, type VirtualListHandle } from './VirtualList';

const items = Array.from({ length: 10000 }, (_, index) => ({ id: String(index), label: `Row ${index}` }));
const getItemKey = (item: typeof items[number]) => item.id; const renderItem = (item: typeof items[number]) => item.label;
const row = (text: string) => screen.getByText(text, { exact: true }).closest('li')!;
afterEach(() => { vi.unstubAllGlobals(); });
it('renders a bounded range with full-list positions and updates it when scrolled', () => {
  renderWithUi(<VirtualList aria-label="Rows" items={items} getItemKey={getItemKey} renderItem={renderItem} itemHeight={32} height={160} overscan={2} />);
  expect(screen.getAllByRole('listitem')).toHaveLength(7); expect(row('Row 0')).toHaveAttribute('aria-setsize', '10000');
  fireEvent.scroll(screen.getByRole('region', { name: 'Rows' }), { target: { scrollTop: 3200 } });
  expect(screen.queryByText('Row 0', { exact: true })).not.toBeInTheDocument(); expect(row('Row 100')).toHaveAttribute('aria-posinset', '101'); expect(screen.getAllByRole('listitem')).toHaveLength(9);
  expect(screen.getAllByRole('listitem').filter(node => node.tabIndex === 0)).toHaveLength(1);
});
it('navigates to unmounted rows, skips disabled items, supports paging and activates the focused row', () => {
  const activate = vi.fn(); renderWithUi(<VirtualList aria-label="Rows" items={items} getItemKey={getItemKey} renderItem={renderItem} height={160} itemHeight={32}
    isItemDisabled={item => item.id === '1'} onItemActivate={activate} />);
  row('Row 0').focus(); fireEvent.keyDown(row('Row 0'), { key: 'ArrowDown' }); expect(row('Row 2')).toHaveFocus();
  fireEvent.keyDown(row('Row 2'), { key: 'End' }); expect(row('Row 9999')).toHaveFocus();
  fireEvent.keyDown(row('Row 9999'), { key: 'Home' }); expect(row('Row 0')).toHaveFocus();
  fireEvent.keyDown(row('Row 0'), { key: 'PageDown' }); expect(row('Row 6')).toHaveFocus();
  fireEvent.keyDown(row('Row 6'), { key: 'Enter' }); expect(activate).toHaveBeenCalledWith(items[6], 6);
});
it('pins a focused row and its child input during manual scrolling without hijacking input arrows', () => {
  renderWithUi(<VirtualList aria-label="Rows" items={items} getItemKey={getItemKey} renderItem={item => item.id === '0' ? <input aria-label="Row editor" /> : item.label} height={160} overscan={0} />);
  const input = screen.getByRole('textbox'); input.focus(); fireEvent.scroll(screen.getByRole('region'), { target: { scrollTop: 3200 } });
  expect(input).toHaveFocus(); expect(input).toBeInTheDocument(); expect(screen.getAllByRole('listitem')).toHaveLength(6);
  fireEvent.keyDown(input, { key: 'End' }); expect(input).toHaveFocus(); expect(screen.queryByText('Row 9999')).not.toBeInTheDocument();
});
it('restores focus after the focused item is removed and clamps a now-invalid scroll position', () => {
  const ref = createRef<VirtualListHandle>(); const { rerender } = renderWithUi(<VirtualList ref={ref} aria-label="Rows" items={items} getItemKey={getItemKey} renderItem={renderItem} height={160} />);
  act(() => ref.current!.focusIndex(9999)); expect(row('Row 9999')).toHaveFocus();
  rerender(<VirtualList ref={ref} aria-label="Rows" items={items.slice(0, 4)} getItemKey={getItemKey} renderItem={renderItem} height={160} />);
  expect(row('Row 3')).toHaveFocus(); expect(screen.getByRole('region').scrollTop).toBe(0);
});
it('preserves the focused item by stable key during reorder and provides imperative scrolling', () => {
  const ref = createRef<VirtualListHandle>(); const { rerender } = renderWithUi(<VirtualList ref={ref} aria-label="Rows" items={items} getItemKey={getItemKey} renderItem={renderItem} height={160} />);
  row('Row 0').focus(); rerender(<VirtualList ref={ref} aria-label="Rows" items={[...items.slice(1), items[0]]} getItemKey={getItemKey} renderItem={renderItem} height={160} />);
  expect(row('Row 0')).toHaveFocus(); expect(row('Row 0')).toHaveAttribute('aria-posinset', '10000');
  act(() => ref.current!.scrollToIndex(500, 'center')); expect(screen.getByText('Row 501', { exact: true })).toBeInTheDocument(); expect(row('Row 0')).toHaveFocus();
});
it('supports empty/all-disabled states and ignores prevented navigation', () => {
  const { rerender } = renderWithUi(<VirtualList aria-label="Rows" items={[]} getItemKey={getItemKey} renderItem={renderItem} />);
  expect(screen.getByText('No items')).toBeVisible(); expect(screen.getByRole('region')).toHaveAttribute('tabindex', '0');
  rerender(<VirtualList aria-label="Rows" items={items.slice(0, 2)} getItemKey={getItemKey} renderItem={renderItem} isItemDisabled={() => true} />);
  expect(screen.getAllByRole('listitem').every(node => node.tabIndex === -1)).toBe(true);
  rerender(<VirtualList aria-label="Rows" items={items} getItemKey={getItemKey} renderItem={renderItem} onKeyDown={event => event.preventDefault()} />);
  row('Row 0').focus(); fireEvent.keyDown(row('Row 0'), { key: 'End' }); expect(row('Row 0')).toHaveFocus();
});
it('releases a pinned editor when focus leaves the list', () => {
  renderWithUi(<><VirtualList aria-label="Rows" items={items} getItemKey={getItemKey} height={160} overscan={0}
    renderItem={item => item.id === '0' ? <input aria-label="Editor" /> : item.label} /><button>Outside</button></>);
  screen.getByRole('textbox').focus(); fireEvent.scroll(screen.getByRole('region'), { target: { scrollTop: 3200 } });
  act(() => { screen.getByRole('button', { name: 'Outside' }).focus(); }); expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(5);
});
it('responds to viewport resizing and disconnects its observer on unmount', () => {
  let resized!: () => void; const disconnect = vi.fn(); vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resized = callback; } observe() {} disconnect = disconnect; });
  const ref = createRef<VirtualListHandle>(); const { unmount } = renderWithUi(<VirtualList ref={ref} aria-label="Rows" items={items} getItemKey={getItemKey} renderItem={renderItem} height={160} overscan={0} />);
  expect(screen.getAllByRole('listitem')).toHaveLength(5);
  Object.defineProperty(ref.current!.element!, 'clientHeight', { configurable: true, value: 320 }); act(() => resized());
  expect(screen.getAllByRole('listitem')).toHaveLength(10); unmount(); expect(disconnect).toHaveBeenCalledTimes(1);
});
it('does not recapture a connected editor after focus is intentionally cleared', () => {
  renderWithUi(<VirtualList aria-label="Rows" items={items} getItemKey={getItemKey} height={160} overscan={0} renderItem={item => item.id === '0' ? <input aria-label="Editor" /> : item.label} />);
  const input = screen.getByRole('textbox'); input.focus(); fireEvent.blur(input, { relatedTarget: null });
  fireEvent.scroll(screen.getByRole('region'), { target: { scrollTop: 3200 } }); expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
