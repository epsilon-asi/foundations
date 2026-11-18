import { createRef } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { PageHeader } from './PageHeader';
import { ActionButton } from '../ActionButton';

it('composes breadcrumbs and heading slots with working actions', () => {
  const clicked = vi.fn();
  renderWithUi(<PageHeader title="Assets" eyebrow="Library" subtitle="Manage your collection" breadcrumbs={[{ id: 'root', label: 'Home', href: '#home' }, { id: 'assets', label: 'Assets' }]}
    actions={<ActionButton onClick={clicked}>Create asset</ActionButton>} />);
  expect(screen.getByRole('heading', { name: 'Assets', level: 1 })).toBeInTheDocument();
  expect(screen.getByRole('navigation')).toBeInTheDocument();
  expect(screen.getByText('Manage your collection')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Create asset' })); expect(clicked).toHaveBeenCalledTimes(1);
});
it('supports section headings, native props, refs and changing optional slots', () => {
  const ref = createRef<HTMLElement>();
  const { rerender } = renderWithUi(<PageHeader title="History" headingLevel="h2" ref={ref} data-testid="header" sx={[{ padding: '2px' }, { padding: '8px' }]} />);
  expect(ref.current).toBe(screen.getByTestId('header'));
  expect(ref.current).toHaveStyle({ padding: '8px' });
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('History');
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  rerender(<PageHeader title="Details" subtitle="Updated" breadcrumbProps={{ 'aria-label': 'Location' }} breadcrumbs={[{ id: 'page', label: 'Details' }]} />);
  expect(screen.queryByText('History')).not.toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Location' })).toBeInTheDocument();
});
