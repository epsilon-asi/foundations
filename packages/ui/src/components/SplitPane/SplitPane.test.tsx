import { createRef } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { SplitPane } from './SplitPane';

let width = 600; let height = 500;
beforeEach(() => {
  width = 600; height = 500;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() =>
    ({ x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON: () => ({}) }));
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    readonly pointerId: number;
    constructor(type: string, options: PointerEventInit = {}) {
      super(type, options);
      this.pointerId = options.pointerId ?? 1;
    }
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const content = [<p key="first">Tools</p>, <p key="second">Preview</p>] as const;

it('exposes separator bounds and association and supports keyboard resizing and completion callbacks', () => {
  const changed = vi.fn(); const ended = vi.fn();
  renderWithUi(<SplitPane defaultSize={200} minSize={100} minSecondSize={100} maxSize={400}
    onSizeChange={changed} onResizeEnd={ended}>{content}</SplitPane>);
  const separator = screen.getByRole('separator', { name: 'Resize panels' });
  expect(separator).toHaveAttribute('aria-orientation', 'vertical');
  expect(separator).toHaveAttribute('aria-controls', screen.getByRole('region', { name: 'First panel' }).id);
  expect(separator).toHaveAttribute('aria-valuemin', '100');
  expect(separator).toHaveAttribute('aria-valuemax', '400');
  fireEvent.keyDown(separator, { key: 'ArrowRight' });
  expect(changed).toHaveBeenLastCalledWith(210, 'keyboard');
  expect(ended).toHaveBeenLastCalledWith(210, 'keyboard');
  fireEvent.keyDown(separator, { key: 'ArrowLeft', shiftKey: true });
  expect(separator).toHaveAttribute('aria-valuenow', '160');
  fireEvent.keyDown(separator, { key: 'Home' }); expect(separator).toHaveAttribute('aria-valuenow', '100');
  fireEvent.keyDown(separator, { key: 'ArrowLeft' }); expect(changed).toHaveBeenCalledTimes(3);
  fireEvent.keyDown(separator, { key: 'End' }); expect(separator).toHaveAttribute('aria-valuenow', '400');
});

it('reports controlled size changes while waiting for the parent to update its value', () => {
  const changed = vi.fn();
  const { rerender } = renderWithUi(<SplitPane size={200} onSizeChange={changed}>{content}</SplitPane>);
  fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' });
  expect(changed).toHaveBeenCalledWith(210, 'keyboard');
  expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '200');
  rerender(<SplitPane size={250} onSizeChange={changed}>{content}</SplitPane>);
  expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '250');
});

it('clamps pointer drags, supports pointer capture and ignores moves after release', () => {
  const changed = vi.fn(); const ended = vi.fn();
  renderWithUi(<SplitPane defaultSize={200} maxSize={350} onSizeChange={changed} onResizeEnd={ended}>{content}</SplitPane>);
  const separator = screen.getByRole('separator');
  separator.setPointerCapture = vi.fn(); separator.hasPointerCapture = () => true; separator.releasePointerCapture = vi.fn();
  fireEvent.pointerDown(separator, { button: 0, clientX: 200 });
  fireEvent.pointerMove(separator, { clientX: 800 });
  expect(changed).toHaveBeenLastCalledWith(350, 'pointer');
  fireEvent.pointerMove(separator, { clientX: 800 }); expect(changed).toHaveBeenCalledTimes(1);
  fireEvent.pointerUp(separator);
  expect(ended).toHaveBeenCalledWith(350, 'pointer');
  expect(separator.releasePointerCapture).toHaveBeenCalled();
  fireEvent.pointerMove(separator, { clientX: 10 }); expect(changed).toHaveBeenCalledTimes(1);
});

it('cancels interrupted gestures without emitting a completed resize', () => {
  const ended = vi.fn(); const changed = vi.fn();
  const { rerender } = renderWithUi(<SplitPane defaultSize={200} onResizeEnd={ended} onSizeChange={changed}>{content}</SplitPane>);
  const separator = screen.getByRole('separator');
  fireEvent.pointerDown(separator, { button: 0, clientX: 200 });
  fireEvent.pointerMove(separator, { clientX: 250 });
  fireEvent.pointerCancel(separator); fireEvent.pointerUp(separator);
  expect(ended).not.toHaveBeenCalled(); expect(changed).toHaveBeenCalledTimes(1);
  fireEvent.pointerDown(separator, { button: 0, clientX: 250 });
  rerender(<SplitPane disabled defaultSize={200} onResizeEnd={ended} onSizeChange={changed}>{content}</SplitPane>);
  fireEvent.pointerMove(separator, { clientX: 300 }); fireEvent.pointerUp(separator);
  expect(changed).toHaveBeenCalledTimes(1); expect(ended).not.toHaveBeenCalled();
});

