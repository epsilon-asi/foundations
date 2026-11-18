import * as React from 'react';
import { Box, Divider, ListItemIcon, ListItemText, ListSubheader, Menu as MuiMenu, MenuItem, type MenuProps as MuiMenuProps } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { CheckGlyph } from '../../internal/icons';

export interface MenuItemDefinition {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  checked?: boolean;
  selected?: boolean;
  sx?: SxProps<Theme>;
  onClick?: MenuItemOnClickFunction;
}

export type MenuItemOnClickFunction = (item: MenuItemDefinition, event: React.MouseEvent<HTMLLIElement>) => void;
export type MenuCloseReason = 'itemClick' | 'escapeKeyDown' | 'backdropClick' | 'tabKeyDown';

export interface MenuProps extends Omit<MuiMenuProps, 'children' | 'onClose'> {
  items: readonly MenuItemDefinition[];
  header?: React.ReactNode;
  actions?: readonly MenuItemDefinition[];
  labelledBy?: string;
  closeOnClick?: boolean;
  onItemClick?: MenuItemOnClickFunction;
  onClose?: (reason: MenuCloseReason) => void;
}

export interface MenuTriggerOptions {
  items: readonly MenuItemDefinition[];
  header?: React.ReactNode;
  actions?: readonly MenuItemDefinition[];
  closeOnClick?: boolean;
  onItemClick?: MenuItemOnClickFunction;
  onClose?: (reason: MenuCloseReason) => void;
  menuProps?: Omit<MenuProps, 'id' | 'open' | 'anchorEl' | 'items' | 'header' | 'actions' | 'labelledBy' | 'closeOnClick' | 'onItemClick' | 'onClose'>;
}

export const Menu = React.forwardRef<HTMLDivElement, MenuProps>(
  function Menu({ id, items, header, actions = [], labelledBy, closeOnClick = true, onItemClick, onClose, slotProps, disableAutoFocusItem, ...props }, ref) {
    const hasEnabledItems = [...items, ...actions].some((item) => !item.disabled);
    const renderItem = (item: MenuItemDefinition, group: string) => (
      <MenuItem
        key={`${group}-${item.id}`}
        disabled={item.disabled}
        selected={item.selected}
        role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
        aria-checked={item.checked}
        sx={[{ whiteSpace: 'normal', overflowWrap: 'anywhere' }, ...(Array.isArray(item.sx) ? item.sx : item.sx ? [item.sx] : [])]}
        onClick={(event) => {
          if (item.disabled) return;
          item.onClick?.(item, event);
          onItemClick?.(item, event);
          if (closeOnClick) onClose?.('itemClick');
        }}
      >
        {item.checked !== undefined ? (
          <ListItemIcon aria-hidden="true">
            <Box sx={{ display: 'flex', width: 20, height: 20, border: '1px solid', borderColor: 'divider', borderRadius: 0.5 }}>
              {item.checked ? <CheckGlyph sx={{ fontSize: 18 }} /> : null}
            </Box>
          </ListItemIcon>
        ) : null}
        {item.icon != null ? <ListItemIcon aria-hidden="true">{item.icon}</ListItemIcon> : null}
        <ListItemText sx={{ minWidth: 0 }}>{item.label}</ListItemText>
      </MenuItem>
    );

    return (
      <MuiMenu
        ref={ref}
        variant="menu"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        disableAutoFocusItem={disableAutoFocusItem || !hasEnabledItems}
        onClose={(_event, reason) => onClose?.(reason)}
        slotProps={{
          ...slotProps,
          list: (ownerState) => ({
            id,
            'aria-labelledby': labelledBy,
            ...(typeof slotProps?.list === 'function' ? slotProps.list(ownerState) : slotProps?.list)
          })
        }}
        {...props}
      >
        {header != null ? <ListSubheader component="li" disableSticky role="presentation" sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.5, py: 1.5 }}>{header}</ListSubheader> : null}
        {items.map((item) => renderItem(item, 'item'))}
        {actions.length > 0 ? <Divider component="li" role="separator" /> : null}
        {actions.map((item) => renderItem(item, 'action'))}
      </MuiMenu>
    );
  }
);

Menu.displayName = 'Menu';
