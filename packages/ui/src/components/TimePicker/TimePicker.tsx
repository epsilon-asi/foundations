import * as React from 'react';
import { TimePicker as MuiTimePicker, type TimePickerProps as MuiTimePickerProps } from '@mui/x-date-pickers/TimePicker';
import { pickerDesktopQuery, pickerSlotProps, pickerSlots, type PickerPresentationProps } from '../../internal/pickerPresentation';

export interface TimePickerProps extends Omit<MuiTimePickerProps, 'label'>, PickerPresentationProps { label: string }
export const TimePicker = React.forwardRef<HTMLDivElement, TimePickerProps>(function TimePicker(
  { density, size, fullWidth, helperText, error, clearable, slots, slotProps, desktopModeMediaQuery = pickerDesktopQuery, ...props }, ref
) {
  return <MuiTimePicker {...props} ref={ref} desktopModeMediaQuery={desktopModeMediaQuery} slots={{ ...pickerSlots, ...slots }}
    slotProps={pickerSlotProps(slotProps, { density, size, fullWidth, helperText, error, clearable })} />;
});
