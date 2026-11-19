import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { ImageComparison } from './ImageComparison';

const images = { before: { src: 'before.png', alt: 'Original coast', label: 'Original' }, after: { src: 'after.png', alt: 'Edited coast', label: 'Edited' } };
it('labels both images and supports uncontrolled slider updates with meaningful value text', () => {
  const change = vi.fn(); renderWithUi(<ImageComparison aria-label="Revisions" {...images} onPositionChange={change} />);
  expect(screen.getByAltText('Original coast')).toBeInTheDocument(); expect(screen.getByAltText('Edited coast')).toBeInTheDocument();
  const slider = screen.getByRole('slider', { name: 'Before image visibility' }); expect(slider).toHaveValue('50');
  fireEvent.change(slider, { target: { value: '75' } }); expect(change).toHaveBeenLastCalledWith(75); expect(slider).toHaveValue('75');
  expect(slider).toHaveAttribute('aria-valuetext', '75% before image visible');
});
it('keeps controlled positions caller-owned, bounds invalid values and disables edits', () => {
  const change = vi.fn(); const { rerender } = renderWithUi(<ImageComparison aria-label="Revisions" {...images} position={120} onPositionChange={change} />);
  const slider = screen.getByRole('slider'); expect(slider).toHaveValue('100'); fireEvent.change(slider, { target: { value: '25' } }); expect(change).toHaveBeenCalledWith(25); expect(slider).toHaveValue('100');
  rerender(<ImageComparison aria-label="Revisions" {...images} position={NaN} disabled onPositionChange={change} />); expect(slider).toHaveValue('50'); expect(slider).toBeDisabled();
});
it('updates from pointer dragging with bounds and stops after cancellation', () => {
  const change = vi.fn(); const { container } = renderWithUi(<ImageComparison aria-label="Revisions" {...images} onPositionChange={change} />);
  const surface = container.querySelector<HTMLElement>('[data-comparison-surface]')!;
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({ left: 10, width: 200, top: 0, right: 210, bottom: 150, height: 150, x: 10, y: 0, toJSON: () => ({}) });
  // JSDOM does not expose PointerEvent; use MouseEvent-compatible pointer fields.
  const pointer = (type: string, x: number) => { const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x }); Object.defineProperty(event, 'pointerId', { value: 1 }); fireEvent(surface, event); };
  pointer('pointerdown', 60); expect(change).toHaveBeenLastCalledWith(25); pointer('pointermove', 300); expect(change).toHaveBeenLastCalledWith(100);
  pointer('pointercancel', 300); change.mockClear(); pointer('pointermove', 100); expect(change).not.toHaveBeenCalled();
});
it('supports side-by-side and missing/failed image states through ImagePreview', () => {
  renderWithUi(<ImageComparison aria-label="Revisions" mode="side-by-side" before={{ alt: 'Original' }} after={images.after} />);
  expect(screen.queryByRole('slider')).not.toBeInTheDocument(); expect(screen.getByText('No preview')).toBeVisible();
  fireEvent.error(screen.getByAltText('Edited coast')); expect(screen.getByText('Edited coast: Image unavailable')).toBeVisible();
});
