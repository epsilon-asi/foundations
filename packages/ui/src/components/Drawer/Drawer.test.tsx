import { createRef, useState } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { Drawer } from './Drawer';

it('renders a named temporary dialog with header, content and actions and composes paper slots', () => {
  const ref = createRef<HTMLDivElement>();
  renderWithUi(<Drawer ref={ref} open title="Properties" subtitle="Selected asset" actions={<button>Save</button>}
    data-testid="drawer" transitionDuration={0} slotProps={{ paper: () => ({ sx: [{ padding: '3px' }, { padding: '6px' }] }) }}>
    <p>Asset details</p>
  </Drawer>);
  expect(screen.getByRole('dialog', { name: 'Properties' })).toHaveAttribute('aria-modal', 'true');
  expect(screen.getByRole('dialog')).toHaveStyle({ padding: '6px' });
  expect(ref.current).toBe(screen.getByTestId('drawer'));
  expect(screen.getByText('Selected asset')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
});

it('reports close button, Escape and backdrop dismissal without changing controlled open state', async () => {
  const onClose = vi.fn();
  renderWithUi(<Drawer open title="Jobs" onClose={onClose} transitionDuration={0} />);
  fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }));
  expect(onClose).toHaveBeenLastCalledWith(expect.anything(), 'closeButtonClick');
  await userEvent.keyboard('{Escape}');
  expect(onClose).toHaveBeenLastCalledWith(expect.anything(), 'escapeKeyDown');
  fireEvent.click(document.querySelector('.MuiBackdrop-root')!);
  expect(onClose).toHaveBeenLastCalledWith(expect.anything(), 'backdropClick');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

it('blocks busy dismissal and reflects changing busy props', async () => {
  const onClose = vi.fn();
  const { rerender } = renderWithUi(<Drawer open title="Jobs" busy onClose={onClose} transitionDuration={0} />);
  expect(screen.getByRole('button')).toBeDisabled();
  await userEvent.keyboard('{Escape}');
  fireEvent.click(document.querySelector('.MuiBackdrop-root')!);
  expect(onClose).not.toHaveBeenCalled();
  rerender(<Drawer open title="Jobs" onClose={onClose} transitionDuration={0} />);
  await userEvent.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledWith(expect.anything(), 'escapeKeyDown');
});

it('uses a nonmodal region for persistent and permanent drawers', () => {
  const { rerender } = renderWithUi(<><button>Outside</button><Drawer open variant="persistent" title="Inspector" /></>);
  expect(screen.getByRole('region', { name: 'Inspector' })).not.toHaveAttribute('aria-modal');
  screen.getByRole('button', { name: 'Outside' }).focus();
  expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();
  expect(document.querySelector('.MuiBackdrop-root')).toBeNull();
  rerender(<Drawer variant="permanent" title="Tools" />);
  expect(screen.getByRole('region', { name: 'Tools' })).toBeInTheDocument();
});

it('traps focus in temporary mode and restores it after close', async () => {
  function Example() {
    const [open, setOpen] = useState(false);
    return <><button onClick={() => setOpen(true)}>Show jobs</button><Drawer open={open} title="Jobs" closeButton={false}
      transitionDuration={0} onClose={() => setOpen(false)}><button autoFocus>First action</button><button>Last action</button></Drawer></>;
  }
  renderWithUi(<Example />);
  await userEvent.click(screen.getByRole('button', { name: 'Show jobs' }));
  expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus();
  await userEvent.tab({ shift: true });
  expect(screen.getByRole('button', { name: 'Last action' })).toHaveFocus();
  await userEvent.tab();
  expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Show jobs' })).toHaveFocus();
});

it.each(['left', 'right', 'top', 'bottom'] as const)('supports the %s anchor', (anchor) => {
  renderWithUi(<Drawer open title="Tools" anchor={anchor} transitionDuration={0} />);
  expect(screen.getByRole('dialog')).toHaveClass(`MuiDrawer-paperAnchor${anchor[0].toUpperCase()}${anchor.slice(1)}`);
});
