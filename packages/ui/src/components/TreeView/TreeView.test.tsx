import { createRef } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { UiProvider } from '../../theme';
import { TreeView, type TreeItemDefinition } from './TreeView';

const items: TreeItemDefinition[] = [
  { id: 'background', label: 'Background' },
  { id: 'folder', label: 'Characters', description: '2 layers', children: [{ id: 'locked', label: 'Locked', disabled: true }, { id: 'hero', label: 'Hero' }] },
  { id: 'off', label: 'Unavailable', disabled: true, children: [{ id: 'off-child', label: 'Disabled child' }] },
  { id: 'props', label: 'Props' }
];
const node = (name: string) => screen.getByRole('treeitem', { name });
it('uses roving focus, expands with arrows, skips disabled nodes and navigates back to parents', () => {
  renderWithUi(<TreeView aria-label="Layers" items={items} />);
  node('Background').focus(); fireEvent.keyDown(node('Background'), { key: 'ArrowDown' }); expect(node('Characters')).toHaveFocus();
  expect(node('Characters')).toHaveAccessibleDescription('2 layers');
  fireEvent.keyDown(node('Characters'), { key: 'ArrowRight' }); expect(node('Characters')).toHaveAttribute('aria-expanded', 'true');
  fireEvent.keyDown(node('Characters'), { key: 'ArrowRight' }); expect(node('Hero')).toHaveFocus();
  fireEvent.keyDown(node('Hero'), { key: 'ArrowLeft' }); expect(node('Characters')).toHaveFocus();
  fireEvent.keyDown(node('Characters'), { key: 'ArrowLeft' }); expect(screen.queryByRole('treeitem', { name: 'Hero' })).not.toBeInTheDocument();
  fireEvent.keyDown(node('Characters'), { key: 'End' }); expect(node('Props')).toHaveFocus();
  fireEvent.keyDown(node('Props'), { key: 'Home' }); expect(node('Background')).toHaveFocus();
  expect(screen.getAllByRole('treeitem').filter(item => item.tabIndex === 0)).toHaveLength(1);
});
it('supports typeahead, activation, toggle selection and selecting all enabled visible nodes', () => {
  const change = vi.fn(); const activate = vi.fn();
  renderWithUi(<TreeView aria-label="Layers" items={items} multiSelect defaultExpandedIds={['folder', 'off']} onSelectionChange={change} onItemActivate={activate} />);
  node('Background').focus(); fireEvent.keyDown(node('Background'), { key: 'h' }); expect(node('Hero')).toHaveFocus();
  fireEvent.keyDown(node('Hero'), { key: ' ' }); expect(node('Hero')).toHaveAttribute('aria-selected', 'true');
  fireEvent.keyDown(node('Hero'), { key: ' ' }); expect(node('Hero')).toHaveAttribute('aria-selected', 'false');
  fireEvent.keyDown(node('Hero'), { key: 'a', ctrlKey: true }); expect(change).toHaveBeenLastCalledWith(['background', 'folder', 'hero', 'props'], expect.anything());
  fireEvent.keyDown(node('Hero'), { key: 'Enter' }); expect(activate).toHaveBeenCalledWith(expect.objectContaining({ id: 'hero' }));
  fireEvent.click(screen.getByText('Disabled child')); expect(change).toHaveBeenCalledTimes(4);
});
it('reports controlled expansion and selection without changing caller state', () => {
  const expanded = vi.fn(); const selected = vi.fn(); const { rerender } = renderWithUi(<TreeView aria-label="Layers" items={items} expandedIds={[]} selectedIds={[]} onExpandedChange={expanded} onSelectionChange={selected} />);
  fireEvent.keyDown(node('Characters'), { key: 'ArrowRight' }); expect(expanded).toHaveBeenCalledWith(['folder']); expect(node('Characters')).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(screen.getByText('Background')); expect(selected).toHaveBeenCalledWith(['background'], expect.anything()); expect(node('Background')).toHaveAttribute('aria-selected', 'false');
  rerender(<TreeView aria-label="Layers" items={items} expandedIds={['folder']} selectedIds={['hero']} />);
  expect(node('Hero')).toHaveAttribute('aria-selected', 'true');
});
it('restores focus to the nearest available ancestor after a controlled collapse', () => {
  const { rerender } = renderWithUi(<TreeView aria-label="Layers" items={items} expandedIds={['folder']} />);
  node('Hero').focus(); rerender(<TreeView aria-label="Layers" items={items} expandedIds={[]} />);
  expect(node('Characters')).toHaveFocus();
});
it('uses RTL expansion keys and respects a prevented keyboard event', () => {
  renderWithUi(<UiProvider themeOptions={{ direction: 'rtl' }}><TreeView aria-label="Layers" items={items} onKeyDown={event => { if (event.key === 'ArrowDown') event.preventDefault(); }} /></UiProvider>);
  node('Characters').focus(); fireEvent.keyDown(node('Characters'), { key: 'ArrowLeft' }); expect(node('Characters')).toHaveAttribute('aria-expanded', 'true');
  fireEvent.keyDown(node('Characters'), { key: 'ArrowDown' }); expect(node('Characters')).toHaveFocus();
});
it('handles empty and disabled trees with a focusable root and forwarded ref', () => {
  const ref = createRef<HTMLUListElement>(); const change = vi.fn();
  const { rerender } = renderWithUi(<TreeView ref={ref} aria-label="Layers" items={[]} />);
  expect(screen.getByRole('tree')).toBe(ref.current); expect(screen.getByText('No items')).toBeVisible(); expect(ref.current).toHaveAttribute('tabindex', '0');
  rerender(<TreeView aria-label="Layers" items={items} disabled onSelectionChange={change} />);
  fireEvent.click(screen.getByText('Background')); expect(change).not.toHaveBeenCalled();
});
it('delegates optional visibility changes without selecting or activating the row', () => {
  const visibility = vi.fn(); const selection = vi.fn();
  renderWithUi(<TreeView aria-label="Layers" items={[{ id: 'a', label: 'Sky', visible: true }]} onVisibilityChange={visibility} onSelectionChange={selection} />);
  const button = screen.getByRole('button', { name: 'Sky visibility' }); fireEvent.click(button);
  expect(visibility).toHaveBeenCalledWith(false, expect.objectContaining({ id: 'a' })); expect(selection).not.toHaveBeenCalled();
  expect(button).toHaveAttribute('aria-pressed', 'true'); button.focus(); fireEvent.keyDown(button, { key: 'Escape' }); expect(node('Sky')).toHaveFocus();
});
