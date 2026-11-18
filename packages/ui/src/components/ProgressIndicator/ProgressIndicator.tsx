import * as React from 'react';
import { Box, LinearProgress, Typography, type BoxProps } from '@mui/material';
import { ActionButton } from '../ActionButton';

export interface ProgressIndicatorProps extends Omit<BoxProps, 'color'> {
  label: string;
  /** Omit for indeterminate progress. Values are clamped to 0–100. */
  value?: number;
  status?: React.ReactNode;
  valueText?: string;
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
  onCancel?: () => void;
  cancelLabel?: string;
  cancelDisabled?: boolean;
}
export const ProgressIndicator = React.forwardRef<HTMLDivElement, ProgressIndicatorProps>(function ProgressIndicator(
  { label, value, status, valueText, color = 'primary', onCancel, cancelLabel = 'Cancel', cancelDisabled, sx, ...props }, ref
) {
  const id = React.useId(); const percentage = value === undefined || !Number.isFinite(value) ? undefined : Math.min(100, Math.max(0, value));
  return <Box ref={ref} {...props} sx={[{ minWidth: 0, overflowWrap: 'anywhere' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
      <Typography id={`${id}-label`} variant="body2" sx={{ flex: 1, minWidth: 0 }}>{label}</Typography>
      {percentage !== undefined ? <Typography aria-hidden="true" variant="caption">{Math.round(percentage)}%</Typography> : null}
      {onCancel ? <ActionButton size="small" color="inherit" disabled={cancelDisabled} onClick={onCancel}>{cancelLabel}</ActionButton> : null}
    </Box>
    <LinearProgress color={color} variant={percentage === undefined ? 'indeterminate' : 'determinate'} value={percentage}
      aria-labelledby={`${id}-label`} aria-describedby={status != null ? `${id}-status` : undefined} aria-valuetext={valueText}
      sx={{ height: 4, borderRadius: 1, '@media (prefers-reduced-motion: reduce)': { '&, & *': { animation: 'none', transition: 'none' } } }} />
    {status != null ? <Typography id={`${id}-status`} component="div" variant="caption" color="text.secondary" sx={{ mt: 1 }}>{status}</Typography> : null}
  </Box>;
});
