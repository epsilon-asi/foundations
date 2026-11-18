import { createRef } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { Switch } from './Switch';
import { Checkbox } from '../Checkbox';

describe.each([{ name: 'Switch', Component: Switch, role: 'switch' }, { name: 'Checkbox', Component: Checkbox, role: 'checkbox' }])('$name', ({ Component, role }) => {
  it('connects labels/helpers, handles label clicks and Space, and forwards input refs and slot handlers', async () => {
    const change = vi.fn(); const blur = vi.fn(); const input = createRef<HTMLInputElement>();
    renderWithUi(<Component label="Enable previews" helperText="Local setting" onChange={change} inputRef={input}
      slotProps={{ input: () => ({ onBlur: blur }) }} />);
    const control = screen.getByRole(role, { name: 'Enable previews' }); expect(input.current).toBe(control);
    expect(control).toHaveAccessibleDescription('Local setting'); fireEvent.click(screen.getByText('Enable previews'));
    expect(control).toBeChecked(); expect(change).toHaveBeenCalledExactlyOnceWith(expect.anything(), true);
    act(() => control.focus()); await userEvent.keyboard(' '); expect(control).not.toBeChecked(); expect(change).toHaveBeenLastCalledWith(expect.anything(), false);
    await userEvent.tab(); expect(blur).toHaveBeenCalled();
  });
  it('keeps controlled state, updates callbacks and blocks disabled and read-only changes', async () => {
    const first = vi.fn(); const latest = vi.fn();
    const { rerender } = renderWithUi(<Component label="Enabled" checked onChange={first} />);
    await userEvent.click(screen.getByRole(role)); expect(first).toHaveBeenCalledWith(expect.anything(), false); expect(screen.getByRole(role)).toBeChecked();
    rerender(<Component label="Enabled" checked={false} onChange={latest} readOnly />);
    await userEvent.click(screen.getByRole(role)); expect(screen.getByRole(role)).not.toBeChecked(); expect(latest).not.toHaveBeenCalled();
    expect(screen.getByRole(role)).toHaveAttribute('aria-readonly', 'true');
    rerender(<Component label="Enabled" checked={false} onChange={latest} disabled />);
    fireEvent.click(screen.getByRole(role)); expect(latest).not.toHaveBeenCalled(); expect(screen.getByRole(role)).toBeDisabled();
    rerender(<Component label="Enabled" onChange={latest} />); await userEvent.click(screen.getByRole(role)); expect(latest).toHaveBeenCalledWith(expect.anything(), true);
  });
  it('supports native submission, required/error state and root style overrides', () => {
    renderWithUi(<form data-testid="form"><Component label="Permission" name="permission" value="yes" defaultChecked required error helperText="Required"
      sx={[{ margin: '2px' }, { margin: '6px' }]} /></form>);
    const control = screen.getByRole(role); expect(control).toHaveAttribute('aria-invalid', 'true'); expect(control).toBeRequired();
    expect(new FormData(screen.getByTestId('form') as HTMLFormElement).get('permission')).toBe('yes');
  });
});
it('exposes an indeterminate checkbox as mixed', () => {
  const { rerender } = renderWithUi(<Checkbox label="Select all" indeterminate />);
  expect(screen.getByRole('checkbox')).toBePartiallyChecked(); rerender(<Checkbox label="Select all" checked />); expect(screen.getByRole('checkbox')).toBeChecked();
});
