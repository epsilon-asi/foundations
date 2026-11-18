import { createRef, useState } from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { SingleSelect, type SelectOption } from './SingleSelect';
import { StatusBadge } from '../StatusBadge';
import { ModalDialog } from '../ModalDialog';

const options: SelectOption<string>[] = [
  { value: 'fast', label: 'Fast', description: 'Quick concept exploration', icon: <svg data-testid="fast-icon" />, meta: <StatusBadge label="Recommended" />, keywords: ['draft'] },
  { value: 'retired', label: 'Retired', disabled: true, disabledReason: 'Choose a current model' },
  { value: 'quality', label: 'Quality', description: 'Detailed production assets' }
];

it('renders rich options in a custom listbox and emits the primitive key before closing', async () => {
  const change = vi.fn();
  renderWithUi(<SingleSelect label="Model" options={options} onChange={change} />);
  const input = screen.getByRole('combobox', { name: 'Model' });
  expect(input.tagName).toBe('INPUT'); expect(document.querySelector('select')).toBeNull();
  await userEvent.click(input);
  const fast = screen.getByRole('option', { name: 'Fast' });
  expect(fast).toHaveTextContent('Quick concept exploration'); expect(fast).toHaveTextContent('Recommended');
  expect(within(fast).getByTestId('fast-icon').parentElement).toHaveAttribute('aria-hidden');
  await userEvent.click(fast);
  expect(change).toHaveBeenCalledExactlyOnceWith('fast', expect.anything(), 'selectOption');
  expect(input).toHaveValue('Fast'); expect(input).toHaveFocus();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
it('searches labels, descriptions and keywords, then announces no matches', async () => {
  renderWithUi(<SingleSelect label="Model" options={options} />);
  const input = screen.getByRole('combobox'); await userEvent.type(input, 'draft');
  expect(screen.getAllByRole('option')).toHaveLength(1); expect(screen.getByRole('option')).toHaveAccessibleName('Fast');
  await userEvent.clear(input); await userEvent.type(input, 'production');
  expect(screen.getByRole('option')).toHaveAccessibleName('Quality');
  await userEvent.clear(input); await userEvent.type(input, 'missing');
  expect(screen.getByRole('status')).toHaveTextContent('No matching options');
});
it('skips disabled items with the keyboard, keeps focus on input and selects with Enter', async () => {
  const change = vi.fn(); renderWithUi(<SingleSelect label="Model" options={options} onChange={change} />);
  const input = screen.getByRole('combobox'); act(() => input.focus());
  await userEvent.keyboard('{ArrowDown}{Home}{ArrowDown}');
  expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Quality' }).id);
  expect(screen.getByRole('option', { name: 'Retired' })).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(screen.getByRole('option', { name: 'Retired' })); expect(change).not.toHaveBeenCalled();
  await userEvent.keyboard('{Enter}'); expect(input).toHaveValue('Quality'); expect(input).toHaveFocus();
  expect(change).toHaveBeenCalledExactlyOnceWith('quality', expect.anything(), 'selectOption');
});
it('dismisses with Escape, Tab and outside clicks without committing a highlighted option', async () => {
  const change = vi.fn(); const close = vi.fn();
  renderWithUi(<><SingleSelect label="Model" options={options} onChange={change} onClose={close} /><button>Outside</button></>);
  const input = screen.getByRole('combobox'); await userEvent.click(input); await userEvent.keyboard('{ArrowDown}{Escape}');
  expect(input).toHaveFocus(); expect(input).toHaveAttribute('aria-expanded', 'false');
  expect(close).toHaveBeenLastCalledWith(expect.anything(), 'escape');
  await userEvent.click(input); await userEvent.tab(); expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();
  expect(close).toHaveBeenLastCalledWith(expect.anything(), 'blur');
  await userEvent.click(input); await userEvent.click(screen.getByRole('button', { name: 'Outside' }));
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument(); expect(change).not.toHaveBeenCalled();
});
it('supports controlled selection, clearing, fresh options and replaced callbacks', async () => {
  const first = vi.fn(); const latest = vi.fn();
  const { rerender } = renderWithUi(<SingleSelect label="Model" options={options} value="fast" onChange={first} />);
  const input = screen.getByRole('combobox'); expect(input).toHaveValue('Fast');
  await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
  expect(first).toHaveBeenCalledWith(null, expect.anything(), 'clear');
  await userEvent.tab(); expect(input).toHaveValue('Fast');
  rerender(<SingleSelect label="Model" options={options.map((option) => ({ ...option }))} value="quality" onChange={latest} />);
  expect(input).toHaveValue('Quality');
  await userEvent.click(input); await userEvent.click(screen.getByRole('option', { name: 'Fast' }));
  expect(latest).toHaveBeenCalledWith('fast', expect.anything(), 'selectOption'); expect(first).toHaveBeenCalledTimes(1);
});
it('does not erase searches when parent state or recreated option arrays change', async () => {
  function Example() { const [query, setQuery] = useState(''); return <><SingleSelect label="Model" options={options.map((option) => ({ ...option }))}
    value="fast" onInputChange={setQuery} /><span data-testid="query">{query}</span></>; }
  renderWithUi(<Example />); const input = screen.getByRole('combobox');
  await userEvent.clear(input); await userEvent.type(input, 'prod');
  expect(input).toHaveValue('prod'); expect(screen.getByTestId('query')).toHaveTextContent('prod');
  expect(screen.getByRole('option')).toHaveAccessibleName('Quality');
});
it('distinguishes numeric zero, empty-string and missing values and submits keys', async () => {
  const change = vi.fn();
  renderWithUi(<form data-testid="form"><SingleSelect<string | number> label="Size" name="size" options={[{ value: 0, label: 'Zero' }, { value: '', label: 'Automatic' }]}
    defaultValue={0} onChange={change} /></form>);
  const form = screen.getByTestId('form') as HTMLFormElement; expect(new FormData(form).get('size')).toBe('0');
  await userEvent.click(screen.getByRole('combobox')); await userEvent.click(screen.getByRole('option', { name: 'Automatic' }));
  expect(change).toHaveBeenLastCalledWith('', expect.anything(), 'selectOption'); expect(new FormData(form).get('size')).toBe('');
  expect(screen.getByRole('combobox')).toHaveValue('Automatic');
});
it('preserves unavailable saved values and updates their labels when options arrive', () => {
  const { rerender } = renderWithUi(<SingleSelect label="Model" options={[]} value="saved" />);
  expect(screen.getByRole('combobox')).toHaveValue('saved');
  rerender(<SingleSelect label="Model" options={[{ value: 'saved', label: 'Saved model', disabled: true }]} value="saved" />);
  expect(screen.getByRole('combobox')).toHaveValue('Saved model');
});
it('supports grouping, custom noninteractive content and custom filtering', async () => {
  const grouped = [{ value: 'one', label: 'One', group: 'First' }, { value: 'two', label: 'Two', group: 'Second' }, { value: 'three', label: 'Three', group: 'First' }];
  renderWithUi(<SingleSelect label="Grouped" options={grouped} filterOptions={(source) => source.filter((option) => option.value !== 'two')}
    renderOptionContent={(option) => <span>{option.label} · Custom details</span>} />);
  await userEvent.click(screen.getByRole('combobox'));
  expect(screen.getByRole('group', { name: 'First' })).toHaveTextContent('Three · Custom details');
  expect(screen.queryByRole('option', { name: 'Two' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('option', { name: 'Three' })); expect(screen.getByRole('combobox')).toHaveValue('Three');
});
it('keeps disabled/read-only controls unchanged and supports nonsearchable keyboard opening', async () => {
  const change = vi.fn();
  const { rerender } = renderWithUi(<SingleSelect label="Model" options={options} value="fast" disabled open onChange={change} />);
  expect(screen.getByRole('combobox')).toBeDisabled(); expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  rerender(<SingleSelect label="Model" options={options} value="fast" readOnly open onChange={change} />);
  expect(screen.getByRole('combobox')).toHaveAttribute('aria-readonly', 'true');
  expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  rerender(<SingleSelect label="Model" options={options} searchable={false} onChange={change} />);
  screen.getByRole('combobox').focus(); await userEvent.keyboard(' ');
  expect(screen.getByRole('listbox')).toBeVisible(); await userEvent.keyboard('{End}{Enter}');
  expect(change).toHaveBeenCalledWith('quality', expect.anything(), 'selectOption');
});
it('connects label, helper/error text, required state, refs, root styles and loading state', async () => {
  const root = createRef<HTMLDivElement>(); const input = createRef<HTMLInputElement>();
  renderWithUi(<><span id="external">External hint.</span><SingleSelect ref={root} inputRef={input} label="Model" required error loading
    options={[]} helperText="Choose a model." aria-describedby="external" data-testid="select" sx={[{ margin: '2px' }, { margin: '6px' }]} /></>);
  const combo = screen.getByRole('combobox'); expect(input.current).toBe(combo); expect(root.current).toBe(screen.getByTestId('select'));
  expect(root.current).toHaveStyle({ margin: '6px' }); expect(combo).toHaveAccessibleDescription('External hint. Choose a model.');
  expect(combo).toHaveAttribute('aria-invalid', 'true'); expect(combo).toHaveAttribute('aria-required', 'true'); expect(combo).toHaveAttribute('aria-busy', 'true');
  await userEvent.click(combo); expect(screen.getByRole('status')).toHaveTextContent('Loading options…');
});
it('supports controlled popup state and respects canceled native keyboard callbacks', async () => {
  const open = vi.fn(); const close = vi.fn();
  const { rerender } = renderWithUi(<SingleSelect label="Model" options={options} open={false} onOpen={open} />);
  await userEvent.click(screen.getByRole('combobox')); expect(open).toHaveBeenCalled(); expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  rerender(<SingleSelect label="Model" options={options} open onClose={close} onKeyDown={(event) => event.preventDefault()} />);
  await userEvent.keyboard('{Escape}'); expect(close).not.toHaveBeenCalled();
  rerender(<SingleSelect label="Model" options={options} open onClose={close} />);
  await userEvent.keyboard('{Escape}'); expect(close).toHaveBeenCalledWith(expect.anything(), 'escape'); expect(screen.getByRole('listbox')).toBeVisible();
});
it('lets the first Escape dismiss the options before dismissing a containing dialog', async () => {
  const close = vi.fn();
  renderWithUi(<ModalDialog open title="Settings" onClose={close} transitionDuration={0}><SingleSelect label="Model" options={options} /></ModalDialog>);
  await userEvent.click(screen.getByRole('combobox')); await userEvent.keyboard('{ArrowDown}{Escape}');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument(); expect(close).not.toHaveBeenCalled();
  await userEvent.keyboard('{Escape}'); await waitFor(() => expect(close).toHaveBeenCalledWith(expect.anything(), 'escapeKeyDown'));
});
