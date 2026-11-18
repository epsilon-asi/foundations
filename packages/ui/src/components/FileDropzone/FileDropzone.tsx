import * as React from 'react';
import { Box, Typography, type BoxProps } from '@mui/material';
import { ActionButton } from '../ActionButton';
import { Alert } from '../Alert';
import { SelectedFileList } from './SelectedFileList';
import { acceptTokens, selectFiles, type FileAccept, type FileRejection } from '../../internal/fileSelection';
import { useControllableValue } from '../../internal/useControllableValue';
export type { FileAccept, FileRejection, FileRejectionCode } from '../../internal/fileSelection';
export type FileSelectionReason = 'add' | 'remove';
export interface FileDropzoneProps extends Omit<BoxProps<'div'>, 'children' | 'onDrop' | 'ref'> {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  files?: readonly File[];
  defaultFiles?: readonly File[];
  onFilesChange?: (files: File[], reason: FileSelectionReason) => void;
  onDrop?: (accepted: File[], rejected: FileRejection[]) => void;
  onReject?: (rejected: FileRejection[]) => void;
  accept?: FileAccept;
  minSize?: number;
  maxSize?: number;
  maxFiles?: number;
  multiple?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  busy?: boolean;
  showPreviews?: boolean;
  chooseLabel?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}
export const FileDropzone = React.forwardRef<HTMLDivElement, FileDropzoneProps>(function FileDropzone(
  { label = 'Files', helperText = 'Choose files or drag and drop them here.', files, defaultFiles = [], onFilesChange, onDrop, onReject,
    accept, minSize, maxSize, maxFiles, multiple = true, disabled = false, readOnly = false, busy = false, showPreviews = true,
    chooseLabel = 'Choose files', inputRef, id, sx, onDragEnter, onDragLeave, onDragOver, ...props }, ref
) {
  const generated = React.useId(); const baseId = id ?? generated;
  const input = React.useRef<HTMLInputElement>(null); React.useImperativeHandle(inputRef, () => input.current!);
  const [selected, setSelected] = useControllableValue<readonly File[]>(files, defaultFiles);
  const [rejections, setRejections] = React.useState<FileRejection[]>([]); const [dragging, setDragging] = React.useState(false); const depth = React.useRef(0);
  const locked = disabled || readOnly || busy;
  React.useEffect(() => { if (locked) { depth.current = 0; setDragging(false); } }, [locked]);
  const add = (incoming: readonly File[]) => {
    if (locked || !incoming.length) return;
    const result = selectFiles(incoming, selected, { accept, minSize, maxSize, maxFiles, multiple });
    setRejections(result.rejected);
    if (result.accepted.length) { setSelected(result.files); onFilesChange?.(result.files, 'add'); }
    if (result.rejected.length) onReject?.(result.rejected);
    onDrop?.(result.accepted, result.rejected);
  };
  const hasFiles = (event: React.DragEvent) => Array.from(event.dataTransfer.types ?? []).includes('Files');
  return <Box {...props} ref={ref} id={id} role="group" aria-labelledby={`${baseId}-label`} aria-busy={busy || undefined}
    sx={[{ display: 'grid', gap: 1.5, minWidth: 0, width: '100%' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    <Typography id={`${baseId}-label`} variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>{label}</Typography>
    <Box sx={{ border: '1px dashed', borderColor: dragging ? 'primary.main' : 'divider', borderRadius: 1.5, bgcolor: dragging ? 'action.selected' : 'background.paper', minWidth: 0 }}
      onDragEnter={(event) => { onDragEnter?.(event); if (hasFiles(event)) { event.preventDefault(); if (!locked) { depth.current++; setDragging(true); } } }}
      onDragLeave={(event) => { onDragLeave?.(event); if (depth.current > 0) { depth.current--; if (!depth.current) setDragging(false); } }}
      onDragOver={(event) => { onDragOver?.(event); if (hasFiles(event)) { event.preventDefault(); event.dataTransfer.dropEffect = locked ? 'none' : 'copy'; } }}
      onDrop={(event) => { event.preventDefault(); depth.current = 0; setDragging(false); add(Array.from(event.dataTransfer.files ?? [])); }}>
      <ActionButton aria-label={chooseLabel} aria-describedby={helperText != null ? `${baseId}-help` : undefined} disabled={locked} variant="text" color="inherit" fullWidth
        onClick={() => input.current?.click()} sx={{ minHeight: 88, p: 3, display: 'flex', flexDirection: 'column', gap: 0.75, borderRadius: 'inherit' }}>
        <Box component="span">{dragging ? 'Drop files here' : chooseLabel}</Box>
        {helperText != null ? <Typography component="span" id={`${baseId}-help`} variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{helperText}</Typography> : null}
      </ActionButton>
      <input ref={input} type="file" hidden aria-label={chooseLabel} accept={acceptTokens(accept).join(',') || undefined} multiple={multiple} disabled={locked}
        onChange={(event) => { add(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
    </Box>
    {rejections.length ? <Alert severity="error" title="Some files were not added" onClose={() => setRejections([])}>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>{rejections.map(({ file, errors }, index) => <li key={index}>{file.name}: {errors.map((error) => error.message).join(' ')}</li>)}</Box>
    </Alert> : null}
    {selected.length ? <SelectedFileList files={selected} disabled={locked} showPreviews={showPreviews} onRemove={readOnly ? undefined : (index) => {
      if (locked) return; const next = selected.filter((_, candidate) => candidate !== index); setSelected(next); onFilesChange?.(next, 'remove');
    }} /> : null}
  </Box>;
});
