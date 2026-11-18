import * as React from 'react';
import { Checkbox as MuiCheckbox, type CheckboxProps as MuiCheckboxProps } from '@mui/material';
import { BooleanField, type BooleanFieldProps } from '../../internal/BooleanField';
import { useControllableValue } from '../../internal/useControllableValue';

export interface CheckboxProps extends MuiCheckboxProps, BooleanFieldProps { readOnly?: boolean }
export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { label, helperText, error, readOnly = false, checked, defaultChecked = false, onChange, disabled, indeterminate, id, slotProps, ...props }, ref
) {
  const generated = React.useId(); const inputId = id ?? generated; const helperId = `${inputId}-help`;
  const [value, setValue] = useControllableValue(checked, defaultChecked);
  return <BooleanField label={label} helperText={helperText} error={error} required={props.required} helperId={helperId} control={
    <MuiCheckbox {...props} id={inputId} ref={ref} checked={value} disabled={disabled} indeterminate={indeterminate} onChange={(event, next) => {
      if (disabled || readOnly) { event.target.checked = value; return; }
      setValue(next); onChange?.(event, next);
    }} slotProps={{ ...slotProps, input: (owner) => {
      const supplied = typeof slotProps?.input === 'function' ? slotProps.input(owner) : slotProps?.input;
      return { ...supplied, readOnly, 'aria-readonly': readOnly || undefined, 'aria-checked': indeterminate ? 'mixed' : supplied?.['aria-checked'],
        'aria-describedby': [supplied?.['aria-describedby'], helperText != null ? helperId : undefined].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error || supplied?.['aria-invalid'] };
    } }} />
  } />;
});
