import * as React from 'react';
import { Box, Divider, Drawer as MuiDrawer, Typography, type DrawerProps as MuiDrawerProps } from '@mui/material';
import { CloseIcon } from '../../internal/CloseIcon';
import { IconButton } from '../IconButton';

export type DrawerCloseReason = 'escapeKeyDown' | 'backdropClick' | 'closeButtonClick';
export interface DrawerProps extends Omit<MuiDrawerProps, 'title' | 'onClose'> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  width?: number | string;
  closeButton?: boolean;
  closeLabel?: string;
  busy?: boolean;
  onClose?: (event: React.SyntheticEvent | Event, reason: DrawerCloseReason) => void;
}

export const Drawer = React.forwardRef<HTMLDivElement, DrawerProps>(function Drawer(
  { title, subtitle, actions, children, width = 360, closeButton = true, closeLabel = 'Close drawer', busy = false,
    onClose, anchor = 'right', variant = 'temporary', slotProps, ...props }, ref
) {
  const id = React.useId();
  const side = anchor === 'left' || anchor === 'right';
  return <MuiDrawer ref={ref} anchor={anchor} variant={variant} {...props}
    onClose={(event, reason) => { if (!busy) onClose?.(event as Event, reason); }}
    slotProps={{ ...slotProps, paper: (ownerState) => {
      const supplied = typeof slotProps?.paper === 'function' ? slotProps.paper(ownerState) : slotProps?.paper;
      return { ...supplied, role: variant === 'temporary' ? 'dialog' : 'region',
        'aria-modal': variant === 'temporary' ? true : undefined,
        'aria-labelledby': supplied?.['aria-labelledby'] ?? `${id}-title`, 'aria-busy': busy || undefined,
        sx: [{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden',
          ...(side ? { width, maxWidth: variant === 'temporary' ? 'calc(100% - 24px)' : '100%' } : { maxHeight: '85dvh' }) },
          ...(Array.isArray(supplied?.sx) ? supplied.sx : supplied?.sx ? [supplied.sx] : [])] };
    } }}>
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: 2, flexShrink: 0 }}>
      <Box sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
        <Typography id={`${id}-title`} component="h2" variant="h6">{title}</Typography>
        {subtitle != null ? <Typography component="div" variant="body2" color="text.secondary">{subtitle}</Typography> : null}
      </Box>
      {closeButton && onClose ? <IconButton aria-label={closeLabel} size="small" outlined={false} disabled={busy}
        onClick={(event) => onClose(event, 'closeButtonClick')}><CloseIcon /></IconButton> : null}
    </Box>
    <Divider />
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2, overflowWrap: 'anywhere' }}>{children}</Box>
    {actions != null ? <><Divider /><Box sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 1, flexShrink: 0 }}>{actions}</Box></> : null}
  </MuiDrawer>;
});
