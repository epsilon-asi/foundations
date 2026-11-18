import { createRef } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { Breadcrumbs } from './Breadcrumbs';

it('uses native links, keyboard actions, disabled text and a noninteractive current page', async () => {
  const action = vi.fn(); const disabled = vi.fn(); const current = vi.fn();
  renderWithUi(<Breadcrumbs items={[{ id: 'home', label: 'Home', href: '#home' }, { id: 'action', label: 'Assets', onClick: action },
    { id: 'disabled', label: 'Archived', href: '#archive', disabled: true, onClick: disabled }, { id: 'current', label: 'Forest', href: '#forest', onClick: current }]} />);
  expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '#home');
  screen.getByRole('button', { name: 'Assets' }).focus(); await userEvent.keyboard('{Enter}');
  expect(action).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('Archived')); fireEvent.click(screen.getByText('Forest'));
  expect(disabled).not.toHaveBeenCalled(); expect(current).not.toHaveBeenCalled();
  expect(screen.getByText('Archived')).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByText('Forest')).toHaveAttribute('aria-current', 'page');
});
it('forwards link-renderer props and callbacks, refs and custom styles', () => {
  const clicked = vi.fn((event) => event.preventDefault()); const ref = createRef<HTMLElement>();
  renderWithUi(<Breadcrumbs ref={ref} sx={{ padding: '6px' }} renderLink={(props) => <a {...props} data-custom="true" />}
    items={[{ id: 'home', label: 'Home', href: '/home', onClick: clicked }, { id: 'page', label: 'Page' }]} />);
  const link = screen.getByRole('link');
  fireEvent.click(link); expect(clicked).toHaveBeenCalledTimes(1);
  expect(link).toHaveAttribute('data-custom', 'true'); expect(link).toHaveAttribute('id');
  expect(ref.current).toBe(screen.getByRole('navigation')); expect(ref.current).toHaveStyle({ padding: '6px' });
});
it('omits empty trails and supports collapsing and expanding a long trail', async () => {
  const { rerender } = renderWithUi(<Breadcrumbs items={[]} />);
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  rerender(<Breadcrumbs maxItems={3} items={Array.from({ length: 6 }, (_, id) => ({ id: `${id}`, label: `Page ${id}`, href: `#${id}` }))} />);
  expect(screen.queryByRole('link', { name: 'Page 2' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Show path' }));
  expect(screen.getByRole('link', { name: 'Page 2' })).toBeInTheDocument();
});
