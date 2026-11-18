import * as React from 'react';
import { Button, type ButtonProps } from '@mui/material';
import { ChevronGlyph } from '../../internal/icons';
import { useMenuTrigger } from '../../internal/useMenuTrigger';
import { Menu, type MenuTriggerOptions } from '../Menu';

export interface DropdownMenuProps extends Omit<ButtonProps, 'children'>, MenuTriggerOptions {
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export const DropdownMenu = React.forwardRef<HTMLButtonElement, DropdownMenuProps>(
  function DropdownMenu({ label, icon, items, header, actions, closeOnClick, onItemClick, onClose, menuProps, id, onClick, onKeyDown, disabled, variant = 'outlined', ...props }, ref) {
    const menu = useMenuTrigger<HTMLButtonElement>(id, onClose);
    return (
      <>
        <Button
          ref={ref}
          variant={variant}
          disabled={disabled}
          startIcon={icon}
          endIcon={<ChevronGlyph sx={{ transform: menu.open ? 'rotate(180deg)' : undefined }} />}
          {...props}
          {...menu.accessibilityProps}
          onClick={(event) => { if (!disabled) { onClick?.(event); menu.handleOpen(event); } }}
          onKeyDown={(event) => { onKeyDown?.(event); if (!disabled) menu.handleKeyDown(event); }}
        >
          {label}
        </Button>
        <Menu {...menuProps} id={menu.menuId} labelledBy={menu.triggerId} anchorEl={menu.anchorEl} open={menu.open}
          items={items} header={header} actions={actions} closeOnClick={closeOnClick}
          onItemClick={onItemClick} onClose={menu.handleClose} />
      </>
    );
  }
);

DropdownMenu.displayName = 'DropdownMenu';
