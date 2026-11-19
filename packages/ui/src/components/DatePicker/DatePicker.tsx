import * as React from 'react';
import { DatePicker as MuiDatePicker, type DatePickerProps as MuiDatePickerProps } from '@mui/x-date-pickers/DatePicker';
import { pickerDesktopQuery, pickerSlotProps, pickerSlots, type PickerPresentationProps } from '../../internal/pickerPresentation';

export interface DatePickerProps extends Omit<MuiDatePickerProps, 'label'>, PickerPresentationProps { label: string }
export const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>(function DatePicker(
  { density, size, fullWidth, helperText, error, clearable, slots, slotProps, desktopModeMediaQuery = pickerDesktopQuery, ...props }, ref
) {
  return <MuiDatePicker {...props} ref={ref} desktopModeMediaQuery={desktopModeMediaQuery} slots={{ ...pickerSlots, ...slots }}
    slotProps={pickerSlotProps(slotProps, { density, size, fullWidth, helperText, error, clearable })} />;
});
