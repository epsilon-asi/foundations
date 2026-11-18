import * as React from 'react';
import { Snackbar, type SnackbarProps } from '@mui/material';
import { Alert, type AlertProps } from '../Alert';
export type ToastCloseReason = 'timeout' | 'escapeKeyDown' | 'clickaway' | 'closeButtonClick';
export interface ToastProps extends Omit<SnackbarProps, 'message' | 'children' | 'action' | 'onClose' | 'title'> {
  message: React.ReactNode;
  title?: React.ReactNode;
  severity?: AlertProps['severity'];
  variant?: AlertProps['variant'];
  action?: React.ReactNode;
  closable?: boolean;
  closeText?: string;
  dismissOnClickAway?: boolean;
  messageId?: string | number;
  onClose?: (event: React.SyntheticEvent | Event | null, reason: ToastCloseReason) => void;
}
export const Toast = React.forwardRef<HTMLDivElement, ToastProps>(function Toast(
  { message, title, severity = 'info', variant = 'standard', action, closable = true, closeText = 'Close notification',
    dismissOnClickAway = false, messageId, autoHideDuration = 6000, onClose, sx, ...props }, ref
) {
  return <Snackbar key={messageId} {...props} ref={ref} autoHideDuration={autoHideDuration}
    sx={[{ maxWidth: 'calc(100vw - 32px)' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    onClose={(event, reason) => { if (reason !== 'clickaway' || dismissOnClickAway) onClose?.(event, reason); }}>
    <Alert title={title} severity={severity} variant={variant} action={action} closeText={closeText}
      onClose={closable && onClose ? (event) => onClose(event, 'closeButtonClick') : undefined}>{message}</Alert>
  </Snackbar>;
});
