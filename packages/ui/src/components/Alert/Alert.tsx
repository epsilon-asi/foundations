import * as React from 'react';
import { Alert as MuiAlert, AlertTitle, Box, type AlertProps as MuiAlertProps } from '@mui/material';
import { IconButton } from '../IconButton';
import { CloseIcon } from '../../internal/CloseIcon';
export interface AlertProps extends Omit<MuiAlertProps, 'title'> { title?: React.ReactNode }
export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { title, severity = 'info', role = severity === 'error' || severity === 'warning' ? 'alert' : 'status', onClose, closeText = 'Close alert', action, sx, children, ...props }, ref
) {
  return <MuiAlert {...props} ref={ref} severity={severity} role={role} sx={[{ minWidth: 0, maxWidth: '100%', flexWrap: 'wrap', gap: 1, px: 3, py: 1, overflowWrap: 'anywhere',
    '& .MuiAlert-icon': { mr: 0, py: 1, fontSize: 20 }, '& .MuiAlert-message': { flex: '1 1 140px', minWidth: 0, py: 1 },
    '& .MuiAlert-action': { minWidth: 0, maxWidth: '100%', m: 0, p: 0, alignItems: 'flex-start' } }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    action={action != null || onClose ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxWidth: '100%' }}>{action}
      {onClose ? <IconButton aria-label={closeText} outlined={false} size="small" color="inherit" onClick={onClose}><CloseIcon /></IconButton> : null}</Box> : undefined}>
    {title != null ? <AlertTitle>{title}</AlertTitle> : null}{children}
  </MuiAlert>;
});
