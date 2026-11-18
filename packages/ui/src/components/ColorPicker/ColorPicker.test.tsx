import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { ColorPicker, ColorSwatch } from './ColorPicker';

it('normalizes valid hex values and retains invalid drafts without emitting invalid colors', () => {
  const change = vi.fn(); renderWithUi(<ColorPicker label="Fill" defaultValue="#000000" onChange={change} />);
  const hex = screen.getByRole('textbox', { name: 'Hex color' }); fireEvent.change(hex, { target: { value: '#abc' } });
  expect(change).toHaveBeenLastCalledWith('#AABBCCFF'); expect(screen.getByRole('spinbutton', { name: 'Red' })).toHaveValue(170);
  change.mockClear(); fireEvent.change(hex, { target: { value: '#oops' } }); fireEvent.blur(hex);
  expect(change).not.toHaveBeenCalled(); expect(hex).toHaveAttribute('aria-invalid', 'true'); expect(hex).toHaveAccessibleDescription('Enter a valid hex color.');
});
it('edits RGB channels and opacity, clamps channel values and selects named presets', () => {
  const change = vi.fn(); renderWithUi(<ColorPicker label="Fill" defaultValue="#000000FF" onChange={change} presets={[{ value: '#f00', label: 'Red preset' }]} />);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Red' }), { target: { value: '300' } }); expect(change).toHaveBeenLastCalledWith('#FF0000FF');
  fireEvent.change(screen.getByRole('slider', { name: 'Opacity' }), { target: { value: '50' } }); expect(change).toHaveBeenLastCalledWith('#FF000080');
  fireEvent.click(screen.getByRole('button', { name: 'Red preset' })); expect(change).toHaveBeenLastCalledWith('#FF0000FF');
  expect(screen.getByRole('button', { name: 'Red preset' })).toHaveAttribute('aria-pressed', 'true');
});
it('keeps channel values caller-owned and responds to external changes', () => {
  const change = vi.fn(); const { rerender } = renderWithUi(<ColorPicker label="Fill" value="#000000" onChange={change} allowAlpha={false} />);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Red' }), { target: { value: '255' } }); expect(change).toHaveBeenLastCalledWith('#FF0000');
  expect(screen.getByRole('spinbutton', { name: 'Red' })).toHaveValue(0); expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  rerender(<ColorPicker label="Fill" value="#00FF00" allowAlpha={false} />); expect(screen.getByRole('spinbutton', { name: 'Green' })).toHaveValue(255);
  expect(screen.getByRole('textbox')).toHaveValue('#00FF00');
});
it.each([{ disabled: true }, { readOnly: true }])('prevents edits for %s', state => {
  const change = vi.fn(); renderWithUi(<ColorPicker label="Fill" {...state} onChange={change} presets={[{ value: '#fff', label: 'White' }]} />);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Red' }), { target: { value: '200' } }); fireEvent.click(screen.getByRole('button', { name: 'White' }));
  expect(change).not.toHaveBeenCalled(); expect(screen.getByRole('slider')).toBeDisabled();
});
it('renders static and interactive swatches with accessible names and disabled selection', () => {
  const click = vi.fn(); renderWithUi(<><ColorSwatch color="transparent" label="Transparent" /><ColorSwatch color="#fff" label="White" selected disabled onClick={click} /></>);
  expect(screen.getByRole('img', { name: 'Transparent' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'White' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'White' })); expect(click).not.toHaveBeenCalled();
});
