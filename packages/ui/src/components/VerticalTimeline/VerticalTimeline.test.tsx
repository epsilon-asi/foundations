import { createRef } from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { VerticalTimeline } from './VerticalTimeline';
import { StatusBadge } from '../StatusBadge';
import { ActionButton } from '../ActionButton';

it('preserves chronological DOM order, semantic dates and interactive slots in all presentations', () => {
  const clicked = vi.fn();
  const items = [{ id: 'a', title: 'Created', date: '2026-11-17T12:00Z', content: 'Asset created', icon: <svg data-testid="marker" />,
    status: <StatusBadge label="Ready" />, actions: <ActionButton onClick={clicked}>Open asset</ActionButton> }, { id: 'b', title: 'Reviewed' }];
  const { rerender } = renderWithUi(<VerticalTimeline items={items} />);
  for (const position of ['left', 'right', 'alternate', 'alternate-reverse'] as const) {
    rerender(<VerticalTimeline items={items} position={position} />);
    expect(within(screen.getByRole('list', { name: 'Activity' })).getAllByRole('heading').map((heading) => heading.textContent)).toEqual(['Created', 'Reviewed']);
    expect(document.querySelector('time')).toHaveAttribute('datetime', '2026-11-17T12:00:00.000Z');
  }
  fireEvent.click(screen.getByRole('button', { name: 'Open asset' })); expect(clicked).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('marker').closest('[aria-hidden="true"]')).toBeInTheDocument();
});
it('formats relative, localized and invalid dates without invalid time elements', () => {
  const items = [{ id: 'a', title: 'Created', date: '2026-11-17T12:00Z' }, { id: 'b', title: 'Unknown', date: 'invalid' }];
  const { rerender } = renderWithUi(<VerticalTimeline items={items} dateFormat="relative" now="2026-11-17T14:00Z" />);
  expect(screen.getByText('2 hours ago')).toBeInTheDocument();
  expect(screen.getByText('—')).toBeInTheDocument();
  expect(document.querySelectorAll('time')).toHaveLength(1);
  rerender(<VerticalTimeline items={items} locale="en-GB" timeZone="America/New_York" formatOptions={{ hour12: false }} />);
  expect(document.querySelector('time')).toHaveTextContent('7:00');
});
it('provides replaceable empty state and forwards refs and root styles', () => {
  const ref = createRef<HTMLOListElement>();
  const { rerender } = renderWithUi(<VerticalTimeline items={[]} ref={ref} sx={{ padding: '4px' }} />);
  expect(screen.getByText('No activity yet')).toBeInTheDocument();
  expect(ref.current).toBe(screen.getByRole('list'));
  expect(ref.current).toHaveStyle({ padding: '4px' });
  rerender(<VerticalTimeline items={[]} emptyState="Nothing to show" />);
  expect(screen.getByText('Nothing to show')).toBeInTheDocument();
});
