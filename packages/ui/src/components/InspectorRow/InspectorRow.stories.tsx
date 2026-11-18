import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, TextField } from '@mui/material';
import { expect, userEvent, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { InspectorRow } from './InspectorRow';

const meta = { title: 'Components/InspectorRow', component: InspectorRow, play: checkStoryLayout,
  args: { label: 'Asset name', description: 'Used when exporting the selection.', children: null },
  render: function Example(args) {
    const [value, setValue] = useState('Coastal study');
    return <InspectorRow {...args} onReset={args.onReset ? () => setValue('Coastal study') : undefined}>{control => <TextField
      id={control.id} value={value} onChange={event => setValue(event.target.value)} required={control.required} error={control['aria-invalid']} fullWidth
      slotProps={{ htmlInput: { 'aria-describedby': control['aria-describedby'] } }} />}</InspectorRow>;
  }
} satisfies Meta<typeof InspectorRow>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Required: Story = { args: { required: true } };
export const Error: Story = { args: { error: 'An asset with this name already exists.' } };
export const MixedValues: Story = { args: { mixed: true } };
export const Reset: Story = { args: { onReset: () => {}, resetLabel: 'Reset name' } };
export const ResetDisabled: Story = { args: { onReset: () => {}, resetDisabled: true } };
export const Narrow: Story = { decorators: [Story => <Box sx={{ width: 260, maxWidth: '100%' }}><Story /></Box>] };
export const LongContent: Story = { args: { label: 'The name used for every exported asset in this collection', description: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz' } };
export const Dark: Story = { decorators: [withDarkUi] };
export const KeyboardAndReset: Story = { args: { onReset: () => {}, resetLabel: 'Reset name' }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); const input = canvas.getByRole('textbox', { name: 'Asset name' });
  await userEvent.clear(input); await userEvent.type(input, 'New name'); await userEvent.tab();
  await expect(canvas.getByRole('button', { name: 'Reset name' })).toHaveFocus(); await userEvent.keyboard('{Enter}');
  await expect(input).toHaveValue('Coastal study'); await checkStoryLayout({ canvasElement });
} };
