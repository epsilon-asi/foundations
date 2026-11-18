import * as React from 'react';
import { Box, Dialog, DialogActions, DialogContent, DialogTitle, Typography, type DialogProps } from '@mui/material';
import { CloseIcon } from '../../internal/CloseIcon';
import { IconButton } from '../IconButton';

export type DialogCloseReason = 'escapeKeyDown' | 'backdropClick' | 'closeButtonClick' | 'cancelButtonClick';

export interface ModalDialogProps extends Omit<DialogProps, 'title' | 'onClose'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  closeButton?: boolean;
  closeLabel?: string;
  busy?: boolean;
  onClose?: (event: React.SyntheticEvent | Event, reason: DialogCloseReason) => void;
}

export const ModalDialog = React.forwardRef<HTMLDivElement, ModalDialogProps>(function ModalDialog(
  { title, description, actions, children, closeButton = true, closeLabel = 'Close dialog', busy = false,
    onClose, maxWidth = 'sm', fullWidth = true, 'aria-labelledby': labelledBy,
    'aria-describedby': describedBy, ...props }, ref
) {
  const id = React.useId();
  return (
    <Dialog ref={ref} maxWidth={maxWidth} fullWidth={fullWidth} aria-labelledby={labelledBy ?? `${id}-title`}
      aria-describedby={describedBy ?? (description != null ? `${id}-description` : undefined)}
      aria-busy={busy || undefined} onClose={(event, reason) => { if (!busy) onClose?.(event as Event, reason); }} {...props}>
      <DialogTitle id={`${id}-header`} component="div" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
        <Typography id={`${id}-title`} component="h2" variant="h6" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{title}</Typography>
        {closeButton && onClose ? <IconButton aria-label={closeLabel} outlined={false} size="small" disabled={busy}
          onClick={(event) => onClose(event, 'closeButtonClick')}><CloseIcon /></IconButton> : null}
      </DialogTitle>
      <DialogContent sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        {description != null ? <Box id={`${id}-description`} sx={{ color: 'text.secondary', mb: children != null ? 2 : 0 }}>{description}</Box> : null}
        {children}
      </DialogContent>
      {actions != null ? <DialogActions sx={{ px: 3, pb: 3, flexWrap: 'wrap', gap: 1, '& > :not(style) ~ :not(style)': { ml: 0 } }}>{actions}</DialogActions> : null}
    </Dialog>
  );
});
