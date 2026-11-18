import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { expect, userEvent, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ProgressIndicator } from './ProgressIndicator';

const meta = { title: 'Components/ProgressIndicator', component: ProgressIndicator, play: checkStoryLayout,
  args: { label: 'Exporting assets', value: 35, status: '7 of 20 images exported', valueText: '7 of 20 images' }
} satisfies Meta<typeof ProgressIndicator>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Indeterminate: Story = { args: { value: undefined, status: 'Preparing the export…', valueText: undefined } };
export const Zero: Story = { args: { value: 0, status: 'Queued', valueText: undefined } };
export const Complete: Story = { args: { value: 100, status: 'All assets exported', valueText: undefined, color: 'success' } };
export const Error: Story = { args: { color: 'error', status: 'Export stopped. Check the destination and try again.' } };
export const Cancelling: Story = { args: { onCancel: () => {}, cancelDisabled: true, cancelLabel: 'Cancelling…' } };
export const LongContent: Story = { args: { label: 'Export the complete selected character collection including metadata and generation settings', status: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz' } };
export const Narrow: Story = { decorators: [Story => <Box sx={{ width: 240, maxWidth: '100%' }}><Story /></Box>] };
export const Dark: Story = { decorators: [withDarkUi] };
export const Cancellation: Story = { render: function Cancel(args) { const [cancelled, setCancelled] = useState(false); return <ProgressIndicator {...args}
  onCancel={() => setCancelled(true)} cancelDisabled={cancelled} cancelLabel={cancelled ? 'Cancelled' : 'Cancel export'} status={cancelled ? 'Export cancelled by you' : args.status} />; },
  play: async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.click(canvas.getByRole('button', { name: 'Cancel export' }));
    await expect(canvas.getByRole('button', { name: 'Cancelled' })).toBeDisabled(); await expect(canvas.getByText('Export cancelled by you')).toBeVisible(); await checkStoryLayout({ canvasElement }); }
};
