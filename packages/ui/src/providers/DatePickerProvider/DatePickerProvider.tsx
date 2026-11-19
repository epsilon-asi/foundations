import * as React from 'react';
import { LocalizationProvider, type LocalizationProviderProps } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import type { Dayjs } from 'dayjs';

export type DatePickerValue = Dayjs | null;
export interface DatePickerProviderProps extends Omit<LocalizationProviderProps<string>, 'dateAdapter' | 'dateLibInstance' | 'dateFormats'> {
  dateFormats?: Partial<AdapterDayjs['formats']>;
}
/** Place once around a screen/app, alongside UiProvider. Locale changes stay scoped. */
export function DatePickerProvider({ children, ...props }: DatePickerProviderProps) {
  return <LocalizationProvider {...props} dateAdapter={AdapterDayjs}>{children}</LocalizationProvider>;
}
