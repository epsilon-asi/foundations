import { createRef } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { NavigationList, type NavigationItem } from './NavigationList';

const items: NavigationItem[] = [
  { id: 'home', label: 'Home', href: '#home' },
  { id: 'library', label: 'Library', children: [{ id: 'assets', label: 'Assets', href: '#assets' }, { id: 'archive', label: 'Archived', disabled: true }] },
  { id: 'reports', label: 'Reports', href: '#reports', children: [{ id: 'weekly', label: 'Weekly', href: '#weekly' }] },
  { id: 'admin', label: 'Administration', disabled: true, disabledReason: 'Owner access required', href: '#admin' },
  { id: 'section', kind: 'section', label: 'Account', children: [{ id: 'settings', label: 'Settings' }] }
];
it('uses native navigation links, preserves callbacks and separates branch selection from expansion', async () => {
  const select = vi.fn(); const expand = vi.fn();
  renderWithUi(<NavigationList items={items} value="home" onSelect={select} onExpandedChange={expand} />);
  expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  await userEvent.click(screen.getByRole('button', { name: 'Library' }));
  expect(screen.getByRole('link', { name: 'Assets' })).toBeVisible(); expect(select).not.toHaveBeenCalled();
  expect(expand).toHaveBeenLastCalledWith(['library'], expect.anything());
  await userEvent.click(screen.getByRole('button', { name: 'Expand Reports' })); expect(select).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('link', { name: 'Weekly' }));
  expect(select).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'weekly' }), expect.anything());
  expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
});
it('runs item callbacks before selection and supports cancellation and custom router links', () => {
  const calls: string[] = []; const select = vi.fn(() => calls.push('select'));
  renderWithUi(<NavigationList renderLink={(props) => <a {...props} data-custom="yes" />} onSelect={select} items={[
    { id: 'a', label: 'Allowed', href: '#a', onClick: () => calls.push('item') },
    { id: 'b', label: 'Cancelled', href: '/b', onClick: (event) => { event.preventDefault(); calls.push('cancel'); } }
  ]} />);
  fireEvent.click(screen.getByRole('link', { name: 'Allowed' })); expect(calls).toEqual(['item', 'select']);
  fireEvent.click(screen.getByRole('link', { name: 'Cancelled' })); expect(select).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link', { name: 'Allowed' })).toHaveAttribute('data-custom', 'yes');
});
it('blocks disabled links, actions and descendants, including global disabling', async () => {
  const clicked = vi.fn(); const select = vi.fn();
  const disabledItems: NavigationItem[] = [{ id: 'disabled', label: 'Disabled group', disabled: true, href: '#x', onClick: clicked,
    children: [{ id: 'child', label: 'Child', onClick: clicked }] }, { id: 'ok', label: 'Available', onClick: clicked }];
  const { rerender } = renderWithUi(<NavigationList items={disabledItems} defaultExpandedIds={['disabled']} onSelect={select} />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.getByText('Disabled group').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByRole('button', { name: 'Child' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Collapse Disabled group' })).toBeDisabled();
  fireEvent.click(screen.getByText('Disabled group')); fireEvent.click(screen.getByRole('button', { name: 'Child' }));
  expect(clicked).not.toHaveBeenCalled(); expect(select).not.toHaveBeenCalled();
  await userEvent.tab(); expect(screen.getByRole('button', { name: 'Available' })).toHaveFocus();
  rerender(<NavigationList items={disabledItems} disabled onSelect={select} />);
  expect(screen.getByRole('button', { name: 'Available' })).toBeDisabled();
});
it('moves focus among visible enabled rows with arrows, Home/End and typeahead', async () => {
  renderWithUi(<NavigationList items={items} />);
  screen.getByRole('link', { name: 'Home' }).focus();
  await userEvent.keyboard('{ArrowDown}'); expect(screen.getByRole('button', { name: 'Library' })).toHaveFocus();
  await userEvent.keyboard('{ArrowRight}'); expect(screen.getByRole('button', { name: 'Library' })).toHaveAttribute('aria-expanded', 'true');
  await userEvent.keyboard('{ArrowRight}'); expect(screen.getByRole('link', { name: 'Assets' })).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}'); expect(screen.getByRole('link', { name: 'Reports' })).toHaveFocus();
  await userEvent.keyboard('{End}'); expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus();
  await userEvent.keyboard('{Home}'); expect(screen.getByRole('link', { name: 'Home' })).toHaveFocus();
  await userEvent.keyboard('s'); expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}'); expect(screen.getByRole('link', { name: 'Home' })).toHaveFocus();
});
it('mirrors branch arrows in RTL and supports native Enter and Space activation', async () => {
  const select = vi.fn();
  renderWithUi(<NavigationList dir="rtl" items={items} onSelect={select} />);
  screen.getByRole('button', { name: 'Library' }).focus();
  await userEvent.keyboard('{ArrowLeft}{ArrowLeft}'); expect(screen.getByRole('link', { name: 'Assets' })).toHaveFocus();
  await userEvent.keyboard('{ArrowRight}'); expect(screen.getByRole('button', { name: 'Library' })).toHaveFocus();
  await userEvent.keyboard('{ArrowRight}'); expect(screen.getByRole('button', { name: 'Library' })).toHaveAttribute('aria-expanded', 'false');
  await userEvent.keyboard(' '); expect(screen.getByRole('button', { name: 'Library' })).toHaveAttribute('aria-expanded', 'true');
  screen.getByRole('button', { name: 'Settings' }).focus(); await userEvent.keyboard('{Enter}');
  expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: 'settings' }), expect.anything());
});
it('reveals selected ancestors without overriding controlled expansion or stealing focus', () => {
  const expand = vi.fn();
  const { rerender } = renderWithUi(<NavigationList items={items} value="assets" />);
  expect(screen.getByRole('link', { name: 'Assets' })).toBeVisible();
  screen.getByRole('link', { name: 'Home' }).focus();
  rerender(<NavigationList items={items} value="weekly" />);
  expect(screen.getByRole('link', { name: 'Weekly' })).toBeVisible(); expect(screen.getByRole('link', { name: 'Home' })).toHaveFocus();
  rerender(<NavigationList items={items} expandedIds={[]} onExpandedChange={expand} value="assets" />);
  fireEvent.click(screen.getByRole('button', { name: 'Library' }));
  expect(expand).toHaveBeenLastCalledWith(['library'], expect.anything());
  expect(screen.queryByRole('link', { name: 'Assets' })).not.toBeInTheDocument();
});
it('restores focus when a branch hides, an item is removed or all items become unavailable', () => {
  const { rerender } = renderWithUi(<NavigationList items={items} expandedIds={['library']} />);
  act(() => screen.getByRole('link', { name: 'Assets' }).focus());
  rerender(<NavigationList items={items} expandedIds={[]} />);
  expect(screen.getByRole('button', { name: 'Library' })).toHaveFocus();
  rerender(<NavigationList items={items.filter((item) => item.id !== 'library')} />);
  expect(screen.getByRole('link', { name: 'Home' })).toHaveFocus();
  rerender(<NavigationList items={items} disabled />); expect(screen.getByRole('navigation')).toHaveFocus();
});
it('forwards native events, refs, root styles and empty state', () => {
  const ref = createRef<HTMLElement>(); const key = vi.fn((event) => event.preventDefault());
  const { rerender } = renderWithUi(<NavigationList ref={ref} items={items} onKeyDown={key} sx={{ padding: '5px' }} />);
  screen.getByRole('link', { name: 'Home' }).focus(); fireEvent.keyDown(screen.getByRole('link', { name: 'Home' }), { key: 'ArrowDown' });
  expect(key).toHaveBeenCalledTimes(1); expect(screen.getByRole('link', { name: 'Home' })).toHaveFocus();
  expect(ref.current).toBe(screen.getByRole('navigation')); expect(ref.current).toHaveStyle({ padding: '5px' });
  rerender(<NavigationList items={[]} emptyState="No destinations" />); expect(screen.getByText('No destinations')).toBeInTheDocument();
});
