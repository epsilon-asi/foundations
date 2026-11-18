import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { AssetCard, AssetGrid } from './AssetCard';
const items = [{ id: 'a', title: 'Coast' }, { id: 'b', title: 'Locked', disabled: true }, { id: 'c', title: 'Forest' }];

it('separates selection, open and custom actions into sibling controls', () => {
  const select = vi.fn(); const open = vi.fn(); const action = vi.fn();
  renderWithUi(<AssetCard title="Coast" description="1024 × 1024" onSelect={select} onOpen={open} actions={<button onClick={action}>Download</button>} />);
  fireEvent.click(screen.getByRole('button', { name: 'Coast' })); expect(select).toHaveBeenCalledTimes(1); expect(open).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Open Coast' })); fireEvent.click(screen.getByRole('button', { name: 'Download' }));
  expect(open).toHaveBeenCalledTimes(1); expect(action).toHaveBeenCalledTimes(1); expect(select).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Coast' }).querySelector('button')).toBeNull();
  expect(screen.getByRole('button', { name: 'Coast' })).toHaveAccessibleDescription('1024 × 1024');
});
it('supports single/multiple selection, disabled cards and keyboard focus navigation', () => {
  const change = vi.fn(); renderWithUi(<AssetGrid aria-label="Assets" items={items} multiSelect onSelectionChange={change} />);
  const coast = screen.getByRole('button', { name: 'Coast' }); const forest = screen.getByRole('button', { name: 'Forest' });
  fireEvent.click(coast); fireEvent.click(forest); expect(change).toHaveBeenLastCalledWith(['a', 'c'], items[2]);
  fireEvent.click(coast); expect(coast).toHaveAttribute('aria-pressed', 'false'); expect(forest).toHaveAttribute('aria-pressed', 'true');
  coast.focus(); fireEvent.keyDown(coast, { key: 'ArrowRight' }); expect(forest).toHaveFocus();
  fireEvent.keyDown(forest, { key: 'Home' }); expect(coast).toHaveFocus(); expect(screen.getByRole('button', { name: 'Locked' })).toBeDisabled();
});
it('disables custom native action controls as well as selection and open buttons', () => {
  renderWithUi(<AssetCard title="Locked" disabled onSelect={() => {}} onOpen={() => {}} actions={<button>Download</button>} />);
  expect(screen.getAllByRole('button').every(button => button.matches(':disabled'))).toBe(true);
});
it('keeps selection caller-owned when controlled and exposes empty and disabled states', () => {
  const change = vi.fn(); const { rerender } = renderWithUi(<AssetGrid aria-label="Assets" items={items} selectedIds={['a']} onSelectionChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: 'Forest' })); expect(change).toHaveBeenLastCalledWith(['c'], items[2]);
  expect(screen.getByRole('button', { name: 'Coast' })).toHaveAttribute('aria-pressed', 'true');
  rerender(<AssetGrid aria-label="Assets" items={items} disabled />); expect(screen.getAllByRole('button').every(button => button.hasAttribute('disabled'))).toBe(true);
  rerender(<AssetGrid aria-label="Assets" items={[]} />); expect(screen.getByText('No assets')).toBeVisible();
});
