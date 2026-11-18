import * as React from 'react';
import { Box } from '@mui/material';
import { ModalDialog, type ModalDialogProps } from '../ModalDialog';
import { FileDropzone, type FileDropzoneProps, type FileSelectionReason } from '../FileDropzone';
import { ActionButton } from '../ActionButton';
import { Alert } from '../Alert';
import { useControllableValue } from '../../internal/useControllableValue';

export interface UploadDialogProps extends Omit<ModalDialogProps, 'title' | 'actions' | 'busy' | 'onSubmit'> {
  title?: React.ReactNode;
  files?: readonly File[];
  defaultFiles?: readonly File[];
  onFilesChange?: (files: File[], reason: FileSelectionReason) => void;
  onSubmit: (files: readonly File[]) => Promise<void> | void;
  onSubmitSuccess?: () => void;
  onSubmitError?: (error: unknown) => void;
  getErrorMessage?: (error: unknown) => React.ReactNode;
  dropzoneProps?: Omit<FileDropzoneProps, 'files' | 'defaultFiles' | 'onFilesChange' | 'busy'>;
  busy?: boolean;
  resetOnClose?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
}
export const UploadDialog = React.forwardRef<HTMLDivElement, UploadDialogProps>(function UploadDialog(
  { title = 'Upload files', description = 'Choose files to add to your project.', files, defaultFiles = [], onFilesChange, onSubmit, onSubmitSuccess,
    onSubmitError, getErrorMessage, dropzoneProps, busy = false, resetOnClose = true, submitLabel = 'Upload files', cancelLabel = 'Cancel',
    open, onClose, children, slotProps, ...props }, ref
) {
  const [selected, setSelected] = useControllableValue<readonly File[]>(files, defaultFiles);
  const [submitting, setSubmitting] = React.useState(false); const [error, setError] = React.useState<React.ReactNode>(null);
  const pending = React.useRef(false); const session = React.useRef(0); const mounted = React.useRef(false); const isOpen = React.useRef(open); isOpen.current = open;
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  React.useEffect(() => {
    session.current++; pending.current = false; setSubmitting(false); setError(null);
    if (!open && resetOnClose) setSelected([]);
  }, [open]);
  const locked = busy || submitting;
  const submit = async () => {
    if (locked || pending.current || !open || !selected.length) return;
    pending.current = true; setSubmitting(true); setError(null); const token = session.current;
    const current = () => mounted.current && isOpen.current && token === session.current;
    try { await onSubmit([...selected]); if (current()) onSubmitSuccess?.(); }
    catch (failure) { if (current()) { setError(getErrorMessage?.(failure) ?? (failure instanceof Error ? failure.message : 'Could not upload files. Please try again.')); onSubmitError?.(failure); } }
    finally { if (mounted.current && token === session.current) { pending.current = false; setSubmitting(false); } }
  };
  return <ModalDialog {...props} ref={ref} open={open} title={title} description={description} busy={locked}
    slotProps={{ ...slotProps, paper: (owner) => {
      const supplied = typeof slotProps?.paper === 'function' ? slotProps.paper(owner) : slotProps?.paper;
      return { ...supplied, 'aria-busy': locked || undefined };
    } }}
    onClose={(event, reason) => { if (!locked) onClose?.(event, reason); }}
    actions={<>{onClose ? <ActionButton variant="text" color="inherit" disabled={locked} onClick={(event) => onClose(event, 'cancelButtonClick')}>{cancelLabel}</ActionButton> : null}
      <ActionButton variant="contained" disabled={!selected.length || dropzoneProps?.disabled || dropzoneProps?.readOnly} loading={locked} onClick={() => { void submit(); }}>{submitLabel}</ActionButton></>}>
    <Box sx={{ display: 'grid', gap: 2 }}>{error != null ? <Alert severity="error" title="Upload failed">{error}</Alert> : null}
      <FileDropzone {...dropzoneProps} files={selected} busy={locked} onFilesChange={(next, reason) => { setSelected(next); setError(null); onFilesChange?.(next, reason); }} />{children}
    </Box>
  </ModalDialog>;
});
