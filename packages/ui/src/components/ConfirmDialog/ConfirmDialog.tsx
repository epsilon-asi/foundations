import * as React from 'react';
import { Box } from '@mui/material';
import { ActionButton } from '../ActionButton';
import { ModalDialog, type ModalDialogProps } from '../ModalDialog';

export interface ConfirmDialogProps extends Omit<ModalDialogProps, 'actions' | 'onClose' | 'role'> {
  onConfirm: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onClose: NonNullable<ModalDialogProps['onClose']>;
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  busyLabel?: React.ReactNode;
  confirmDisabled?: boolean;
  destructive?: boolean;
  error?: React.ReactNode;
}

/** The caller owns the operation, busy state, errors, and whether success closes the dialog. */
export const ConfirmDialog = React.forwardRef<HTMLDivElement, ConfirmDialogProps>(function ConfirmDialog(
  { onConfirm, onClose, confirmLabel = 'Confirm', cancelLabel = 'Cancel', busyLabel = 'Confirming…',
    confirmDisabled = false, destructive = false, busy = false, error, children, ...props }, ref
) {
  return <ModalDialog ref={ref} role="alertdialog" {...props} busy={busy} onClose={onClose} actions={<>
    <ActionButton autoFocus variant="text" color="inherit" disabled={busy} onClick={(event) => onClose(event, 'cancelButtonClick')}>{cancelLabel}</ActionButton>
    <ActionButton variant="contained" color={destructive ? 'error' : 'primary'} disabled={confirmDisabled}
      loading={busy} loadingLabel={busyLabel} onClick={onConfirm}>{confirmLabel}</ActionButton>
  </>}>
    {children}
    {error != null ? <Box role="alert" sx={{ mt: 2, color: 'error.main' }}>{error}</Box> : null}
  </ModalDialog>;
});
