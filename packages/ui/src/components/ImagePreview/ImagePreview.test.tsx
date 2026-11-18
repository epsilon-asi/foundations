import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { ImagePreview } from './ImagePreview';

it('shows loading and failure states and resets for a new source', () => {
  const load = vi.fn(); const error = vi.fn();
  const { rerender } = renderWithUi(<ImagePreview src="one.png" alt="Coast" onLoad={load} onError={error} />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading image');
  fireEvent.error(screen.getByAltText('Coast')); expect(screen.getByRole('status')).toHaveTextContent('Image unavailable'); expect(error).toHaveBeenCalledTimes(1);
  rerender(<ImagePreview src="two.png" alt="Coast" onLoad={load} />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading image');
  fireEvent.load(screen.getByAltText('Coast')); expect(load).toHaveBeenCalledTimes(1); expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('supports empty previews and decorative images without inventing alt text', () => {
  const { rerender } = renderWithUi(<ImagePreview alt="" emptyMessage="Select an image" />);
  expect(screen.getByRole('status')).toHaveTextContent('Select an image');
  rerender(<ImagePreview src="decorative.png" alt="" />); fireEvent.load(screen.getByAltText(''));
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
it('bounds zoom, provides a keyboard-scrollable viewport, resets on source changes and disables zoom before load', () => {
  const { rerender } = renderWithUi(<ImagePreview src="one.png" alt="Coast" zoomable maxZoom={2} />);
  expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled(); fireEvent.load(screen.getByAltText('Coast'));
  fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); expect(screen.getByText('150%')).toBeVisible();
  expect(screen.getByRole('region', { name: 'Coast preview' })).toHaveAttribute('tabindex', '0');
  fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Reset zoom' })); expect(screen.getByText('100%')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); rerender(<ImagePreview src="two.png" alt="Coast" zoomable />);
  expect(screen.getByText('100%')).toBeVisible(); expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
});
