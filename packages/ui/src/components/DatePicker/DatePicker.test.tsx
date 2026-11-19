import { createRef, useState } from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import dayjs from 'dayjs';
import { renderWithPickers } from '../../test/renderWithPickers';
import { mockMenuAnchorLayout } from '../../test/menuTriggerContract';
import { DatePicker } from './DatePicker';

const value = dayjs('2026-11-18T13:30:00');
const desktopModeMediaQuery = '@media (min-width: 0px)';
beforeEach(() => {
  mockMenuAnchorLayout();
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: !query.includes('99999'), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('labels its segmented field, connects helper text, forwards refs and submits a formatted native value', () => {
  const root = createRef<HTMLDivElement>(); const input = createRef<HTMLInputElement>();
  renderWithPickers(<form aria-label="Schedule"><DatePicker ref={root} inputRef={input} label="Due date" defaultValue={value} name="dueDate" helperText="Choose the delivery date" desktopModeMediaQuery={desktopModeMediaQuery} /></form>);
  expect(screen.getByRole('group', { name: 'Due date' })).toHaveAccessibleDescription('Choose the delivery date');
  expect(screen.getByRole('spinbutton', { name: 'Day' })).toHaveAttribute('aria-valuenow', '18');
  expect(root.current).toContainElement(input.current); expect(input.current).toHaveAttribute('name', 'dueDate');
  expect(new FormData(screen.getByRole('form') as HTMLFormElement).get('dueDate')).toBe('11/18/2026');
});
it('selects a valid day, forwards current callbacks and restores opening-button focus', async () => {
  const change = vi.fn(); const accept = vi.fn(); const closed = vi.fn();
  renderWithPickers(<DatePicker label="Due date" defaultValue={value} onChange={change} onAccept={accept} onClose={closed} reduceAnimations desktopModeMediaQuery={desktopModeMediaQuery} />);
  const trigger = screen.getByRole('button', { name: /choose date/i }); trigger.focus(); fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('gridcell', { name: '20' }));
  expect(change).toHaveBeenCalledTimes(1); expect(change.mock.calls[0][0].format('YYYY-MM-DD')).toBe('2026-11-20');
  expect(change.mock.calls[0][1]).toEqual(expect.objectContaining({ validationError: null, source: 'view' }));
  expect(accept).toHaveBeenCalledTimes(1); expect(closed).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(trigger).toHaveFocus();
});
it('forwards min/max/custom date validation and prevents invalid acceptance', () => {
  const change = vi.fn(); renderWithPickers(<DatePicker label="Due date" defaultValue={value} minDate={dayjs('2026-11-15')} maxDate={dayjs('2026-11-22')}
    shouldDisableDate={date => date.date() === 20} onChange={change} reduceAnimations desktopModeMediaQuery={desktopModeMediaQuery} />);
  fireEvent.click(screen.getByRole('button', { name: /choose date/i }));
  for (const day of ['14','20','23']) { const cell = screen.getByRole('gridcell', { name: day }); expect(cell).toBeDisabled(); fireEvent.click(cell); }
  expect(change).not.toHaveBeenCalled();
});
it('preserves MUI keyboard navigation and Escape dismissal', async () => {
  renderWithPickers(<DatePicker label="Due date" defaultValue={value} reduceAnimations desktopModeMediaQuery={desktopModeMediaQuery} />);
  const trigger = screen.getByRole('button', { name: /choose date/i }); trigger.focus(); fireEvent.click(trigger);
  const day = screen.getByRole('gridcell', { name: '18' }); await waitFor(() => expect(day).toHaveFocus());
  fireEvent.keyDown(day, { key: 'ArrowRight' }); expect(screen.getByRole('gridcell', { name: '19' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' }); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(trigger).toHaveFocus();
});
it('retains typed field edits and emits MUI validation context', async () => {
  const change = vi.fn(); renderWithPickers(<DatePicker label="Due date" defaultValue={value} onChange={change} selectedSections="day" desktopModeMediaQuery={desktopModeMediaQuery} />);
  const day = screen.getByRole('spinbutton', { name: 'Day' }); await act(async () => day.focus()); fireEvent.keyDown(day, { key: 'ArrowUp' });
  await waitFor(() => expect(change).toHaveBeenCalledTimes(1)); expect(change.mock.calls[0][0].date()).toBe(19); expect(change.mock.calls[0][1]).toEqual(expect.objectContaining({ validationError: null }));
});
it('shows inherited validation, composes functional field slots and keeps application errors additive', async () => {
  const error = vi.fn(); const { rerender } = renderWithPickers(<DatePicker label="Due date" value={dayjs('2026-11-01')} minDate={value} onError={error}
    helperText="Outside the allowed range" slotProps={{ textField: () => ({ required: true, sx: [{ padding: '3px' }, { padding: '6px' }] }) }} />);
  await waitFor(() => expect(error).toHaveBeenCalledWith('minDate', expect.anything()));
  expect(screen.getByRole('group', { name: /Due date/ })).toHaveAttribute('aria-invalid', 'true');
  rerender(<DatePicker label="Due date" value={value} error helperText="Application error" />); expect(screen.getByRole('group', { name: 'Due date' })).toHaveAttribute('aria-invalid', 'true');
});
it('supports clear without replacing MUI callback/accept behavior', async () => {
  const change = vi.fn(); renderWithPickers(<DatePicker label="Due date" defaultValue={value} onChange={change} reduceAnimations desktopModeMediaQuery={desktopModeMediaQuery} />);
  fireEvent.click(screen.getByRole('button', { name: /choose date/i })); fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear' }));
  expect(change).toHaveBeenCalledWith(null, expect.objectContaining({ validationError: null })); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('supports controlled values and custom slots without dropping their callbacks', () => {
  const old = vi.fn(); const next = vi.fn(); const triggerClick = vi.fn(); const { rerender } = renderWithPickers(<DatePicker label="Due date" value={value} onChange={old} />);
  rerender(<DatePicker label="Due date" value={dayjs('2026-11-22')} onChange={next} desktopModeMediaQuery={desktopModeMediaQuery}
    slotProps={{ openPickerButton: { 'aria-label': 'Open due date', onMouseDown: triggerClick }, actionBar: () => ({ actions: ['cancel'] }) }} reduceAnimations />);
  expect(screen.getByRole('spinbutton', { name: 'Day' })).toHaveAttribute('aria-valuenow', '22'); fireEvent.mouseDown(screen.getByRole('button', { name: 'Open due date' })); fireEvent.click(screen.getByRole('button', { name: 'Open due date' }));
  expect(triggerClick).toHaveBeenCalledTimes(1); expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('gridcell', { name: '25' })); expect(next).toHaveBeenCalledTimes(1); expect(old).not.toHaveBeenCalled();
});
it('honors disabled/read-only fields and exposes responsive mobile actions', async () => {
  const change = vi.fn(); const { rerender } = renderWithPickers(<DatePicker label="Due date" value={value} disabled onChange={change} />);
  expect(screen.getByRole('button', { name: /choose date/i })).toBeDisabled();
  rerender(<DatePicker label="Due date" value={value} readOnly onChange={change} />);
  fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Day' }), { key: 'ArrowUp' }); expect(change).not.toHaveBeenCalled();
  function Mobile() { const [open, setOpen] = useState(true); return <DatePicker label="Mobile due date" defaultValue={value} open={open} onClose={() => setOpen(false)} desktopModeMediaQuery="@media (min-width: 99999px)" reduceAnimations />; }
  rerender(<Mobile />); expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
