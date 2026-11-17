import { createRef, useState } from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { IconMenu } from '../IconMenu';
import { IconSidebar, type IconSidebarItem } from './IconSidebar';

const items: IconSidebarItem[] = [
  { id: 'layers', label: 'Layers', icon: <span>L</span>, content: <input aria-label="Layer name" defaultValue="Background" /> },
  { id: 'brushes', label: 'Brushes', icon: <span>B</span>, disabled: true, disabledReason: 'Select an image', content: 'Brush options' },
  { id: 'history', label: 'History', icon: <span>H</span>, group: 'document', content: <button>Restore revision</button> }
];
const footer: IconSidebarItem[] = [{ id: 'settings', label: 'Settings', icon: <span>S</span>, content: 'Settings content' }];

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() =>
    ({ x: 500, y: 0, top: 0, left: 500, right: 556, bottom: 400, width: 56, height: 400, toJSON: () => ({}) }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('composes a vertical Toolbar, IconButtons and a named Panel with linked disclosure semantics', async () => {
  renderWithUi(<IconSidebar items={items} defaultValue="layers" />);
  const toolbar = screen.getByRole('toolbar', { name: 'Panels' });
  expect(toolbar).toHaveAttribute('aria-orientation', 'vertical');
  const trigger = within(toolbar).getByRole('button', { name: 'Layers' });
  const panel = await screen.findByRole('region', { name: 'Layers' });
  expect(panel.id).toBe(trigger.getAttribute('aria-controls'));
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(panel).toHaveClass('MuiPaper-root');
  expect(trigger).toHaveClass('MuiIconButton-root');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('opens, switches, and closes the active panel by clicking its icon again', async () => {
  const changed = vi.fn(); const clicked = vi.fn();
  renderWithUi(<IconSidebar items={[{ ...items[0], onClick: clicked }, items[2]]} onChange={changed} />);
  await userEvent.click(screen.getByRole('button', { name: 'Layers' }));
  expect(clicked).toHaveBeenCalledTimes(1);
  expect(changed).toHaveBeenLastCalledWith('layers', expect.anything(), 'itemClick');
  expect(screen.getByRole('textbox')).toHaveValue('Background');
  await userEvent.click(screen.getByRole('button', { name: 'History' }));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Restore revision' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'History' }));
  expect(changed).toHaveBeenLastCalledWith(null, expect.anything(), 'itemClick');
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});

it('keeps selection controlled and forwards pending close reasons without changing the parent value', async () => {
  const changed = vi.fn();
  const { rerender } = renderWithUi(<IconSidebar items={items} value="layers" onChange={changed} />);
  await userEvent.click(screen.getByRole('button', { name: 'History' }));
  expect(changed).toHaveBeenCalledWith('history', expect.anything(), 'itemClick');
  expect(screen.getByRole('region', { name: 'Layers' })).toBeInTheDocument();
  rerender(<IconSidebar items={items} value="history" onChange={changed} />);
  await userEvent.click(screen.getByRole('button', { name: 'Close panel' }));
  expect(changed).toHaveBeenLastCalledWith(null, expect.anything(), 'closeButtonClick');
  expect(screen.getByRole('region', { name: 'History' })).toBeInTheDocument();
  rerender(<IconSidebar items={items} value={null} onChange={changed} />);
  expect(screen.getByRole('button', { name: 'History' })).toHaveFocus();
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});

it('allows an item callback to cancel selection and never invokes disabled items', async () => {
  const changed = vi.fn(); const disabledClick = vi.fn();
  const blocked = vi.fn((event: React.MouseEvent) => event.preventDefault());
  renderWithUi(<IconSidebar items={[{ ...items[0], onClick: blocked }, { ...items[1], onClick: disabledClick }]} onChange={changed} />);
  await userEvent.click(screen.getByRole('button', { name: 'Layers' }));
  fireEvent.click(screen.getByRole('button', { name: 'Brushes' }));
  expect(blocked).toHaveBeenCalledTimes(1); expect(changed).not.toHaveBeenCalled(); expect(disabledClick).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Brushes' })).toHaveAttribute('aria-description', 'Select an image');
});

it('uses a single rail tab stop and navigates across groups and footer items while skipping disabled tools', async () => {
  renderWithUi(<><button>Before</button><IconSidebar items={items} footerItems={footer} /><button>After</button></>);
  await userEvent.tab(); await userEvent.tab();
  expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}'); expect(screen.getByRole('button', { name: 'Layers' })).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}'); expect(screen.getByRole('button', { name: 'History' })).toHaveFocus();
  await userEvent.keyboard('{End}'); expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus();
  await userEvent.keyboard('{Enter}'); expect(screen.getByRole('region', { name: 'Settings' })).toHaveTextContent('Settings content');
  await userEvent.keyboard('{Home}'); expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveFocus();
  await userEvent.tab(); expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
});

it.each(['left', 'right'] as const)('opens and enters the panel toward the center from the %s side, then closes with Escape', async (side) => {
  const changed = vi.fn();
  renderWithUi(<IconSidebar items={items} side={side} onChange={changed} />);
  act(() => screen.getByRole('button', { name: 'Layers' }).focus());
  await userEvent.keyboard(side === 'right' ? '{ArrowLeft}' : '{ArrowRight}');
  const panel = await screen.findByRole('region', { name: 'Layers' });
  expect(panel).toHaveFocus();
  expect(changed).toHaveBeenCalledWith('layers', expect.anything(), 'keyboard');
  await userEvent.keyboard(side === 'right' ? '{ArrowRight}' : '{ArrowLeft}');
  expect(screen.getByRole('button', { name: 'Layers' })).toHaveFocus();
  await userEvent.keyboard(side === 'right' ? '{ArrowLeft}' : '{ArrowRight}');
  expect(panel).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Layers' })).toHaveFocus();
  expect(changed).toHaveBeenLastCalledWith(null, expect.anything(), 'escapeKeyDown');
});

it('preserves editing keys inside content and honors event prevention', async () => {
  const changed = vi.fn();
  renderWithUi(<IconSidebar items={items} defaultValue="layers" onChange={changed}
    onKeyDown={(event) => { if (event.key === 'Escape') event.preventDefault(); }} />);
  const input = await screen.findByRole('textbox');
  await userEvent.click(input);
  await userEvent.keyboard('{ArrowLeft}{Home}{Escape}');
  expect(input).toHaveFocus(); expect(changed).not.toHaveBeenCalled();
  expect(screen.getByRole('region')).toBeInTheDocument();
});

it('closes with its close button and restores focus to the trigger', async () => {
  const changed = vi.fn();
  renderWithUi(<IconSidebar items={items} defaultValue="layers" onChange={changed} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Close panel' }));
  expect(changed).toHaveBeenCalledWith(null, expect.anything(), 'closeButtonClick');
  expect(screen.getByRole('button', { name: 'Layers' })).toHaveFocus();
});

it('dismisses overlay panels on outside clicks without taking focus from the clicked control', async () => {
  const changed = vi.fn();
  renderWithUi(<><button>Outside</button><IconSidebar items={items} defaultValue="layers" onChange={changed} /></>);
  await userEvent.click(await screen.findByRole('textbox'));
  expect(changed).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Outside' }));
  await waitFor(() => expect(screen.queryByRole('region')).not.toBeInTheDocument());
  expect(changed).toHaveBeenLastCalledWith(null, expect.anything(), 'clickAway');
  expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();
});

it.each([{ panelMode: 'inline' as const }, { dismissOnClickAway: false }])('can keep the panel open when clicking outside: %j', async (props) => {
  const changed = vi.fn();
  renderWithUi(<><button>Outside</button><IconSidebar {...props} items={items} defaultValue="layers" onChange={changed} /></>);
  await userEvent.click(screen.getByRole('button', { name: 'Outside' }));
  expect(screen.getByRole('region', { name: 'Layers' })).toBeInTheDocument();
  expect(changed).not.toHaveBeenCalled();
});

it('treats menus portaled from its content as inside, allowing the nested menu to handle Escape first', async () => {
  const selected = vi.fn(); const changed = vi.fn();
  const menuItem = { ...items[0], content: <IconMenu aria-label="Layer actions" items={[{ id: 'duplicate', label: 'Duplicate' }]}
    onItemClick={selected} /> };
  renderWithUi(<IconSidebar items={[menuItem]} defaultValue="layers" onChange={changed} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Layer actions' }));
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  expect(screen.getByRole('region', { name: 'Layers' })).toBeInTheDocument(); expect(changed).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Layer actions' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
  expect(selected).toHaveBeenCalledTimes(1);
  expect(changed).not.toHaveBeenCalled();
});

it('preserves inactive panel content only with keepMounted, including closing and reopening the overlay', async () => {
  renderWithUi(<IconSidebar items={items} defaultValue="layers" keepMounted />);
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'Edited layer' } });
  await userEvent.click(screen.getByRole('button', { name: 'History' }));
  expect(screen.getByDisplayValue('Edited layer')).not.toBeVisible();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Close panel' }));
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Layers' }));
  expect(screen.getByRole('textbox')).toHaveValue('Edited layer');
});

