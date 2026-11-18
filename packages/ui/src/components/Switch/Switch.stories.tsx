import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { expect, userEvent, within, fn } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { Switch } from './Switch';
const meta = { title: 'Components/Switch', component: Switch, play: checkStoryLayout,
  args: { label: 'Live preview', helperText: 'Update the preview when settings change.', onChange: fn() }
} satisfies Meta<typeof Switch>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };
export const Sizes: Story = { render: (args) => <Box sx={{ display: 'grid', gap: 1 }}><Switch {...args} size="small" /><Switch {...args} size="medium" defaultChecked /></Box> };
export const Disabled: Story = { args: { disabled: true, defaultChecked: true } };
export const ReadOnly: Story = { args: { readOnly: true, defaultChecked: true } };
export const RequiredError: Story = { args: { required: true, error: true, helperText: 'Enable this setting to continue.' } };
export const LongLabel: Story = { args: { label: 'Automatically refresh all production previews when the generation settings change', helperText: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz' } };
export const Dark: Story = { args: { defaultChecked: true }, decorators: [withDarkUi] };
export const Keyboard: Story = { play: async ({ canvasElement }) => {
  const control = within(canvasElement).getByRole('switch'); await userEvent.click(control); await expect(control).toBeChecked();
  await userEvent.keyboard(' '); await expect(control).not.toBeChecked(); await checkStoryLayout({ canvasElement });
} };
