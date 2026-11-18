import * as React from 'react';
import { Box, type BoxProps } from '@mui/material';

export const Keycap = React.forwardRef<HTMLElement, BoxProps>(function Keycap({ children, sx, ...props }, ref) {
  return <Box component="kbd" ref={ref} {...props} sx={[{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 22, minHeight: 22, px: 1, border: 1, borderColor: 'divider', borderBottomWidth: 2, borderRadius: 0.75,
    bgcolor: 'action.hover', color: 'text.primary', typography: 'caption', fontFamily: 'monospace', fontWeight: 600,
    overflowWrap: 'anywhere', maxWidth: '100%' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>{children}</Box>;
});
export interface ShortcutHintProps extends Omit<BoxProps, 'children'> {
  keys: readonly string[];
  /** Spoken form, e.g. "Command plus Shift plus S". No shortcut is registered. */
  label: string;
  separator?: React.ReactNode;
}
export const ShortcutHint = React.forwardRef<HTMLSpanElement, ShortcutHintProps>(function ShortcutHint(
  { keys, label, separator = '+', sx, ...props }, ref
) {
  return <Box component="span" ref={ref} {...props} role="img" aria-label={label} sx={[{ display: 'inline-flex', flexWrap: 'wrap',
    alignItems: 'center', gap: 0.75, maxWidth: '100%' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    {keys.map((key, index) => <React.Fragment key={`${key}-${index}`}>{index ? <Box component="span" aria-hidden="true" sx={{ color: 'text.secondary' }}>{separator}</Box> : null}<Keycap aria-hidden="true">{key}</Keycap></React.Fragment>)}
  </Box>;
});
