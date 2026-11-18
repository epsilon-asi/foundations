import { createRef } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { InsightCard } from './InsightCard';
import { ActionButton } from '../ActionButton';

it('composes its header, body and inherited card actions without dropping callbacks', () => {
  const header = vi.fn(); const action = vi.fn();
  renderWithUi(<InsightCard title="Weekly insight" icon={<svg data-testid="icon" />}
    headerAction={<ActionButton onClick={header}>Options</ActionButton>}
    actions={<ActionButton onClick={action}>Review</ActionButton>}>Completed 12 assets</InsightCard>);
  expect(screen.getByRole('heading', { level: 2, name: 'Weekly insight' })).toBeInTheDocument();
  expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden');
  expect(screen.getByText('Completed 12 assets')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Options' }));
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));
  expect(header).toHaveBeenCalledTimes(1); expect(action).toHaveBeenCalledTimes(1);
});
it('supports soft and solid tones, replacement and removal of decorative graphics', () => {
  const { rerender, container } = renderWithUi(<InsightCard children={null} title="First" tone="success" emphasis="soft" graphic={<svg data-testid="art" />} />);
  expect(screen.getByTestId('art').closest('[aria-hidden="true"]')).toBeInTheDocument();
  rerender(<><InsightCard children={null} title="First" /><InsightCard children={null} title="Second" tone="warning" /></>);
  expect(container.querySelectorAll('svg circle')).toHaveLength(6);
  expect(container.querySelectorAll('svg [id]')).toHaveLength(0);
  rerender(<InsightCard children={null} title="Plain" graphic={null} />);
  expect(container.querySelector('svg')).toBeNull();
});
it('forwards native attributes, refs and theme-aware style overrides', () => {
  const ref = createRef<HTMLDivElement>();
  renderWithUi(<InsightCard children={null} title="Report" ref={ref} role="region" aria-label="Report card" sx={[{ padding: '3px' }, () => ({ padding: '9px' })]} />);
  expect(ref.current).toBe(screen.getByRole('region', { name: 'Report card' }));
  expect(ref.current).toHaveStyle({ padding: '9px' });
});
