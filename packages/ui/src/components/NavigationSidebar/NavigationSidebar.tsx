import * as React from 'react';
import { Box } from '@mui/material';
import { Drawer, type DrawerCloseReason, type DrawerProps } from '../Drawer';
import { NavigationList, type NavigationListProps } from '../NavigationList';

export type NavigationSidebarCloseReason = DrawerCloseReason | 'itemSelect';
export interface NavigationSidebarProps extends Omit<DrawerProps, 'children' | 'title' | 'onClose' | 'onSelect' | 'anchor' | 'actions'> {
  title?: React.ReactNode;
  items: NavigationListProps['items'];
  value?: NavigationListProps['value'];
  onSelect?: NavigationListProps['onSelect'];
  header?: React.ReactNode;
  footer?: React.ReactNode;
  navigationLabel?: string;
  navigationProps?: Omit<NavigationListProps, 'items' | 'value' | 'onSelect'>;
  anchor?: 'left' | 'right';
  closeOnSelect?: boolean;
  onClose?: (event: React.SyntheticEvent | Event, reason: NavigationSidebarCloseReason) => void;
}

export const NavigationSidebar = React.forwardRef<HTMLDivElement, NavigationSidebarProps>(function NavigationSidebar(
  { title = 'Navigation', items, value, onSelect, header, footer, navigationLabel = 'Primary navigation', navigationProps,
    anchor = 'left', width = 264, variant = 'permanent', closeOnSelect = variant === 'temporary', busy = false,
    onClose, slotProps, sx, ...props }, ref
) {
  const docked = variant !== 'temporary';
  return <Drawer ref={ref} {...props} title={title} anchor={anchor} width={width} variant={variant} busy={busy} onClose={onClose}
    sx={[{ minWidth: 0, minHeight: 0, height: '100%', maxWidth: '100%', flexShrink: 0, width: docked ? width : undefined },
      ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    slotProps={{ ...slotProps, paper: (ownerState) => {
      const supplied = typeof slotProps?.paper === 'function' ? slotProps.paper(ownerState) : slotProps?.paper;
      return { ...supplied, sx: [docked ? { position: 'relative', height: '100%', width: '100%' } : {},
        ...(Array.isArray(supplied?.sx) ? supplied.sx : supplied?.sx ? [supplied.sx] : [])] };
    } }}
    actions={footer != null ? <Box sx={{ width: '100%', minWidth: 0 }}>{footer}</Box> : undefined}>
    {header != null ? <Box sx={{ mb: 2, minWidth: 0 }}>{header}</Box> : null}
    <NavigationList {...navigationProps} aria-label={navigationProps?.['aria-label'] ?? navigationLabel} items={items} value={value}
      disabled={busy || navigationProps?.disabled} onSelect={(item, event) => {
        onSelect?.(item, event);
        if (closeOnSelect && !busy) onClose?.(event, 'itemSelect');
      }} />
  </Drawer>;
});
