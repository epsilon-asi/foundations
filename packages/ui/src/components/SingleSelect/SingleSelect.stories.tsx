import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, userEvent, waitFor, within, fn } from 'storybook/test';
import { checkSelectLayout, modelOptions, groupedOptions, longOptions, selectContainer } from '../../../.storybook/selectExamples';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { ModalDialog } from '../ModalDialog';
import { SingleSelect } from './SingleSelect';

const meta = { title: 'Components/SingleSelect', component: SingleSelect, play: checkSelectLayout,
  args: { label: 'Generation model', options: modelOptions, placeholder: 'Choose a model', helperText: 'Type to search names, descriptions and keywords.', onChange: fn() },
  decorators: [selectContainer]
} satisfies Meta<typeof SingleSelect>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const RichOptions: Story = { args: { defaultOpen: true, defaultValue: 'balanced' } };
export const Grouped: Story = { args: { options: groupedOptions, defaultOpen: true } };
export const Medium: Story = { args: { size: 'medium', defaultValue: 'quality', defaultOpen: true } };
export const LongContent: Story = { args: { options: longOptions, defaultOpen: true } };
export const NumericAndEmptyValues: Story = { args: { label: 'Preview size', options: [{ value: '', label: 'Automatic', description: 'Match the source image.' }, { value: 0, label: 'Original', description: 'Keep the original dimensions.' }, { value: 256, label: '256 pixels', description: 'Small preview for quick reviews.' }], defaultValue: 0, defaultOpen: true } };
export const Disabled: Story = { args: { disabled: true, defaultValue: 'balanced' } };
export const ReadOnly: Story = { args: { readOnly: true, defaultValue: 'quality', helperText: 'This setting is managed by your workspace.' } };
export const RequiredError: Story = { args: { required: true, error: true, helperText: 'Choose a generation model before continuing.' } };
export const Loading: Story = { args: { loading: true, options: [], defaultOpen: true, helperText: 'Options are provided by the caller.' } };
export const NoOptions: Story = { args: { options: [], defaultOpen: true, noOptionsText: 'No models available for this workspace.' } };
export const NonSearchable: Story = { args: { searchable: false, clearable: false, defaultValue: 'fast', defaultOpen: true, helperText: 'Choose with the pointer or arrow keys.' } };
export const CustomOptionContent: Story = { args: { defaultOpen: true, renderOptionContent: (option) => <Box sx={{ display: 'grid', gap: 0.5 }}>
  <Typography variant="subtitle2">{option.label}</Typography><Typography variant="caption" color="text.secondary">{option.description}</Typography>{option.meta}</Box> } };
export const Controlled: Story = { render: function Example(args) { const [value, setValue] = useState<string | number | null>('balanced'); return <>
  <SingleSelect {...args} value={value} onChange={(next, event, reason) => { args.onChange?.(next, event, reason); setValue(next); }} />
  <Typography role="status" variant="caption">Selected key: {value ?? 'none'}</Typography></>; } };
export const Dark: Story = { args: { defaultOpen: true, defaultValue: 'balanced' }, decorators: [withDarkUi] };
export const KeyboardSelection: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); const body = within(canvasElement.ownerDocument.body); const input = canvas.getByRole('combobox');
  await userEvent.click(input); await userEvent.keyboard('{End}{Enter}');
  await expect(input).toHaveValue('Production quality'); await expect(input).toHaveFocus();
  await userEvent.click(input); await userEvent.clear(input); await userEvent.type(input, 'draft');
  await expect(body.getAllByRole('option')).toHaveLength(1);
  await checkSelectLayout({ canvasElement, markChecked: false });
  await userEvent.keyboard('{ArrowDown}{Enter}'); await expect(input).toHaveValue('Fast concept');
  await userEvent.click(input); await userEvent.keyboard('{Escape}'); await expect(input).toHaveFocus();
  await checkSelectLayout({ canvasElement });
} };
export const InsideDialog: Story = { render: function Example(args) { const [open, setOpen] = useState(false); return <>
  <ActionButton onClick={() => setOpen(true)}>Open settings</ActionButton><ModalDialog open={open} title="Generation settings" onClose={() => setOpen(false)}>
    <Box sx={{ pt: 1 }}><SingleSelect {...args} /></Box>
  </ModalDialog></>; }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(canvas.getByRole('button', { name: 'Open settings' })); await userEvent.click(body.getByRole('combobox'));
  await waitFor(() => expect(body.getByRole('listbox')).toBeVisible()); await checkSelectLayout({ canvasElement, markChecked: false });
  await userEvent.keyboard('{Escape}'); await expect(body.getByRole('dialog')).toBeVisible();
  await userEvent.keyboard('{Escape}'); await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
  await expect(canvas.getByRole('button', { name: 'Open settings' })).toHaveFocus(); await checkSelectLayout({ canvasElement });
} };
