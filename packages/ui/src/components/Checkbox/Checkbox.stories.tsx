import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { expect, userEvent, within, fn } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { Checkbox } from './Checkbox';
const meta = { title: 'Components/Checkbox', component: Checkbox, play: checkStoryLayout,
  args: { label: 'Include metadata', helperText: 'Attach generation settings to the exported asset.', onChange: fn() }
} satisfies Meta<typeof Checkbox>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const States: Story = { render: (args) => <Box sx={{ display: 'grid', gap: 1 }}><Checkbox {...args} /><Checkbox {...args} label="Selected" defaultChecked /><Checkbox {...args} label="Partially selected" indeterminate /></Box> };
export const Small: Story = { args: { size: 'small' } };
export const Disabled: Story = { args: { disabled: true, defaultChecked: true } };
export const ReadOnly: Story = { args: { readOnly: true, defaultChecked: true } };
export const RequiredError: Story = { args: { required: true, error: true, helperText: 'Select this option to continue.' } };
export const LongLabel: Story = { args: { label: 'Include the complete production history and all generation metadata in this export', helperText: 'project_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz' } };
export const Dark: Story = { ...States, decorators: [withDarkUi] };
export const Keyboard: Story = { play: async ({ canvasElement }) => {
  const control = within(canvasElement).getByRole('checkbox'); await userEvent.click(control); await expect(control).toBeChecked();
  await userEvent.keyboard(' '); await expect(control).not.toBeChecked(); await checkStoryLayout({ canvasElement });
} };
