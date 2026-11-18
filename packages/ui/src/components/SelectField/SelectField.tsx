import * as React from 'react';
import { FormControl, FormHelperText, InputLabel, NativeSelect } from '@mui/material';

export interface SelectFieldProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'defaultValue' | 'multiple'> {
  value?: string | number | null;
  defaultValue?: string | number;
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: boolean;
  fullWidth?: boolean;
}

/** A single-value native select. Supply option/optgroup children, including an empty option for null. */
export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { id, label, helperText, error, fullWidth, required, disabled, value, defaultValue, onChange,
    children, 'aria-describedby': describedBy, ...nativeProps }, ref
) {
  const generatedId = React.useId();
  const selectId = id ?? generatedId;
  const helpId = helperText != null ? `${selectId}-help` : undefined;
  const description = [describedBy, helpId].filter(Boolean).join(' ') || undefined;
  return (
    <FormControl variant="standard" size="small" fullWidth={fullWidth}
      required={required} disabled={disabled} error={error} sx={{ minWidth: 0 }}>
      {label != null && <InputLabel htmlFor={selectId} shrink>{label}</InputLabel>}
      <NativeSelect inputRef={ref} value={value === null ? '' : value} defaultValue={defaultValue}
        onChange={onChange} inputProps={{ ...nativeProps, id: selectId, 'aria-describedby': description }}>
        {children}
      </NativeSelect>
      {helpId && <FormHelperText component="span" id={helpId}>{helperText}</FormHelperText>}
    </FormControl>
  );
});
