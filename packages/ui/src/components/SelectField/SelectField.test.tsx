import { createRef, useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { SelectField } from './SelectField';

it('exposes the native select and preserves labels, descriptions and grouped numeric values', () => {
  const ref = createRef<HTMLSelectElement>();
  function Example() {
    const [size, setSize] = useState<number | null>(null);
    return <><span id="units">Pixels.</span><SelectField ref={ref} label="Size" helperText="Preview only."
      aria-describedby="units" value={size} onChange={(event) => setSize(event.target.value ? Number(event.target.value) : null)}>
      <option value="">Automatic</option><optgroup label="Sizes"><option value={96}>96 px</option></optgroup>
    </SelectField></>;
  }
  renderWithUi(<Example />);
  const select = screen.getByRole('combobox', { name: 'Size' });
  expect(ref.current).toBe(select);
  expect(select).toHaveAccessibleDescription('Pixels. Preview only.');
  expect(select).toHaveValue('');
  fireEvent.change(select, { target: { value: '96' } });
  expect(select).toHaveValue('96');
  fireEvent.change(select, { target: { value: '' } });
  expect(select).toHaveValue('');
});

it('retains a disabled saved choice and honors an external label and disabled state', () => {
  renderWithUi(<><label htmlFor="saved">Saved model</label><SelectField disabled id="saved" defaultValue="old">
    <option value="old" disabled>Old model</option><option value="new">New model</option>
  </SelectField></>);
  const select = screen.getByRole('combobox', { name: 'Saved model' });
  expect(select).toBeDisabled();
  expect(select).toHaveValue('old');
  expect(screen.getByRole('option', { name: 'Old model' })).toBeDisabled();
});
