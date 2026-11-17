import { createRef } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { Panel } from './Panel';

it('labels its section with a configurable heading and displays header and footer slots', () => {
  const clicked = vi.fn();
  renderWithUi(<Panel title="Properties" subtitle="Selected asset" headingLevel="h3"
    headerAction={<button onClick={clicked}>Refresh</button>} footer={<button>Apply</button>}><p>Width: 64 px</p></Panel>);
  expect(screen.getByRole('region', { name: 'Properties' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Properties');
  expect(screen.getByText('Selected asset')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(clicked).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
});

it('supports a body-only panel and updates content and slots with props', () => {
  const { rerender } = renderWithUi(<Panel>Body only</Panel>);
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  rerender(<Panel title="History" footer="3 revisions">New body</Panel>);
  expect(screen.queryByText('Body only')).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'History' })).toHaveTextContent('3 revisions');
});

it('forwards refs, native attributes and composed body and surface styles', () => {
  const ref = createRef<HTMLDivElement>();
  renderWithUi(<Panel ref={ref} title="Properties" data-testid="panel" sx={[{ padding: '3px' }, { padding: '7px' }]}
    headerSx={[{ padding: '4px' }, { padding: '8px' }]}
    contentSx={(theme) => ({ padding: `${theme.shape.borderRadius}px` })}><span>Body</span></Panel>);
  expect(ref.current).toBe(screen.getByTestId('panel'));
  expect(ref.current).toHaveStyle({ padding: '7px' });
  expect(screen.getByRole('heading').parentElement?.parentElement).toHaveStyle({ padding: '8px' });
  expect(screen.getByText('Body').parentElement).toHaveStyle({ padding: '14px' });
});
