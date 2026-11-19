import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import dayjs from 'dayjs';
import { renderWithPickers } from '../../test/renderWithPickers';
import { mockMenuAnchorLayout } from '../../test/menuTriggerContract';
import { DateTimePicker } from './DateTimePicker';

const value = dayjs('2026-11-18T13:30:00'); const desktopModeMediaQuery = '@media (min-width: 0px)';
beforeEach(() => {
  mockMenuAnchorLayout();
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: !query.includes('99999'), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
}); afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('combines date and time selection and forwards the accepted Day.js value', async () => {
  const accepted = vi.fn(); renderWithPickers(<DateTimePicker label="Publish at" defaultValue={value} ampm={false} onAccept={accepted} reduceAnimations desktopModeMediaQuery={desktopModeMediaQuery} />);
  fireEvent.click(screen.getByRole('button', { name: /choose date/i }));
  fireEvent.click(screen.getByRole('gridcell', { name: '20' }));
  fireEvent.click(within(screen.getByRole('listbox', { name: /hours/i })).getByRole('option', { name: '16 hours' }));
  fireEvent.click(within(screen.getByRole('listbox', { name: /minutes/i })).getByRole('option', { name: '45 minutes' }));
  fireEvent.click(screen.getByRole('button', { name: 'OK' })); expect(accepted.mock.calls.at(-1)?.[0].format('YYYY-MM-DDTHH:mm')).toBe('2026-11-20T16:45');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('passes combined date/time boundaries through to validation and acceptance', async () => {
  const error = vi.fn(); renderWithPickers(<DateTimePicker label="Publish at" value={value} minDateTime={value.hour(14)} onError={error} helperText="Must be after 14:30" ampm={false} reduceAnimations desktopModeMediaQuery={desktopModeMediaQuery} />);
  await waitFor(() => expect(error).toHaveBeenCalledWith('minTime', expect.anything())); expect(screen.getByRole('group', { name: 'Publish at' })).toHaveAttribute('aria-invalid', 'true');
  fireEvent.click(screen.getByRole('button', { name: /choose date/i })); expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();
});
it('supports controlled rerenders, custom field slots and error/help composition', () => {
  const { rerender } = renderWithPickers(<DateTimePicker label="Publish at" value={value} ampm={false} slotProps={{ textField: () => ({ helperText: 'Slot help', required: true }) }} />);
  expect(screen.getByRole('group', { name: /Publish at/ })).toHaveAccessibleDescription('Slot help');
  rerender(<DateTimePicker label="Publish at" value={value.date(22).hour(18)} ampm={false} helperText="Application help" error />);
  expect(screen.getByRole('spinbutton', { name: 'Day' })).toHaveAttribute('aria-valuenow', '22'); expect(screen.getByRole('spinbutton', { name: 'Hours' })).toHaveAttribute('aria-valuenow', '18');
  expect(screen.getByRole('group', { name: 'Publish at' })).toHaveAccessibleDescription('Application help'); expect(screen.getByRole('group', { name: 'Publish at' })).toHaveAttribute('aria-invalid', 'true');
});
it('preserves mobile stepping, cancellation and callback contracts', async () => {
  const cancelled = vi.fn(); const closed = vi.fn(); renderWithPickers(<DateTimePicker label="Publish at" defaultValue={value} ampm={false} onCancel={cancelled} onClose={closed}
    reduceAnimations desktopModeMediaQuery="@media (min-width: 99999px)" />);
  const trigger = screen.getByRole('button', { name: /choose date/i }); trigger.focus(); fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(cancelled).toHaveBeenCalledTimes(1); expect(closed).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(trigger).toHaveFocus();
});
it('prevents editing when disabled or read-only', () => {
  const change = vi.fn(); const { rerender } = renderWithPickers(<DateTimePicker label="Publish at" value={value} disabled onChange={change} />);
  expect(screen.getByRole('button', { name: /choose date/i })).toBeDisabled(); rerender(<DateTimePicker label="Publish at" value={value} readOnly onChange={change} />);
  fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Hours' }), { key: 'ArrowUp' }); expect(change).not.toHaveBeenCalled();
});
it('lets mobile users advance from an invalid time and accept only a valid value', async () => {
  const accepted = vi.fn(); renderWithPickers(<DateTimePicker label="Publish at" defaultValue={value} minDateTime={value.hour(14)} ampm={false}
    onAccept={accepted} reduceAnimations desktopModeMediaQuery="@media (min-width: 99999px)" />);
  fireEvent.click(screen.getByRole('button', { name: /choose date/i }));
  const next = screen.getByRole('button', { name: 'Next' }); expect(next).toBeEnabled(); fireEvent.click(next);
  await waitFor(() => expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled());
  expect(accepted).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
});
