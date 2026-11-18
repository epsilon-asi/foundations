import { createRef } from 'react';
import { screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { DateDisplay } from './DateDisplay';

const start = '2026-11-01T12:00:00Z';
const value = '2026-11-11T12:00:00Z';
it('renders a semantic date and exact calendar-day progress without an artificial offset', () => {
  renderWithUi(<DateDisplay value={value} start={start} now="2026-11-06T12:00:00Z" showRelative />);
  expect(screen.getByText('Nov 11, 2026')).toHaveAttribute('datetime', '2026-11-11T12:00:00.000Z');
  expect(screen.getByText('in 5 days')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Date range progress' })).toHaveAttribute('aria-valuenow', '50');
});
it.each([['2026-10-30', '0'], ['2026-11-15', '100']])('clamps progress for %s', (now, progress) => {
  renderWithUi(<DateDisplay value={value} start={start} now={now} />);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', progress);
});
it('handles same-day, reversed, missing and invalid ranges as props change', () => {
  const { rerender } = renderWithUi(<DateDisplay value={value} start={value} now={start} />);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  rerender(<DateDisplay value={value} start={value} now={value} />);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  rerender(<DateDisplay value={start} start={value} now={value} />);
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  rerender(<DateDisplay value="invalid" start={start} emptyValue="No date" />);
  expect(screen.getByText('No date')).toBeInTheDocument();
  expect(document.querySelector('time')).toBeNull();
  rerender(<DateDisplay value={null} />);
  expect(screen.getByText('—')).toBeInTheDocument();
  rerender(<DateDisplay value={value} now="invalid" showRelative />);
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.queryByText(/days/)).not.toBeInTheDocument();
});
it('uses the requested calendar zone across DST and midnight boundaries', () => {
  const { rerender } = renderWithUi(<DateDisplay start="2026-03-07T17:00Z" value="2026-03-09T16:00Z"
    now="2026-03-08T16:00Z" timeZone="America/New_York" showRelative />);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  expect(screen.getByText('tomorrow')).toBeInTheDocument();
  rerender(<DateDisplay value="2026-11-11T01:00Z" now="2026-11-10T12:00Z" timeZone="America/Los_Angeles" showRelative />);
  expect(screen.getByText('Nov 10, 2026')).toBeInTheDocument();
  expect(screen.getByText('today')).toBeInTheDocument();
});
it('supports locale, custom formatting, native attributes, refs and composed styles', () => {
  const ref = createRef<HTMLDivElement>();
  renderWithUi(<DateDisplay ref={ref} data-testid="date" value={new Date(value)} now={Date.parse(start)} locale="de-DE"
    formatOptions={{ month: 'long' }} sx={[{ padding: '2px' }, { padding: '7px' }]} />);
  expect(screen.getByText('11. November 2026')).toBeInTheDocument();
  expect(ref.current).toBe(screen.getByTestId('date'));
  expect(ref.current).toHaveStyle({ padding: '7px' });
});
