import { createRef } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { mockMenuAnchorLayout } from '../../test/menuTriggerContract';
import { Popover } from './Popover';

let anchor: HTMLButtonElement;
beforeEach(() => { mockMenuAnchorLayout(); anchor = document.createElement('button'); anchor.textContent = 'Anchor'; document.body.append(anchor); });
afterEach(() => { anchor.remove(); vi.restoreAllMocks(); });
it('labels its dialog and delegates close reasons without owning open state', () => {
  const close = vi.fn(); renderWithUi(<Popover open anchorEl={anchor} title="Appearance" description="Edit this layer" onClose={close} transitionDuration={0}><input aria-label="Name" /></Popover>);
  expect(screen.getByRole('dialog', { name: 'Appearance' })).toHaveAccessibleDescription('Edit this layer');
  fireEvent.click(screen.getByRole('button', { name: 'Close popover' })); expect(close).toHaveBeenLastCalledWith(expect.anything(), 'closeButtonClick');
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }); expect(close).toHaveBeenLastCalledWith(expect.anything(), 'escapeKeyDown');
  expect(screen.getByRole('dialog')).toBeVisible();
});
it('traps focus and restores the trigger when the caller closes', async () => {
  anchor.focus(); const { rerender } = renderWithUi(<Popover open anchorEl={anchor} title="Editor" transitionDuration={0}><input autoFocus aria-label="Value" /></Popover>);
  expect(screen.getByRole('textbox')).toHaveFocus(); anchor.focus();
  await waitFor(() => expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true));
  rerender(<Popover open={false} anchorEl={anchor} title="Editor" transitionDuration={0} />);
  await waitFor(() => expect(anchor).toHaveFocus());
});
it('preserves paper slot props, custom names, actions and native refs', () => {
  const ref = createRef<HTMLDivElement>(); renderWithUi(<Popover ref={ref} open anchorEl={anchor} aria-label="Custom editor" actions={<button>Apply</button>}
    transitionDuration={0} slotProps={{ paper: () => ({ 'data-testid': 'surface', sx: [{ padding: '3px' }, { padding: '6px' }] }) }} />);
  expect(ref.current).toBeInTheDocument(); expect(screen.getByRole('dialog', { name: 'Custom editor' })).toHaveStyle({ padding: '6px' });
  expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
});
