import { useState } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { MultiSelect } from './MultiSelect';

const options = [{ value: 'a', label: 'Assets', description: 'Creative library' }, { value: 'b', label: 'Boards' }, { value: 'c', label: 'Collections', disabled: true }];
it('selects and deselects multiple values without closing or introducing checkbox tab stops', async () => {
  const change = vi.fn(); renderWithUi(<MultiSelect label="Sections" options={options} onChange={change} />);
  await userEvent.click(screen.getByRole('combobox'));
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('option', { name: 'Assets' }));
  expect(change).toHaveBeenLastCalledWith(['a'], expect.anything(), 'selectOption');
  expect(screen.getByRole('listbox')).toBeVisible(); expect(screen.getByRole('option', { name: 'Assets' })).toHaveAttribute('aria-selected', 'true');
  await userEvent.click(screen.getByRole('option', { name: 'Boards' })); expect(change).toHaveBeenLastCalledWith(['a', 'b'], expect.anything(), 'selectOption');
  await userEvent.click(screen.getByRole('option', { name: 'Assets' })); expect(change).toHaveBeenLastCalledWith(['b'], expect.anything(), 'removeOption');
});
it('supports keyboard selection, chip removal with Backspace, clearing and closing on request', async () => {
  const change = vi.fn(); renderWithUi(<MultiSelect label="Sections" options={options} defaultValue={['a']} onChange={change} closeOnSelect />);
  const input = screen.getByRole('combobox'); act(() => input.focus()); await userEvent.keyboard('{ArrowDown}{End}{Enter}');
  expect(change).toHaveBeenLastCalledWith(['a', 'b'], expect.anything(), 'selectOption'); expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  await userEvent.keyboard('{Backspace}'); expect(change).toHaveBeenLastCalledWith(['a'], expect.anything(), 'removeOption');
  await userEvent.click(screen.getByRole('button', { name: 'Clear selection' })); expect(change).toHaveBeenLastCalledWith([], expect.anything(), 'clear');
});
it('removes chips by pointer and allows removing a saved option that is now unavailable', async () => {
  const change = vi.fn(); renderWithUi(<MultiSelect label="Sections" options={options} defaultValue={['c']} onChange={change} />);
  const chip = screen.getByLabelText('Selected: Collections');
  fireEvent.click(chip.querySelector('.MuiChip-deleteIcon')!);
  expect(change).toHaveBeenCalledExactlyOnceWith([], expect.anything(), 'removeOption');
});
it('keeps controlled values and updated callbacks, including read-only and disabled chips', async () => {
  const first = vi.fn(); const latest = vi.fn();
  const { rerender } = renderWithUi(<MultiSelect label="Sections" options={options} value={['a']} onChange={first} />);
  await userEvent.click(screen.getByRole('combobox')); await userEvent.click(screen.getByRole('option', { name: 'Boards' }));
  expect(first).toHaveBeenCalledWith(['a', 'b'], expect.anything(), 'selectOption'); expect(screen.queryByLabelText('Selected: Boards')).not.toBeInTheDocument();
  rerender(<MultiSelect label="Sections" options={options} value={['a', 'b']} onChange={latest} readOnly />);
  expect(screen.getByLabelText('Selected: Assets').querySelector('.MuiChip-deleteIcon')).toBeNull();
  screen.getByRole('combobox').focus(); await userEvent.keyboard('{Backspace}'); expect(latest).not.toHaveBeenCalled();
  rerender(<MultiSelect label="Sections" options={options} value={['a', 'b']} onChange={latest} disabled />);
  expect(screen.getByRole('combobox')).toBeDisabled();
  rerender(<MultiSelect label="Sections" options={options} value={['a', 'b']} onChange={latest} />);
  await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
  expect(latest).toHaveBeenCalledExactlyOnceWith([], expect.anything(), 'clear'); expect(first).toHaveBeenCalledTimes(1);
});
it('keeps a controlled search through recreated values/options and exposes only matching choices', async () => {
  function Example() { const [query, setQuery] = useState(''); return <MultiSelect label="Sections" options={options.map((item) => ({ ...item }))} value={['a']}
    inputValue={query} onInputChange={setQuery} />; }
  renderWithUi(<Example />); await userEvent.type(screen.getByRole('combobox'), 'bo');
  expect(screen.getByRole('combobox')).toHaveValue('bo'); expect(screen.getByRole('option')).toHaveAccessibleName('Boards');
});
it('submits repeated numeric keys, handles required selection and omits disabled controls', () => {
  const numeric = [{ value: 0, label: 'Zero' }, { value: 2, label: 'Two' }];
  const { rerender } = renderWithUi(<form data-testid="form"><MultiSelect label="Numbers" options={numeric} name="numbers" value={[0, 2]} required /></form>);
  const form = screen.getByTestId('form') as HTMLFormElement;
  expect(new FormData(form).getAll('numbers')).toEqual(['0', '2']); expect(screen.getByRole('combobox')).not.toHaveAttribute('required');
  expect(screen.getByRole('combobox')).toHaveAttribute('aria-required', 'true');
  rerender(<form data-testid="form"><MultiSelect label="Numbers" options={numeric} name="numbers" value={[0, 2]} disabled /></form>);
  expect(new FormData(form).getAll('numbers')).toEqual([]);
});
it('limits chips while unfocused and expands them on focus', async () => {
  renderWithUi(<MultiSelect label="Sections" options={options} defaultValue={['a', 'b', 'c']} limitTags={1} />);
  expect(screen.queryByLabelText('Selected: Boards')).not.toBeInTheDocument(); expect(screen.getByText('+2')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('combobox')); expect(screen.getByLabelText('Selected: Boards')).toBeInTheDocument();
});
