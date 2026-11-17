import * as React from 'react';
import { MoreGlyph } from '../../internal/icons';
import { useMenuTrigger } from '../../internal/useMenuTrigger';
import { IconButton, type IconButtonProps } from '../IconButton';
import { Menu, type MenuTriggerOptions } from '../Menu';

export interface IconMenuProps extends IconButtonProps, MenuTriggerOptions {
  icon?: React.ReactNode;
}

export const IconMenu = React.forwardRef<HTMLButtonElement, IconMenuProps>(
  function IconMenu({ icon, children, items, header, actions, closeOnClick, onItemClick, onClose, menuProps, id, onClick, onKeyDown, disabled, ...props }, ref) {
    const menu = useMenuTrigger<HTMLButtonElement>(id, onClose);
    return (
      <>
        <IconButton ref={ref} {...props} disabled={disabled} {...menu.accessibilityProps}
          onClick={(event) => { if (!disabled) { onClick?.(event); menu.handleOpen(event); } }}
          onKeyDown={(event) => { onKeyDown?.(event); if (!disabled) menu.handleKeyDown(event); }}>
          {children ?? icon ?? <MoreGlyph />}
        </IconButton>
        <Menu {...menuProps} id={menu.menuId} labelledBy={menu.triggerId} anchorEl={menu.anchorEl} open={menu.open}
          items={items} header={header} actions={actions} closeOnClick={closeOnClick}
          onItemClick={onItemClick} onClose={menu.handleClose} />
      </>
    );
  }
);

IconMenu.displayName = 'IconMenu';
