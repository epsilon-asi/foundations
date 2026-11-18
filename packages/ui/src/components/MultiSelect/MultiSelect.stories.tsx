import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, fn } from 'storybook/test';
import { checkSelectLayout, modelOptions, groupedOptions, longOptions, selectContainer } from '../../../.storybook/selectExamples';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { MultiSelect } from './MultiSelect';

const meta = { title: 'Components/MultiSelect', component: MultiSelect, play: checkSelectLayout,
  args: { label: 'Models to compare', options: modelOptions, placeholder: 'Choose models', helperText: 'Select several models. Remove a chip to deselect it.', onChange: fn() },
  decorators: [selectContainer]
} satisfies Meta<typeof MultiSelect>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const RichOptions: Story = { args: { defaultValue: ['fast', 'balanced'], defaultOpen: true } };
export const Grouped: Story = { args: { options: groupedOptions, defaultValue: ['balanced'], defaultOpen: true } };
export const Medium: Story = { args: { size: 'medium', defaultValue: ['fast', 'quality'], defaultOpen: true } };
export const LimitedChips: Story = { args: { defaultValue: ['fast', 'balanced', 'quality'], limitTags: 1 } };
export const LongLabels: Story = { args: { options: longOptions, defaultValue: ['long', 'other'], defaultOpen: true } };
export const Disabled: Story = { args: { disabled: true, defaultValue: ['fast', 'balanced'] } };
export const ReadOnly: Story = { args: { readOnly: true, defaultValue: ['fast', 'balanced'] } };
export const RequiredError: Story = { args: { required: true, error: true, helperText: 'Select at least one comparison model.' } };
export const Loading: Story = { args: { loading: true, options: [], defaultOpen: true } };
export const CloseOnSelect: Story = { args: { closeOnSelect: true, defaultOpen: true } };
export const Dark: Story = { args: { defaultValue: ['fast', 'balanced'], defaultOpen: true }, decorators: [withDarkUi] };
export const KeyboardAndRemoval: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); const body = within(canvasElement.ownerDocument.body); const input = canvas.getByRole('combobox');
  await userEvent.click(input); await userEvent.keyboard('{Home}{Enter}{ArrowDown}{Enter}');
  await expect(canvas.getByLabelText('Selected: Fast concept')).toBeVisible(); await expect(canvas.getByLabelText('Selected: Balanced')).toBeVisible();
  await expect(body.getByRole('listbox')).toBeVisible(); await checkSelectLayout({ canvasElement, markChecked: false });
  await userEvent.keyboard('{Escape}{Backspace}'); await expect(canvas.queryByLabelText('Selected: Balanced')).not.toBeInTheDocument();
  await userEvent.click(canvas.getByRole('button', { name: 'Clear selection' })); await expect(canvas.queryByLabelText('Selected: Fast concept')).not.toBeInTheDocument();
  await checkSelectLayout({ canvasElement });
} };
