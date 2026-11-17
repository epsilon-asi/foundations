import * as React from 'react';
import { Box, Divider, Paper, Typography, type PaperProps } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

export interface PanelProps extends Omit<PaperProps, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  density?: 'compact' | 'comfortable';
  headingLevel?: 'h2' | 'h3' | 'h4';
  headerSx?: SxProps<Theme>;
  contentSx?: SxProps<Theme>;
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(function Panel(
  { title, subtitle, headerAction, footer, density = 'comfortable', headingLevel = 'h2', children, headerSx, contentSx,
    sx, variant = 'outlined', ...props }, ref
) {
  const padding = density === 'compact' ? 1.5 : 2;
  const headingId = React.useId();
  return <Paper ref={ref} component="section" aria-labelledby={title != null ? headingId : undefined} variant={variant}
    sx={[{ minWidth: 0, minHeight: 0, overflowWrap: 'anywhere', overflow: 'hidden' },
      ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]} {...props}>
    {title != null || subtitle != null || headerAction != null ? <>
      <Box sx={[{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, p: padding },
        ...(Array.isArray(headerSx) ? headerSx : headerSx ? [headerSx] : [])]}>
        <Box sx={{ minWidth: 0, flex: '1 1 120px' }}>
          {title != null ? <Typography id={headingId} component={headingLevel} variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography> : null}
          {subtitle != null ? <Typography component="div" variant="body2" color="text.secondary">{subtitle}</Typography> : null}
        </Box>
        {headerAction != null ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, minWidth: 0 }}>{headerAction}</Box> : null}
      </Box>
      <Divider />
    </> : null}
    <Box sx={[{ p: padding, minWidth: 0, minHeight: 0 }, ...(Array.isArray(contentSx) ? contentSx : contentSx ? [contentSx] : [])]}>{children}</Box>
    {footer != null ? <><Divider /><Box sx={{ p: padding, display: 'flex', flexWrap: 'wrap', gap: 1 }}>{footer}</Box></> : null}
  </Paper>;
});