it('unmounts inactive content by default', async () => {
  renderWithUi(<IconSidebar items={items} defaultValue="layers" />);
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'Edited' } });
  await userEvent.click(screen.getByRole('button', { name: 'History' }));
  expect(screen.queryByDisplayValue('Edited')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Layers' }));
  expect(screen.getByRole('textbox')).toHaveValue('Background');
});

it('expands labels independently of selection, with controlled and uncontrolled expansion', async () => {
  const expanded = vi.fn(); const changed = vi.fn();
  const { rerender } = renderWithUi(<IconSidebar items={items} onExpandedChange={expanded} onChange={changed} />);
  await userEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
  expect(expanded).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toHaveAttribute('aria-expanded', 'true');
  expect(changed).not.toHaveBeenCalled();
  rerender(<IconSidebar items={items} expanded={false} onExpandedChange={expanded} />);
  await userEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
  expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  rerender(<IconSidebar items={items} expanded onExpandedChange={expanded} />);
  expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
});

it('handles empty, removed and disabled active items without auto-selecting another panel', async () => {
  const changed = vi.fn();
  const { rerender } = renderWithUi(<IconSidebar items={items} value="layers" onChange={changed} />);
  expect(await screen.findByRole('textbox')).toBeInTheDocument();
  rerender(<IconSidebar items={[items[1], items[2]]} value="layers" onChange={changed} />);
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  rerender(<IconSidebar items={items} value="brushes" onChange={changed} />);
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  rerender(<IconSidebar items={[]} value={null} onChange={changed} />);
  expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  expect(changed).not.toHaveBeenCalled();
});

