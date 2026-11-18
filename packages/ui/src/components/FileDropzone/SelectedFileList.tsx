import * as React from 'react';
import { Box, SvgIcon, Typography } from '@mui/material';
import { List, ListItem, type ListProps } from '../List';
import { IconButton } from '../IconButton';
import { CloseIcon } from '../../internal/CloseIcon';
import { fileKey } from '../../internal/fileSelection';

function Preview({ file }: { file: File }) {
  const [url, setUrl] = React.useState<string | null>(null); const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    setFailed(false);
    if (!file.type.startsWith('image/') || typeof URL.createObjectURL !== 'function') { setUrl(null); return; }
    const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next);
  }, [file]);
  return <Box aria-hidden sx={{ display: 'flex', width: 40, height: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden' }}>
    {url && !failed ? <Box component="img" alt="" src={url} onError={() => setFailed(true)} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : <SvgIcon><path d="M6 2h8l4 4v16H6V2zm7 1v5h4M8 12h8v2H8zm0 4h8v2H8z" /></SvgIcon>}
  </Box>;
}
export interface SelectedFileListProps extends Omit<ListProps<'ul'>, 'children' | 'onChange' | 'ref'> {
  files: readonly File[];
  onRemove?: (index: number) => void;
  disabled?: boolean;
  showPreviews?: boolean;
}
export const SelectedFileList = React.forwardRef<HTMLUListElement, SelectedFileListProps>(function SelectedFileList(
  { files, onRemove, disabled, showPreviews = true, sx, 'aria-label': label = 'Selected files', ...props }, ref
) {
  return <List {...props} ref={ref} aria-label={label} disablePadding sx={[{ minWidth: 0, display: 'grid', gap: 1 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    {files.map((file, index) => <ListItem key={`${fileKey(file)}:${index}`} sx={{ gap: 1.25, p: 1, border: 1, borderColor: 'divider', borderRadius: 1, minWidth: 0 }}>
      {showPreviews ? <Preview file={file} /> : null}
      <Box sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}><Typography variant="body2">{file.name}</Typography>
        <Typography variant="caption" color="text.secondary">{file.size < 1024 ? `${file.size} bytes` : file.size < 1048576 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1048576).toFixed(1)} MB`}</Typography></Box>
      {onRemove ? <IconButton aria-label={`Remove ${file.name}`} outlined={false} size="small" disabled={disabled} onClick={() => onRemove(index)}><CloseIcon /></IconButton> : null}
    </ListItem>)}
  </List>;
});
