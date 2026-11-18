import * as React from 'react';
import { Switch as MuiSwitch, type SwitchProps as MuiSwitchProps } from '@mui/material';
import { BooleanField, type BooleanFieldProps } from '../../internal/BooleanField';
import { useControllableValue } from '../../internal/useControllableValue';

export interface SwitchProps extends MuiSwitchProps, BooleanFieldProps { readOnly?: boolean }
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { label, helperText, error, readOnly = false, checked, defaultChecked = false, onChange, disabled, id, slotProps, sx, ...props }, ref
) {
  const generated = React.useId(); const inputId = id ?? generated; const helperId = `${inputId}-help`;
  const [value, setValue] = useControllableValue(checked, defaultChecked);
  return <BooleanField label={label} helperText={helperText} error={error} required={props.required} helperId={helperId} control={
    <MuiSwitch {...props} id={inputId} ref={ref} checked={value} disabled={disabled} onChange={(event, next) => {
      if (disabled || readOnly) { event.target.checked = value; return; }
      setValue(next); onChange?.(event, next);
    }} slotProps={{ ...slotProps, input: (owner) => {
      const supplied = typeof slotProps?.input === 'function' ? slotProps.input(owner) : slotProps?.input;
      return { ...supplied, readOnly, 'aria-readonly': readOnly || undefined,
        'aria-describedby': [supplied?.['aria-describedby'], helperText != null ? helperId : undefined].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error || supplied?.['aria-invalid'] };
    } }} sx={[{ flexShrink: 0, '& .MuiSwitch-track': { borderRadius: 999 }, '& .MuiSwitch-thumb': { boxShadow: 'none' } },
      ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]} />
  } />;
});
