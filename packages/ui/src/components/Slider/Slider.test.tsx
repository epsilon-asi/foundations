import { createRef } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { Slider } from './Slider';
import { RangeSlider } from '../RangeSlider';

it('labels a scalar slider, forwards native input handlers and emits numeric change/commit values', () => {
  const change = vi.fn(); const commit = vi.fn(); const ref = createRef<HTMLSpanElement>();
  renderWithUi(<Slider ref={ref} label="Opacity" defaultValue={40} min={0} max={100} step={5} helperText="Percent" onChange={change} onChangeCommitted={commit} />);
  const input = screen.getByRole('slider', { name: 'Opacity' }); expect(input).toHaveAccessibleDescription('Percent');
  fireEvent.change(input, { target: { value: '45' } }); expect(change).toHaveBeenLastCalledWith(45, expect.anything(), 0);
  expect(commit).toHaveBeenLastCalledWith(45, expect.anything()); expect(input).toHaveValue('45'); expect(ref.current).toContainElement(input);
  fireEvent.keyDown(input, { key: 'End' }); expect(input).toHaveValue('100');
  fireEvent.keyDown(input, { key: 'Home' }); fireEvent.keyDown(input, { key: 'ArrowUp' }); expect(change).toHaveBeenLastCalledWith(5, expect.anything(), 0);
});
it('keeps a controlled scalar value and blocks disabled callbacks', () => {
  const change = vi.fn(); const { rerender } = renderWithUi(<Slider label="Opacity" value={30} onChange={change} />);
  fireEvent.change(screen.getByRole('slider'), { target: { value: '50' } }); expect(change).toHaveBeenCalledWith(50, expect.anything(), 0); expect(screen.getByRole('slider')).toHaveValue('30');
  change.mockClear(); rerender(<Slider label="Opacity" value={30} disabled onChange={change} />);
  fireEvent.change(screen.getByRole('slider'), { target: { value: '50' } }); expect(change).not.toHaveBeenCalled();
});
it('labels both range endpoints, prevents crossing by default and emits two-value tuples', () => {
  const change = vi.fn(); renderWithUi(<RangeSlider label="Frames" defaultValue={[20, 60]} onChange={change} error helperText="Choose a range" />);
  const min = screen.getByRole('slider', { name: 'Frames: Minimum' }); const max = screen.getByRole('slider', { name: 'Frames: Maximum' });
  expect(min).toHaveAccessibleDescription('Choose a range'); expect(max).toHaveAttribute('aria-invalid', 'true');
  fireEvent.change(min, { target: { value: '90' } }); expect(change).toHaveBeenLastCalledWith([60, 60], expect.anything(), 0);
  fireEvent.change(max, { target: { value: '80' } }); expect(change).toHaveBeenLastCalledWith([60, 80], expect.anything(), 1);
});
it('supports vertical ranges, custom endpoint names and caller style overrides', () => {
  renderWithUi(<RangeSlider label="Range" value={[10, 70]} orientation="vertical" getAriaLabel={(index) => index ? 'End' : 'Start'} sx={[{ height: '180px' }, { height: '220px' }]} />);
  expect(screen.getByRole('slider', { name: 'Start' })).toHaveAttribute('aria-orientation', 'vertical'); expect(screen.getByRole('slider', { name: 'End' })).toHaveValue('70');
});
