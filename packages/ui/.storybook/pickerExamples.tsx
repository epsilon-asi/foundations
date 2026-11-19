import * as React from 'react';
import type { Decorator } from '@storybook/react-vite';
import { Box } from '@mui/material';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { frFR } from '@mui/x-date-pickers/locales';
import { DatePickerProvider } from '../src/providers/DatePickerProvider';

dayjs.extend(utc); dayjs.extend(timezone);
// Construct dates inside render, rather than serializing Day.js instances in args.
export const exampleDate = () => dayjs('2026-11-18T13:30:00');
export const desktopPicker = '@media (min-width: 0px)';
export const mobilePicker = '@media (min-width: 99999px)';
export const withDatePickers: Decorator = Story => <DatePickerProvider><Box sx={{ width: 340, maxWidth: '100%', minWidth: 0, pt: 1 }}><Story /></Box></DatePickerProvider>;
export const withFrenchPickers: Decorator = Story => <DatePickerProvider adapterLocale="fr" localeText={frFR.components.MuiLocalizationProvider.defaultProps.localeText}><Story /></DatePickerProvider>;