it('uses vertical coordinates and the correct separator orientation', () => {
  const changed = vi.fn();
  renderWithUi(<SplitPane orientation="vertical" defaultSize={200} onSizeChange={changed}>{content}</SplitPane>);
  const separator = screen.getByRole('separator');
  expect(separator).toHaveAttribute('aria-orientation', 'horizontal');
  fireEvent.keyDown(separator, { key: 'ArrowDown' }); expect(changed).toHaveBeenLastCalledWith(210, 'keyboard');
  fireEvent.keyDown(separator, { key: 'ArrowRight' }); expect(changed).toHaveBeenCalledTimes(1);
  fireEvent.pointerDown(separator, { button: 0, clientY: 210 }); fireEvent.pointerMove(separator, { clientY: 250 });
  expect(changed).toHaveBeenLastCalledWith(250, 'pointer');
});

it('reverses horizontal keyboard and pointer movement for RTL layouts', () => {
  const changed = vi.fn();
  renderWithUi(<SplitPane dir="rtl" defaultSize={200} onSizeChange={changed}>{content}</SplitPane>);
  const separator = screen.getByRole('separator');
  fireEvent.keyDown(separator, { key: 'ArrowLeft' }); expect(changed).toHaveBeenLastCalledWith(210, 'keyboard');
  fireEvent.pointerDown(separator, { button: 0, clientX: 200 }); fireEvent.pointerMove(separator, { clientX: 170 });
  expect(changed).toHaveBeenLastCalledWith(240, 'pointer');
});

it('adapts to container constraints and restores the requested size when space returns', () => {
  renderWithUi(<SplitPane defaultSize={300} minSize={120} minSecondSize={120}>{content}</SplitPane>);
  width = 200;
  act(() => window.dispatchEvent(new Event('resize')));
  expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '72');
  expect(screen.getByRole('separator')).toHaveAttribute('aria-valuemin', '72');
  width = 80;
  act(() => window.dispatchEvent(new Event('resize')));
  expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '0');
  width = 600;
  act(() => window.dispatchEvent(new Event('resize')));
  expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '300');
});

it('observes element resizing and disconnects on unmount', () => {
  let resize: () => void = () => {};
  const disconnect = vi.fn(); const observe = vi.fn();
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback; } observe = observe; disconnect = disconnect; });
  const { unmount } = renderWithUi(<SplitPane defaultSize={300}>{content}</SplitPane>);
  expect(observe).toHaveBeenCalled();
  width = 200; act(() => resize());
  expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '72');
  unmount(); expect(disconnect).toHaveBeenCalledTimes(1);
});

it('disables interaction, forwards refs and accepts panel styles and accessible labels', () => {
  const ref = createRef<HTMLDivElement>(); const changed = vi.fn();
  renderWithUi(<SplitPane ref={ref} disabled data-testid="split" onSizeChange={changed} firstLabel="Assets" secondLabel="Editor"
    firstSx={{ padding: '7px' }} resizeLabel="Resize assets">{content}</SplitPane>);
  expect(ref.current).toBe(screen.getByTestId('split'));
  expect(screen.getByRole('region', { name: 'Assets' })).toHaveStyle({ padding: '7px' });
  const separator = screen.getByRole('separator', { name: 'Resize assets' });
  expect(separator).toHaveAttribute('tabindex', '-1');
  fireEvent.keyDown(separator, { key: 'ArrowRight' });
  fireEvent.pointerDown(separator, { button: 0, clientX: 200 }); fireEvent.pointerMove(separator, { clientX: 300 });
  expect(changed).not.toHaveBeenCalled();
});

it('ignores secondary buttons and other pointers, and stops when pointer capture is lost', () => {
  const changed = vi.fn(); const ended = vi.fn();
  renderWithUi(<SplitPane defaultSize={200} onSizeChange={changed} onResizeEnd={ended}>{content}</SplitPane>);
  const separator = screen.getByRole('separator');
  fireEvent.pointerDown(separator, { button: 2, pointerId: 1, clientX: 200 });
  fireEvent.pointerMove(separator, { pointerId: 1, clientX: 250 });
  expect(changed).not.toHaveBeenCalled();
  fireEvent.pointerDown(separator, { button: 0, pointerId: 1, clientX: 200 });
  fireEvent.pointerMove(separator, { pointerId: 2, clientX: 300 });
  fireEvent.pointerUp(separator, { pointerId: 2 });
  expect(changed).not.toHaveBeenCalled();
  fireEvent.pointerMove(separator, { pointerId: 1, clientX: 250 });
  expect(changed).toHaveBeenCalledWith(250, 'pointer');
  fireEvent.lostPointerCapture(separator, { pointerId: 1 });
  fireEvent.pointerMove(separator, { pointerId: 1, clientX: 300 });
  expect(changed).toHaveBeenCalledTimes(1); expect(ended).not.toHaveBeenCalled();
});
