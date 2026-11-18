import type * as React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { MenuTriggerOptions } from '../components/Menu';
import { renderWithUi } from './renderWithUi';

export interface MenuTriggerTestProps extends MenuTriggerOptions {
  disabled?: boolean;
  id?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
}

export function mockMenuAnchorLayout() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 16, y: 16, top: 16, left: 16, right: 176, bottom: 56, width: 160, height: 40,
    toJSON: () => ({})
  });
}

export function testMenuTrigger(name: string, renderTrigger: (props: MenuTriggerTestProps) => React.ReactElement) {
  describe(name, () => {
    beforeEach(mockMenuAnchorLayout);
    afterEach(() => vi.restoreAllMocks());

    const mount = (props: MenuTriggerTestProps) => renderWithUi(renderTrigger({ menuProps: { transitionDuration: 0 }, ...props }));
    const open = () => {
      const trigger = screen.getByRole('button', { name: 'Options' });
      trigger.focus();
      fireEvent.click(trigger);
      return trigger;
    };

    it('opens a labelled menu and forwards trigger, item and selection callbacks once', async () => {
      const onClick = vi.fn();
      const onItemClick = vi.fn();
      const onSelect = vi.fn();
      const onClose = vi.fn();
      const item = { id: 'open', label: 'Open item', onClick: onSelect };
      mount({ items: [item], onClick, onItemClick, onClose, id: 'options' });
      const trigger = open();
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      const menu = screen.getByRole('menu', { name: 'Options' });
      expect(menu).toHaveAttribute('id', trigger.getAttribute('aria-controls'));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Open item' }));
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledExactlyOnceWith(item, expect.anything());
      expect(onItemClick).toHaveBeenCalledExactlyOnceWith(item, expect.anything());
      expect(onClose).toHaveBeenCalledWith('itemClick');
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveFocus();
    });

    it('supports arrow/Home/End navigation, skips disabled items, and selects footer actions with Enter', async () => {
      const onHelp = vi.fn();
      mount({
        header: 'Workspace actions',
        items: [{ id: 'locked', label: 'Locked', disabled: true }, { id: 'open', label: 'Open' }, { id: 'share', label: 'Share' }],
        actions: [{ id: 'help', label: 'Help', onClick: onHelp }]
      });
      const trigger = screen.getByRole('button', { name: 'Options' });
      trigger.focus();
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });
      const first = screen.getByRole('menuitem', { name: 'Open' });
      await waitFor(() => expect(first).toHaveFocus());
      fireEvent.keyDown(first, { key: 'ArrowDown' });
      expect(screen.getByRole('menuitem', { name: 'Share' })).toHaveFocus();
      fireEvent.keyDown(document.activeElement!, { key: 'Home' });
      expect(first).toHaveFocus();
      fireEvent.keyDown(first, { key: 'ArrowUp' });
      expect(screen.getByRole('menuitem', { name: 'Help' })).toHaveFocus();
      fireEvent.keyDown(document.activeElement!, { key: 'Home' });
      fireEvent.keyDown(first, { key: 'End' });
      const help = screen.getByRole('menuitem', { name: 'Help' });
      expect(help).toHaveFocus();
      fireEvent.keyDown(help, { key: 'Enter' });
      expect(onHelp).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(trigger).toHaveFocus());
    });

    it('supports type-ahead and Space selection without closing when requested', () => {
      const onItemClick = vi.fn();
      mount({ items: [{ id: 'open', label: 'Open' }, { id: 'share', label: 'Share' }], closeOnClick: false, onItemClick });
      open();
      fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Open' }), { key: 's' });
      const share = screen.getByRole('menuitem', { name: 'Share' });
      expect(share).toHaveFocus();
      fireEvent.keyDown(share, { key: ' ', code: 'Space' });
      fireEvent.keyUp(share, { key: ' ', code: 'Space' });
      expect(onItemClick).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('prevents disabled-item callbacks and dismissal', () => {
      const onItemClick = vi.fn();
      const onSelect = vi.fn();
      const onClose = vi.fn();
      mount({ items: [{ id: 'locked', label: 'Locked', disabled: true, onClick: onSelect }], onItemClick, onClose });
      open();
      const item = screen.getByRole('menuitem', { name: 'Locked' });
      expect(item).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(item);
      expect(onSelect).not.toHaveBeenCalled();
      expect(onItemClick).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it.each([['Escape', 'escapeKeyDown'], ['Tab', 'tabKeyDown']] as const)(
      'dismisses on %s and restores trigger focus', async (key, reason) => {
        const onClose = vi.fn();
        mount({ items: [{ id: 'open', label: 'Open' }], onClose });
        const trigger = open();
        fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Open' }), { key });
        expect(onClose).toHaveBeenCalledWith(reason);
        await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
        expect(trigger).toHaveFocus();
      }
    );

    it('dismisses on backdrop clicks', async () => {
      const onClose = vi.fn();
      mount({ items: [{ id: 'open', label: 'Open' }], onClose });
      const trigger = open();
      // The backdrop intentionally has no interactive accessibility role.
      fireEvent.click(document.querySelector('.MuiBackdrop-root')!);
      expect(onClose).toHaveBeenCalledWith('backdropClick');
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      expect(trigger).toHaveFocus();
    });

    it('keeps checked state controlled and uses current callbacks after rerender', () => {
      const oldCallback = vi.fn();
      const newCallback = vi.fn();
      const props = { items: [{ id: 'pin', label: 'Pinned', checked: false }], closeOnClick: false };
      const { rerender } = mount({ ...props, onItemClick: oldCallback });
      open();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Pinned' })).toHaveAttribute('aria-checked', 'false');
      rerender(renderTrigger({ ...props, items: [{ ...props.items[0], checked: true }], onItemClick: newCallback, menuProps: { transitionDuration: 0 } }));
      const item = screen.getByRole('menuitemcheckbox', { name: 'Pinned' });
      expect(item).toHaveAttribute('aria-checked', 'true');
      fireEvent.click(item);
      expect(newCallback).toHaveBeenCalledTimes(1);
      expect(oldCallback).not.toHaveBeenCalled();
    });

    it('does not open a disabled trigger', () => {
      const onClick = vi.fn();
      mount({ items: [], disabled: true, onClick });
      const trigger = screen.getByRole('button', { name: 'Options' });
      fireEvent.click(trigger);
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(onClick).not.toHaveBeenCalled();
    });

    it('allows trigger handlers to prevent opening', () => {
      mount({ items: [], onClick: (event) => event.preventDefault(), onKeyDown: (event) => event.preventDefault() });
      const trigger = open();
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });
}
