import * as React from 'react';
import { DateTimePicker as MuiDateTimePicker, type DateTimePickerProps as MuiDateTimePickerProps } from '@mui/x-date-pickers/DateTimePicker';
import { pickerDesktopQuery, pickerSlotProps, pickerSlots, type PickerPresentationProps } from '../../internal/pickerPresentation';

export interface DateTimePickerProps extends Omit<MuiDateTimePickerProps, 'label'>, PickerPresentationProps { label: string }
export const DateTimePicker = React.forwardRef<HTMLDivElement, DateTimePickerProps>(function DateTimePicker(
  { density, size, fullWidth, helperText, error, clearable, slots, slotProps, desktopModeMediaQuery = pickerDesktopQuery, ...props }, ref
) {
  return <MuiDateTimePicker {...props} ref={ref} desktopModeMediaQuery={desktopModeMediaQuery} slots={{ ...pickerSlots, ...slots }}
    slotProps={pickerSlotProps(slotProps, { density, size, fullWidth, helperText, error, clearable })} />;
});
