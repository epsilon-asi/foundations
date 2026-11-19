import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import dayjs from 'dayjs';
import { renderWithPickers } from '../../test/renderWithPickers';
import { mockMenuAnchorLayout } from '../../test/menuTriggerContract';
import { TimePicker } from './TimePicker';

const value = dayjs('2026-11-18T13:30:00'); const desktopModeMediaQuery = '@media (min-width: 0px)';
beforeEach(() => {
  mockMenuAnchorLayout();
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: !query.includes('99999'), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
}); afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('supports 24-hour field editing and forwards change context', async () => {
  const change = vi.fn(); renderWithPickers(<TimePicker label="Start time" defaultValue={value} ampm={false} selectedSections="minutes" onChange={change} helperText="Local start time" />);
  expect(screen.getByRole('group', { name: 'Start time' })).toHaveAccessibleDescription('Local start time');
  const minutes = screen.getByRole('spinbutton', { name: 'Minutes' }); await act(async () => minutes.focus()); fireEvent.keyDown(minutes, { key: 'ArrowUp' });
  await waitFor(() => expect(change).toHaveBeenCalledTimes(1)); expect(change.mock.calls[0][0].format('HH:mm')).toBe('13:31'); expect(change.mock.calls[0][1]).toEqual(expect.objectContaining({ validationError: null }));
});
it('selects hours/minutes and accepts through our action bar', async () => {
  const accepted = vi.fn(); const change = vi.fn(); renderWithPickers(<TimePicker label="Start time" defaultValue={value} ampm={false} onChange={change} onAccept={accepted} reduceAnimations desktopModeMediaQuery={desktopModeMediaQuery} />);
  const trigger = screen.getByRole('button', { name: /choose time/i }); trigger.focus(); fireEvent.click(trigger);
  const hours = screen.getByRole('listbox', { name: /hours/i }); const minutes = screen.getByRole('listbox', { name: /minutes/i });
  fireEvent.click(within(hours).getByRole('option', { name: '15 hours' })); fireEvent.click(within(minutes).getByRole('option', { name: '45 minutes' }));
  fireEvent.click(screen.getByRole('button', { name: 'OK' })); expect(accepted.mock.calls.at(-1)?.[0].format('HH:mm')).toBe('15:45'); expect(change).toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(trigger).toHaveFocus();
});
it('preserves 12-hour fields and disabled/readonly behavior', () => {
  const change = vi.fn(); const { rerender } = renderWithPickers(<TimePicker label="Start time" value={value} ampm disabled onChange={change} />);
  expect(screen.getByRole('button', { name: /choose time/i })).toBeDisabled();
  rerender(<TimePicker label="Start time" value={value} ampm readOnly onChange={change} />);
  expect(screen.getByRole('spinbutton', { name: 'Hours' })).toHaveAttribute('aria-valuenow', '1'); expect(screen.getByRole('spinbutton', { name: 'Meridiem' })).toHaveTextContent('PM');
  fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Minutes' }), { key: 'ArrowUp' }); expect(change).not.toHaveBeenCalled();
});
it('disables unavailable time options and reports step/range validation', async () => {
  const change = vi.fn(); const error = vi.fn(); renderWithPickers(<TimePicker label="Start time" defaultValue={value} ampm={false} minTime={value.hour(9).minute(0)} maxTime={value.hour(17).minute(0)}
    shouldDisableTime={(date, view) => view === 'minutes' && date.minute() === 30} onChange={change} onError={error} reduceAnimations desktopModeMediaQuery={desktopModeMediaQuery} />);
  await waitFor(() => expect(error).toHaveBeenCalledWith('shouldDisableTime-minutes', expect.anything())); fireEvent.click(screen.getByRole('button', { name: /choose time/i }));
  expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();
  const unavailable = within(screen.getByRole('listbox', { name: /hours/i })).getByRole('option', { name: '18 hours' }); expect(unavailable).toHaveAttribute('aria-disabled', 'true');
  // MUI disables pointer interaction on MenuItem; dispatching fireEvent.click
  // directly bypasses that browser behavior.
  expect(unavailable).toHaveStyle({ pointerEvents: 'none' }); expect(change).not.toHaveBeenCalled();
});
it('keeps caller-provided action slots, clearing and minute precision', async () => {
  const change = vi.fn(); renderWithPickers(<TimePicker label="Start time" defaultValue={value} ampm={false} onChange={change} timeSteps={{ minutes: 15 }} minutesStep={15}
    slotProps={{ actionBar: { actions: ['clear', 'cancel', 'accept'] } }} reduceAnimations desktopModeMediaQuery={desktopModeMediaQuery} />);
  fireEvent.click(screen.getByRole('button', { name: /choose time/i })); expect(within(screen.getByRole('listbox', { name: /minutes/i })).getAllByRole('option')).toHaveLength(4);
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear' })); expect(change).toHaveBeenCalledWith(null, expect.objectContaining({ validationError: null }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('dismisses with Escape and allows field clearing to be disabled', async () => {
  renderWithPickers(<TimePicker label="Start time" defaultValue={value} clearable={false} reduceAnimations desktopModeMediaQuery={desktopModeMediaQuery} />);
  expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: /choose time/i }); trigger.focus(); fireEvent.click(trigger);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(trigger).toHaveFocus();
});
