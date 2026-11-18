import { createRef, useState } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { NavigationSidebar } from './NavigationSidebar';

const items = [{ id: 'assets', label: 'Assets', href: '#assets' }, { id: 'jobs', label: 'Jobs' }];
it('composes a docked Drawer and NavigationList with header/footer slots and native props', () => {
  const ref = createRef<HTMLDivElement>(); const select = vi.fn(); const close = vi.fn();
  renderWithUi(<NavigationSidebar ref={ref} data-testid="sidebar" items={items} value="assets" title="Studio" onSelect={select} onClose={close}
    header="Workspace A" footer={<button>Account</button>} navigationLabel="Studio pages"
    slotProps={{ paper: () => ({ sx: [{ padding: '2px' }, { padding: '6px' }] }) }} />);
  expect(screen.getByRole('region', { name: 'Studio' })).toHaveStyle({ position: 'relative', padding: '6px' });
  expect(screen.getByRole('navigation', { name: 'Studio pages' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Assets' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByText('Workspace A')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Jobs' })); expect(select).toHaveBeenCalledTimes(1); expect(close).not.toHaveBeenCalled();
  expect(ref.current).toBe(screen.getByTestId('sidebar')); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('reports temporary selection and dismissal while respecting controlled open and closeOnSelect', async () => {
  const close = vi.fn(); const select = vi.fn();
  const { rerender } = renderWithUi(<NavigationSidebar items={items} open variant="temporary" onClose={close} onSelect={select} transitionDuration={0} />);
  fireEvent.click(screen.getByRole('button', { name: 'Jobs' })); expect(select).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenLastCalledWith(expect.anything(), 'itemSelect'); expect(screen.getByRole('dialog')).toBeInTheDocument();
  await userEvent.keyboard('{Escape}'); expect(close).toHaveBeenLastCalledWith(expect.anything(), 'escapeKeyDown');
  fireEvent.click(document.querySelector('.MuiBackdrop-root')!); expect(close).toHaveBeenLastCalledWith(expect.anything(), 'backdropClick');
  fireEvent.click(screen.getByRole('button', { name: 'Close drawer' })); expect(close).toHaveBeenLastCalledWith(expect.anything(), 'closeButtonClick');
  close.mockClear(); rerender(<NavigationSidebar items={items} open variant="temporary" closeOnSelect={false} onClose={close} transitionDuration={0} />);
  fireEvent.click(screen.getByRole('button', { name: 'Jobs' })); expect(close).not.toHaveBeenCalled();
});
it('suppresses selection and dismissal while busy and forwards navigation link rendering', async () => {
  const select = vi.fn(); const close = vi.fn();
  const { rerender } = renderWithUi(<NavigationSidebar items={items} open busy variant="temporary" onSelect={select} onClose={close} transitionDuration={0} />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Jobs' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Jobs' })); await userEvent.keyboard('{Escape}');
  expect(select).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  rerender(<NavigationSidebar items={items} open variant="persistent" anchor="right" navigationProps={{ renderLink: (props) => <a {...props} data-custom="yes" /> }} />);
  expect(screen.getByRole('region')).toHaveClass('MuiDrawer-paperAnchorRight');
  expect(screen.getByRole('link')).toHaveAttribute('data-custom', 'yes');
});
it('traps focus in temporary mode and restores the opener after selection closes it', async () => {
  function Example() { const [open, setOpen] = useState(false); return <><button onClick={() => setOpen(true)}>Open navigation</button>
    <NavigationSidebar items={items} open={open} variant="temporary" transitionDuration={0} onClose={() => setOpen(false)} /></>; }
  renderWithUi(<Example />); await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
  screen.getByRole('button', { name: 'Jobs' }).focus(); await userEvent.tab();
  expect(screen.getByRole('button', { name: 'Close drawer' })).toHaveFocus();
  await userEvent.click(screen.getByRole('button', { name: 'Jobs' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveFocus();
});
