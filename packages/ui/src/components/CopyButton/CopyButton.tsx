import * as React from 'react';
import { Box, SvgIcon, Typography, type BoxProps } from '@mui/material';
import { IconButton, type IconButtonProps } from '../IconButton';
import { CheckGlyph } from '../../internal/icons';

export interface CopyButtonProps extends Omit<IconButtonProps, 'children' | 'onClick' | 'aria-label'> {
  value: string;
  'aria-label'?: string;
  copiedLabel?: string;
  errorLabel?: string;
  copyingLabel?: string;
  /** Zero keeps feedback until the next copy or value change. */
  resetAfter?: number;
  copy?: (value: string) => Promise<void>;
  onCopied?: (value: string) => void;
  onCopyError?: (error: Error) => void;
}
async function writeClipboard(value: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable');
  await navigator.clipboard.writeText(value);
}
export const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(function CopyButton(
  { value, 'aria-label': label = 'Copy value', copiedLabel = 'Copied', errorLabel = 'Unable to copy. Try again.', copyingLabel = 'Copying',
    resetAfter = 2000, copy = writeClipboard, onCopied, onCopyError, disabled, tooltip, 'aria-describedby': describedBy, ...props }, ref
) {
  const id = React.useId(); const [state, setState] = React.useState<'idle' | 'copying' | 'success' | 'error'>('idle');
  const version = React.useRef(0); const busy = React.useRef(false); const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  React.useEffect(() => { version.current++; busy.current = false; setState('idle'); clearTimeout(timer.current);
    return () => { version.current++; clearTimeout(timer.current); }; }, [value]);
  const feedback = state === 'success' ? copiedLabel : state === 'error' ? errorLabel : state === 'copying' ? copyingLabel : '';
  const perform = async () => {
    if (disabled || busy.current) return;
    busy.current = true; const request = version.current; clearTimeout(timer.current); setState('copying');
    let failure: Error | undefined;
    try { await copy(value); } catch (error) { failure = error instanceof Error ? error : new Error('Unable to copy'); }
    if (request !== version.current) return;
    busy.current = false; setState(failure ? 'error' : 'success');
    if (resetAfter > 0 && Number.isFinite(resetAfter)) timer.current = setTimeout(() => setState('idle'), resetAfter);
    if (failure) onCopyError?.(failure); else onCopied?.(value);
  };
  return <Box component="span" sx={{ display: 'inline-flex', position: 'relative', flexShrink: 0 }}>
    <IconButton ref={ref} {...props} aria-label={label} disabled={disabled || state === 'copying'} aria-busy={state === 'copying' || undefined}
      aria-describedby={[describedBy, feedback ? id : undefined].filter(Boolean).join(' ') || undefined} tooltip={feedback || tooltip || label} onClick={perform}>
      {state === 'success' ? <CheckGlyph fontSize="small" /> : state === 'error' ? <SvgIcon fontSize="small"><path d="M11 3h2v12h-2Zm0 14h2v3h-2Z" /></SvgIcon>
        : <SvgIcon fontSize="small"><path d="M8 7h12v15H8Zm2 2v11h8V9ZM4 2h12v3H6v12H4Z" /></SvgIcon>}
    </IconButton>
    <Box component="span" id={id} role="status" sx={{ position: 'absolute', left: 0, top: 0, width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>{feedback}</Box>
  </Box>;
});

export interface CopyableValueProps extends Omit<BoxProps, 'children'> {
  value: string;
  label?: React.ReactNode;
  displayValue?: React.ReactNode;
  wrap?: boolean;
  monospace?: boolean;
  copyButtonProps?: Omit<CopyButtonProps, 'value'>;
}
export const CopyableValue = React.forwardRef<HTMLDivElement, CopyableValueProps>(function CopyableValue(
  { value, label, displayValue, wrap = true, monospace = true, copyButtonProps, sx, ...props }, ref
) {
  return <Box ref={ref} {...props} sx={[{ minWidth: 0 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    {label != null ? <Typography component="div" variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere', mb: 1 }}>{label}</Typography> : null}
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', minWidth: 0 }}>
      <Box component={monospace ? 'code' : 'span'} sx={{ minWidth: 0, flex: 1, typography: 'body2', fontFamily: monospace ? 'monospace' : 'inherit',
        ...(wrap ? { overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' } : { overflow: 'auto', whiteSpace: 'pre' }) }}>{displayValue ?? value}</Box>
      <CopyButton {...copyButtonProps} value={value} />
    </Box>
  </Box>;
});
