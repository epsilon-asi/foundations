import * as React from 'react';
import { Chip, Stack, type ChipProps } from '@mui/material';
import { ChevronGlyph } from '../../internal/icons';
import { useMenuTrigger } from '../../internal/useMenuTrigger';
import { Menu, type MenuTriggerOptions } from '../Menu';

export interface ChipMenuProps extends Omit<ChipProps, 'onDelete' | 'deleteIcon' | 'clickable' | 'label'>, MenuTriggerOptions {
  label: React.ReactNode;
}

export const ChipMenu = React.forwardRef<HTMLDivElement, ChipMenuProps>(
  function ChipMenu({ label, items, header, actions, closeOnClick, onItemClick, onClose, menuProps, id, onClick, onKeyDown, disabled, ...props }, ref) {
    const menu = useMenuTrigger<HTMLDivElement>(id, onClose);
    return (
      <>
        <Chip ref={ref} {...props} disabled={disabled} clickable {...menu.accessibilityProps}
          label={<Stack component="span" direction="row" alignItems="center" spacing={0.5}>{label}<ChevronGlyph /></Stack>}
          onClick={(event) => { if (!disabled) { onClick?.(event); menu.handleOpen(event); } }}
          onKeyDown={(event) => { onKeyDown?.(event); if (!disabled) menu.handleKeyDown(event); }} />
        <Menu {...menuProps} id={menu.menuId} labelledBy={menu.triggerId} anchorEl={menu.anchorEl} open={menu.open}
          items={items} header={header} actions={actions} closeOnClick={closeOnClick}
          onItemClick={onItemClick} onClose={menu.handleClose} />
      </>
    );
  }
);

ChipMenu.displayName = 'ChipMenu';