it('forwards refs, native events, styles and custom panel content with unique IDs across instances', async () => {
  const ref = createRef<HTMLDivElement>(); const key = vi.fn();
  const custom = { ...items[0], panelTitle: 'Document layers', description: '8 visible layers', footer: <button>New layer</button>, badge: 8, badgeLabel: '8 layers' };
  renderWithUi(<><IconSidebar ref={ref} items={[custom]} defaultValue="layers" panelMode="inline" data-testid="sidebar"
    sx={[{ padding: '3px' }, { padding: '5px' }]} onKeyDown={key} aria-label="Document panels" />
    <IconSidebar items={items} defaultValue="layers" panelMode="inline" /></>);
  expect(ref.current).toBe(screen.getByTestId('sidebar'));
  expect(ref.current).toHaveStyle({ padding: '5px' });
  expect(screen.getByRole('region', { name: 'Document layers' })).toHaveTextContent('8 visible layers');
  expect(screen.getByRole('button', { name: 'New layer' })).toBeInTheDocument();
  const triggers = screen.getAllByRole('button', { name: 'Layers' });
  expect(triggers[0].getAttribute('aria-controls')).not.toBe(triggers[1].getAttribute('aria-controls'));
  expect(triggers[0]).toHaveAttribute('aria-description', '8 layers');
  fireEvent.keyDown(triggers[0], { key: 'x' }); expect(key).toHaveBeenCalledTimes(1);
});

it('tracks the rail height and disconnects its observer on unmount', () => {
  const observe = vi.fn(); const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class { observe = observe; disconnect = disconnect; });
  const { unmount } = renderWithUi(<IconSidebar items={items} defaultValue="layers" />);
  expect(observe).toHaveBeenCalled();
  unmount(); expect(disconnect).toHaveBeenCalled();
});

it('can be used with parent-owned state', async () => {
  function Controlled() {
    const [value, setValue] = useState<string | null>(null);
    return <IconSidebar items={items} value={value} onChange={setValue} />;
  }
  renderWithUi(<Controlled />);
  await userEvent.click(screen.getByRole('button', { name: 'Layers' }));
  expect(screen.getByRole('region', { name: 'Layers' })).toBeInTheDocument();
});

it('shows shared IconButton tooltips for icons and disabled reasons', async () => {
  renderWithUi(<IconSidebar items={items} />);
  await userEvent.hover(screen.getByRole('button', { name: 'Layers' }));
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Layers');
  await userEvent.unhover(screen.getByRole('button', { name: 'Layers' }));
  await userEvent.hover(screen.getByRole('button', { name: 'Brushes' }).parentElement!);
  await waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent('Brushes: Select an image'));
});

it('restores a usable rail control when the currently focused panel becomes unavailable', async () => {
  const { rerender } = renderWithUi(<IconSidebar items={items} value="layers" />);
  await userEvent.click(await screen.findByRole('textbox'));
  rerender(<IconSidebar items={[items[2]]} value="layers" />);
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'History' })).toHaveFocus();
});

it('preserves direction on the portaled panel', async () => {
  renderWithUi(<IconSidebar items={items} defaultValue="layers" dir="rtl" />);
  expect(await screen.findByRole('region', { name: 'Layers' })).toHaveAttribute('dir', 'rtl');
  expect(screen.getByRole('toolbar')).toHaveAttribute('dir', 'rtl');
});

it('keeps focus in the new panel when a parent switches panels while editing', async () => {
  const { rerender } = renderWithUi(<IconSidebar items={items} value="layers" />);
  await userEvent.click(await screen.findByRole('textbox'));
  rerender(<IconSidebar items={items} value="history" />);
  expect(screen.getByRole('region', { name: 'History' })).toHaveFocus();
});
