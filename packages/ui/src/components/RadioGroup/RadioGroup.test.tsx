import { createRef } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { RadioGroup } from './RadioGroup';
import { ChoiceCardGroup } from '../ChoiceCardGroup';

const options = [{ value: 0, label: 'Draft', description: 'Quick exploration' }, { value: 1, label: 'Retired', disabled: true }, { value: 2, label: 'Production' }];
describe.each([{ name: 'RadioGroup', Component: RadioGroup }, { name: 'ChoiceCardGroup', Component: ChoiceCardGroup }])('$name', ({ Component }) => {
  it('selects typed numeric values and moves among enabled choices with keyboard and pointer', async () => {
    const change = vi.fn(); renderWithUi(<Component label="Quality" options={options} onChange={change} />);
    expect(screen.getByRole('radiogroup', { name: 'Quality' })).toBeInTheDocument(); expect(screen.getByRole('radio', { name: 'Draft' })).toHaveAccessibleDescription('Quick exploration');
    await userEvent.click(screen.getByRole('radio', { name: 'Draft' })); expect(change).toHaveBeenLastCalledWith(0, expect.anything());
    await userEvent.keyboard('{ArrowDown}'); expect(screen.getByRole('radio', { name: 'Production' })).toHaveFocus(); expect(screen.getByRole('radio', { name: 'Production' })).toBeChecked();
    await userEvent.keyboard('{Home}'); expect(screen.getByRole('radio', { name: 'Draft' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Retired' })); expect(change).toHaveBeenCalledTimes(3);
  });
  it('preserves controlled selection and read-only state while refreshing callbacks', async () => {
    const first = vi.fn(); const latest = vi.fn();
    const { rerender } = renderWithUi(<Component label="Quality" options={options} value={0} onChange={first} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Production' })); expect(first).toHaveBeenCalledWith(2, expect.anything()); expect(screen.getByRole('radio', { name: 'Draft' })).toBeChecked();
    rerender(<Component label="Quality" options={options} value={0} readOnly onChange={latest} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Production' })); expect(latest).not.toHaveBeenCalled(); expect(screen.getByRole('radio', { name: 'Draft' })).toBeChecked();
    rerender(<Component label="Quality" options={options} value={0} onChange={latest} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Production' })); expect(latest).toHaveBeenCalledWith(2, expect.anything());
  });
  it('supports RTL movement and restores focus when an option is removed or disabled', async () => {
    const ref = createRef<HTMLDivElement>(); const { rerender } = renderWithUi(<Component ref={ref} label="Quality" dir="rtl" options={options} />);
    act(() => screen.getByRole('radio', { name: 'Draft' }).focus()); await userEvent.keyboard('{ArrowLeft}'); expect(screen.getByRole('radio', { name: 'Production' })).toHaveFocus();
    rerender(<Component label="Quality" options={options.slice(0, 2)} />); expect(screen.getByRole('radio', { name: 'Draft' })).toHaveFocus();
    rerender(<Component label="Quality" options={options} disabled />); expect(screen.getByRole('radiogroup')).toHaveFocus();
  });
  it('associates errors, handles empty options and submits actual keys', () => {
    const { rerender } = renderWithUi(<form data-testid="form"><Component label="Quality" options={options} name="quality" value={0} required error helperText="Choose one" /></form>);
    expect(screen.getByRole('radiogroup')).toHaveAccessibleDescription('Choose one'); expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-invalid', 'true');
    expect(new FormData(screen.getByTestId('form') as HTMLFormElement).get('quality')).toBe('0');
    rerender(<Component label="Quality" options={[]} />); expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});
