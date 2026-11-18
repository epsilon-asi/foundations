import * as React from 'react';
import { Box, FormHelperText, Slider as MuiSlider, Typography, type SliderProps as MuiSliderProps } from '@mui/material';
import { useTheme } from '@mui/material/styles';

export interface SliderCommonProps extends Omit<MuiSliderProps, 'value' | 'defaultValue' | 'onChange' | 'onChangeCommitted'> {
  label: string;
  helperText?: React.ReactNode;
  error?: boolean;
}
export function SliderControl({ label, helperText, error, id, sx, slotProps, orientation, 'aria-describedby': describedBy, ...props }: SliderCommonProps & MuiSliderProps) {
  const generated = React.useId(); const labelId = `${id ?? generated}-label`; const helperId = `${id ?? generated}-help`;
  const rtl = useTheme().direction === 'rtl';
  const marks = Array.isArray(props.marks) ? props.marks : [];
  const first = marks.findIndex((mark) => mark.value === (props.min ?? 0)); const last = marks.findIndex((mark) => mark.value === (props.max ?? 100));
  return <Box sx={{ minWidth: 0, width: '100%' }}>
    <Typography id={labelId} component="div" variant="body2" sx={{ fontWeight: 600, mb: 0.5, overflowWrap: 'anywhere' }}>{label}</Typography>
    <Box sx={{ px: 1.25, minWidth: 0 }}><MuiSlider {...props} id={id} orientation={orientation} aria-labelledby={props.getAriaLabel ? undefined : labelId}
      slotProps={{ ...slotProps, input: (owner) => { const supplied = typeof slotProps?.input === 'function' ? slotProps.input(owner) : slotProps?.input;
        return { ...supplied, 'aria-invalid': error || supplied?.['aria-invalid'],
          'aria-describedby': [describedBy, supplied?.['aria-describedby'], helperText != null ? helperId : undefined].filter(Boolean).join(' ') || undefined }; } }}
      sx={[{ minWidth: 0, ...(orientation === 'vertical' ? { height: 200 } : { width: '100%' }), '& .MuiSlider-markLabel': {
        maxWidth: orientation === 'vertical' ? 160 : '40%', whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'center' },
        ...(orientation !== 'vertical' ? {
          [`& .MuiSlider-markLabel[data-index="${first}"]`]: { transform: 'none', textAlign: rtl ? 'end' : 'start' },
          [`& .MuiSlider-markLabel[data-index="${last}"]`]: { transform: rtl ? 'translateX(100%)' : 'translateX(-100%)', textAlign: rtl ? 'start' : 'end' }
        } : {}) }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]} /></Box>
    {helperText != null ? <FormHelperText component="div" id={helperId} error={error} sx={{ m: 0, mt: marks.length ? 2.5 : 0, overflowWrap: 'anywhere' }}>{helperText}</FormHelperText> : null}
  </Box>;
}
