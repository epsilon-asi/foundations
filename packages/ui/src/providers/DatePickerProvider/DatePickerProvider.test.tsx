import { createRef } from 'react';
import { screen } from '@testing-library/react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/fr';
import { frFR } from '@mui/x-date-pickers/locales';
import { renderWithUi } from '../../test/renderWithUi';
import { DatePicker } from '../../components/DatePicker';
import { DateTimePicker } from '../../components/DateTimePicker';
import { DatePickerProvider } from './DatePickerProvider';

dayjs.extend(utc); dayjs.extend(timezone);
it('scopes locales and translated controls to their provider without changing global locale', () => {
  const english = createRef<HTMLInputElement>(); const french = createRef<HTMLInputElement>();
  renderWithUi(<><DatePickerProvider><DatePicker label="English date" value={dayjs('2026-11-18')} inputRef={english} /></DatePickerProvider>
    <DatePickerProvider adapterLocale="fr" localeText={frFR.components.MuiLocalizationProvider.defaultProps.localeText}><DatePicker label="Date française" value={dayjs('2026-11-18')} inputRef={french} /></DatePickerProvider></>);
  expect(english.current).toHaveValue('11/18/2026'); expect(french.current).toHaveValue('18/11/2026'); expect(dayjs.locale()).toBe('en');
  expect(screen.getByRole('button', { name: /Choisir la date/i })).toBeInTheDocument();
});
it('retains MUI timezone behavior for a UTC value displayed in New York', () => {
  renderWithUi(<DatePickerProvider><DateTimePicker label="Publish at" value={dayjs.utc('2026-11-18T18:30:00Z')} timezone="America/New_York" ampm={false} /></DatePickerProvider>);
  expect(screen.getByRole('spinbutton', { name: 'Hours' })).toHaveAttribute('aria-valuenow', '13'); expect(screen.getByRole('spinbutton', { name: 'Day' })).toHaveAttribute('aria-valuenow', '18');
});
