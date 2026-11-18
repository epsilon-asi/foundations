import * as React from 'react';
import { Box, Popover as MuiPopover, type PopoverProps as MuiPopoverProps } from '@mui/material';
import { Panel } from '../Panel';
import { IconButton } from '../IconButton';
import { CloseIcon } from '../../internal/CloseIcon';

export type PopoverCloseReason = 'escapeKeyDown' | 'backdropClick' | 'closeButtonClick';
export interface PopoverProps extends Omit<MuiPopoverProps, 'title' | 'onClose'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  closeLabel?: string;
  onClose?: (event: React.SyntheticEvent | Event, reason: PopoverCloseReason) => void;
}
export const Popover = React.forwardRef<HTMLDivElement, PopoverProps>(function Popover(
  { title, description, actions, closeLabel = 'Close popover', onClose, children, slotProps,
    'aria-label': ariaLabel, 'aria-labelledby': labelledBy, 'aria-describedby': describedBy, ...props }, ref
) {
  const id = React.useId();
  return <MuiPopover ref={ref} marginThreshold={8} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    onClose={(event, reason) => onClose?.(event as Event, reason)} {...props}
    slotProps={{ ...slotProps, paper: (owner) => {
      const supplied = typeof slotProps?.paper === 'function' ? slotProps.paper(owner) : slotProps?.paper;
      return { ...supplied, role: 'dialog', 'aria-modal': true, 'aria-label': ariaLabel ?? supplied?.['aria-label'],
        'aria-labelledby': labelledBy ?? supplied?.['aria-labelledby'] ?? (title != null ? `${id}-title` : undefined),
        'aria-describedby': describedBy ?? supplied?.['aria-describedby'] ?? (description != null ? `${id}-description` : undefined),
        sx: [{ width: 320, maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100dvh - 16px)', overflow: 'auto' },
          ...(Array.isArray(supplied?.sx) ? supplied.sx : supplied?.sx ? [supplied.sx] : [])] };
    } }}>
    <Panel variant="elevation" elevation={0} title={title != null ? <Box component="span" id={`${id}-title`}>{title}</Box> : undefined}
      headerAction={onClose ? <IconButton aria-label={closeLabel} outlined={false} onClick={event => onClose(event, 'closeButtonClick')}><CloseIcon /></IconButton> : undefined}
      footer={actions} sx={{ border: 0, borderRadius: 'inherit' }}>
      {description != null ? <Box id={`${id}-description`} sx={{ mb: children != null ? 2 : 0, color: 'text.secondary' }}>{description}</Box> : null}
      {children}
    </Panel>
  </MuiPopover>;
});
