import { createRef } from 'react';
import { screen } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { StatusBadge } from './StatusBadge';

it.each(['neutral', 'info', 'success', 'warning', 'error'] as const)('renders a noninteractive %s status with a decorative indicator', (tone) => {
  renderWithUi(<StatusBadge label="Ready" tone={tone} />);
  expect(screen.getByText('Ready')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(document.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
});
it('supports outlined/solid variants and removing the indicator as props change', () => {
  const { rerender, container } = renderWithUi(<StatusBadge label="Queued" variant="outlined" indicator={false} />);
  expect(container.querySelector('.MuiChip-outlined')).toBeInTheDocument();
  expect(container.querySelector('.MuiChip-icon')).toBeNull();
  rerender(<StatusBadge label="Complete" variant="solid" tone="success" size="medium" />);
  expect(container.querySelector('.MuiChip-filled')).toBeInTheDocument();
  expect(screen.queryByText('Queued')).not.toBeInTheDocument();
});
it('gives dot-only status an accessible name, keyboard focus and a tooltip', async () => {
  renderWithUi(<StatusBadge label="Processing" tone="info" display="dot" pulse />);
  await userEvent.tab();
  expect(screen.getByRole('img', { name: 'Processing' })).toHaveFocus();
  expect(screen.getByRole('img')).toHaveAttribute('title', 'Processing');
  await userEvent.hover(screen.getByRole('img'));
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Processing');
});
it('forwards refs, attributes and composed styles for both displays', () => {
  const ref = createRef<HTMLSpanElement>();
  const { rerender } = renderWithUi(<StatusBadge label="Ready" ref={ref} data-testid="status" sx={[{ margin: '1px' }, { margin: '5px' }]} />);
  expect(ref.current).toBe(screen.getByTestId('status'));
  expect(ref.current).toHaveStyle({ margin: '5px' });
  rerender(<StatusBadge label="Ready" display="dot" ref={ref} />);
  expect(ref.current).toBe(screen.getByRole('img'));
});
