import { createRef } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { Toolbar, ToolbarGroup } from './Toolbar';

it('provides one button tab stop and navigates groups, skipping disabled actions', async () => {
  const action = vi.fn();
  renderWithUi(<><button>Before</button><Toolbar aria-label="Edit tools">
    <ToolbarGroup aria-label="History"><button onClick={action}>Undo</button><button disabled>Redo</button></ToolbarGroup>
    <ToolbarGroup divided><button>Save</button><a href="#help">Help</a></ToolbarGroup>
  </Toolbar><button>After</button></>);
  await userEvent.tab(); await userEvent.tab();
  expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  await userEvent.keyboard('{End}');
  expect(screen.getByRole('link')).toHaveFocus();
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
  await userEvent.keyboard('{Enter}'); expect(action).toHaveBeenCalledTimes(1);
  await userEvent.tab(); expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  await userEvent.tab({ shift: true }); expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
});

it('handles vertical and RTL directions, Home and reverse wrapping', async () => {
  const { rerender } = renderWithUi(<Toolbar orientation="vertical"><button>One</button><button>Two</button></Toolbar>);
  screen.getByRole('button', { name: 'One' }).focus();
  await userEvent.keyboard('{ArrowUp}'); expect(screen.getByRole('button', { name: 'Two' })).toHaveFocus();
  await userEvent.keyboard('{Home}'); expect(screen.getByRole('button', { name: 'One' })).toHaveFocus();
  rerender(<Toolbar dir="rtl"><button>One</button><button>Two</button></Toolbar>);
  await userEvent.keyboard('{ArrowLeft}'); expect(screen.getByRole('button', { name: 'Two' })).toHaveFocus();
});

it('preserves text field keys and honors caller prevention', () => {
  const prevented = vi.fn((event: React.KeyboardEvent) => event.preventDefault());
  const { rerender } = renderWithUi(<Toolbar><input aria-label="Search" /><button>Save</button></Toolbar>);
  const input = screen.getByRole('textbox'); input.focus();
  expect(fireEvent.keyDown(input, { key: 'Home' })).toBe(true);
  expect(input).toHaveFocus();
  rerender(<Toolbar onKeyDown={prevented}><button>Save</button><button>Cancel</button></Toolbar>);
  screen.getByRole('button', { name: 'Save' }).focus();
  fireEvent.keyDown(screen.getByRole('button', { name: 'Save' }), { key: 'ArrowRight' });
  expect(prevented).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
});

it('updates the tab stop when children or disabled states change', async () => {
  const { rerender } = renderWithUi(<Toolbar><button>One</button><button>Two</button></Toolbar>);
  expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('tabindex', '0');
  rerender(<Toolbar><button disabled>One</button><button>Two</button><button>Three</button></Toolbar>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Two' })).toHaveAttribute('tabindex', '0'));
  expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('tabindex', '-1');
  screen.getByRole('button', { name: 'Two' }).focus();
  await userEvent.keyboard('{ArrowRight}'); expect(screen.getByRole('button', { name: 'Three' })).toHaveFocus();
});

it('isolates nested toolbars and supports opting out of roving navigation', async () => {
  const { rerender } = renderWithUi(<Toolbar aria-label="Outer"><button>Outer action</button>
    <Toolbar aria-label="Inner"><button>Inner first</button><button>Inner last</button></Toolbar></Toolbar>);
  screen.getByRole('button', { name: 'Inner first' }).focus();
  await userEvent.keyboard('{ArrowRight}'); expect(screen.getByRole('button', { name: 'Inner last' })).toHaveFocus();
  rerender(<Toolbar rovingFocus={false}><button>One</button><button>Two</button></Toolbar>);
  expect(screen.getByRole('button', { name: 'One' }).tabIndex).toBe(0);
  expect(screen.getByRole('button', { name: 'Two' }).tabIndex).toBe(0);
});

it('forwards refs, native events, group labels, end actions and style overrides', () => {
  const ref = createRef<HTMLDivElement>(); const focus = vi.fn();
  renderWithUi(<Toolbar ref={ref} data-testid="toolbar" sx={[{ padding: '3px' }, { padding: '5px' }]} onFocus={focus}
    endActions={<button>Export</button>}><ToolbarGroup aria-label="Actions"><button>Save</button></ToolbarGroup></Toolbar>);
  expect(ref.current).toBe(screen.getByTestId('toolbar'));
  expect(ref.current).toHaveStyle({ padding: '5px' });
  expect(screen.getByRole('group', { name: 'Actions' })).toBeInTheDocument();
  screen.getByRole('button', { name: 'Export' }).focus();
  expect(focus).toHaveBeenCalled();
});

it('skips actions inside hidden groups and removes aria-disabled links from the tab sequence', async () => {
  renderWithUi(<Toolbar><button>One</button><div style={{ display: 'none' }}><button>Hidden</button></div>
    <a href="#disabled" aria-disabled="true">Unavailable</a><button>Two</button></Toolbar>);
  expect(screen.getByRole('link', { name: 'Unavailable' })).toHaveAttribute('tabindex', '-1');
  screen.getByRole('button', { name: 'One' }).focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByRole('button', { name: 'Two' })).toHaveFocus();
  await userEvent.tab();
  expect(screen.getByRole('link', { name: 'Unavailable' })).not.toHaveFocus();
});
