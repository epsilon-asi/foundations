import * as React from 'react';
import { Box, Chip, Tooltip, type ChipProps } from '@mui/material';
import { alpha, darken, lighten, useTheme } from '@mui/material/styles';

import { contrastInk } from '../../theme/category';

export type StatusBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';
export interface StatusBadgeProps extends Omit<ChipProps, 'label' | 'color' | 'icon' | 'variant' | 'onDelete' | 'onClick' | 'clickable' | 'component' | 'children' | 'ref'> {
  label: string;
  tone?: StatusBadgeTone;
  variant?: 'soft' | 'outlined' | 'solid';
  display?: 'badge' | 'dot';
  indicator?: boolean;
  icon?: React.ReactElement;
  pulse?: boolean;
  tooltip?: React.ReactNode;
}

/** Presentation only: applications map their own domain states to labels and tones. */
export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(function StatusBadge(
  { label, tone = 'neutral', variant = 'soft', display = 'badge', icon, indicator = true, pulse = false,
    tooltip, size = 'small', sx, ...props }, ref
) {
  const theme = useTheme();
  const palette = tone === 'neutral' ? null : theme.palette[tone];
  const main = palette?.main ?? theme.palette.text.secondary;
  const foreground = palette ? theme.palette.mode === 'dark' ? lighten(palette.light, 0.15) : darken(palette.dark, 0.15) : theme.palette.text.primary;
  const solidText = contrastInk(main, theme.palette.common);
  const dot = <Box component="span" aria-hidden="true" sx={{ display: 'inline-block', flexShrink: 0, width: 7, height: 7,
    borderRadius: '50%', bgcolor: 'currentColor',
    ...(pulse ? { animation: 'ui-status-pulse 1.8s ease-in-out infinite',
      '@keyframes ui-status-pulse': { '0%, 100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.5, transform: 'scale(1.25)' } },
      '@media (prefers-reduced-motion: reduce)': { animation: 'none' } } : {}) }} />;
  const content = display === 'dot' ? <Box component="span" ref={ref} role="img" aria-label={label} tabIndex={0}
    {...props} sx={[{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size === 'small' ? 20 : 28,
      height: size === 'small' ? 20 : 28, color: main, borderRadius: '50%',
      '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } },
      ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>{dot}</Box>
    : <Chip component="span" ref={ref} label={label} size={size} icon={icon ?? (indicator ? dot : undefined)}
      variant={variant === 'outlined' ? 'outlined' : 'filled'} {...props}
      sx={[{ maxWidth: '100%', height: 'auto', minHeight: size === 'small' ? 24 : 32, py: 0.25,
        color: variant === 'solid' ? solidText : foreground,
        bgcolor: variant === 'solid' ? main : variant === 'soft' ? alpha(main, 0.12) : 'transparent',
        borderColor: variant === 'outlined' ? alpha(main, 0.5) : 'transparent',
        '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere' },
        '& .MuiChip-icon': { color: 'inherit', ml: 1.25, mr: 0 } }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]} />;
  return tooltip != null || display === 'dot' ? <Tooltip title={tooltip ?? label} describeChild>{content}</Tooltip> : content;
});
