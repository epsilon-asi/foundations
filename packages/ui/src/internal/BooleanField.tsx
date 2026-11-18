import * as React from 'react';
import { Box, FormControlLabel, FormHelperText } from '@mui/material';

export interface BooleanFieldProps {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: boolean;
  required?: boolean;
}
export function BooleanField({ label, helperText, error, required, helperId, control }: BooleanFieldProps & { helperId: string; control: React.ReactElement }) {
  return <Box sx={{ minWidth: 0, maxWidth: '100%' }}>
    {label != null ? <FormControlLabel control={control} label={label} required={required} sx={{ m: 0, maxWidth: '100%', alignItems: 'center',
      '& .MuiFormControlLabel-asterisk': { color: error ? 'error.main' : undefined },
      '& .MuiFormControlLabel-label': { minWidth: 0, overflowWrap: 'anywhere' } }} /> : control}
    {helperText != null ? <FormHelperText component="div" id={helperId} error={error} sx={{ m: 0, mt: 0.5, overflowWrap: 'anywhere' }}>{helperText}</FormHelperText> : null}
  </Box>;
}
