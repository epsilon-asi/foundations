import * as React from 'react';
import { Box, Typography, type BoxProps } from '@mui/material';
import { ActionButton } from '../ActionButton';

export interface InspectorControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  required?: boolean;
}
export interface InspectorRowProps extends Omit<BoxProps, 'children'> {
  label: React.ReactNode;
  controlId?: string;
  description?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  mixed?: boolean;
  mixedLabel?: React.ReactNode;
  onReset?: () => void;
  resetLabel?: string;
  resetDisabled?: boolean;
  children: React.ReactNode | ((props: InspectorControlProps) => React.ReactNode);
}

/** The render function wires field semantics without owning the field's state. */
export const InspectorRow = React.forwardRef<HTMLDivElement, InspectorRowProps>(function InspectorRow(
  { label, controlId, description, error, required, mixed = false, mixedLabel = 'Multiple values', onReset,
    resetLabel = 'Reset value', resetDisabled, children, sx, ...props }, ref
) {
  const generated = React.useId(); const id = controlId ?? generated;
  const help = [description != null ? `${id}-description` : undefined, error != null ? `${id}-error` : undefined,
    mixed ? `${id}-mixed` : undefined].filter(Boolean).join(' ') || undefined;
  return <Box ref={ref} {...props} sx={[{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, var(--ui-field-label-width, 120px)) minmax(0, 1fr)' },
    alignItems: 'start', columnGap: 2, rowGap: 1, minWidth: 0, py: 1, overflowWrap: 'anywhere' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    <Typography component="label" htmlFor={id} variant="body2" sx={{ fontWeight: 600, pt: 1 }}>{label}{required ? <Box component="span" aria-hidden="true"> *</Box> : null}</Typography>
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'start', gap: 1, minWidth: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>{typeof children === 'function' ? children({ id, 'aria-describedby': help, 'aria-invalid': error != null || undefined, required }) : children}</Box>
        {onReset ? <ActionButton size="small" variant="text" color="inherit" disabled={resetDisabled} onClick={onReset}>{resetLabel}</ActionButton> : null}
      </Box>
      {mixed ? <Typography id={`${id}-mixed`} variant="caption" color="text.secondary">{mixedLabel}</Typography> : null}
      {description != null ? <Typography id={`${id}-description`} component="div" variant="caption" color="text.secondary">{description}</Typography> : null}
      {error != null ? <Typography id={`${id}-error`} component="div" variant="caption" color="error.main">{error}</Typography> : null}
    </Box>
  </Box>;
});

export interface FieldGroupProps extends Omit<BoxProps, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  labelWidth?: number | string;
}
export const FieldGroup = React.forwardRef<HTMLFieldSetElement, FieldGroupProps>(function FieldGroup(
  { title, description, disabled, labelWidth = 120, children, sx, ...props }, ref
) {
  const id = React.useId();
  return <Box component="fieldset" ref={ref} {...props} disabled={disabled} aria-describedby={description != null ? id : undefined}
    sx={[{ m: 0, p: 0, border: 0, minWidth: 0, overflowWrap: 'anywhere', '--ui-field-label-width': typeof labelWidth === 'number' ? `${labelWidth}px` : labelWidth,
      '&:disabled': { opacity: 0.6 } }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    <Typography component="legend" variant="subtitle2" sx={{ p: 0, mb: 1, overflowWrap: 'anywhere' }}>{title}</Typography>
    {description != null ? <Typography id={id} variant="body2" color="text.secondary" sx={{ mb: 2 }}>{description}</Typography> : null}
    {children}
  </Box>;
});
